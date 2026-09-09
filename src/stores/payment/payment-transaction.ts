import { writable, get } from 'svelte/store';
import { isAxiosError } from 'axios';
import {
	createOrderPaymentTransaction,
	submitOrderPayment,
	submitAndApproveOrderPayment,
	cancelOrderPaymentTransaction,
	storeGetOrder,
	listPaymentChannels,
	type CreatePaymentTransactionRequest,
	type SubmitPaymentRequest
} from '../../service/management-rest';
import type { Attributes, Order } from '$lib/entities/order/order';
import { OrderTaskName, SaleChannelType } from '$lib/entities/order/order';
import { createIdempotencyKey } from '$utils/idempotency';
import { cleanupUploadedSlipFiles, type UploadedSlipFiles } from '$utils/slip-upload';
import {
	PaymentMethod,
	PaymentProvider,
	OFFLINE_PAYMENT_METHODS,
	ONLINE_PAYMENT_METHODS
} from '$lib/entities/payment/payment-method';
import { PaymentType } from '$lib/entities/payment/payment';
import { SlipPaymentState, type PaymentTransaction } from '$lib/entities/payment/payment-transaction';
import { toPaymentTransaction } from '../../service/payment-adapter';
import { currentCompany } from '$stores/company/current-company';
import { currentStore } from '$stores/store/current-store';

/** UI lifecycle phase of the payment modal — NOT a backend domain state.
 *  Distinct from CCS `TransactionState` / `PaymentState` (those are wire-format
 *  domain states from the backend). This only tracks what the modal is doing. */
export enum PaymentModalStatus {
	Idle = 'idle',
	Submitting = 'submitting',
	Polling = 'polling',
	Success = 'success',
	Partial = 'partial',
	Pending = 'pending',
	Canceled = 'canceled',
	Failed = 'failed'
}

export interface PaymentModalState {
	status: PaymentModalStatus;
	show: boolean;
	orderId: string;
	orderSerial: string;
	totalAmount: number;
	paidAmount: number;
	transactionId: string;
	/** Payment methods available for this sale context (offline vs online differ). */
	methods: PaymentMethod[];
	/** payment_method values already recorded on this order (read from the payments task).
	 *  Used to enforce single-use methods like cash — once a cash payment exists,
	 *  cash is removed from the available tabs. */
	usedMethods: string[];
	error?: string;
	/** i18n keyword for a classified error (timeout / service unavailable) —
	 *  takes precedence over the raw `error` message in the modal. */
	errorKey?: string;
	/** Which flow opened this modal — decides who owns the transaction lifecycle.
	 *
	 *  'checkout' (default) — POS new-sale flow. The modal creates the transaction
	 *  itself, so it also owns cleanup: closing while idle cancels both the
	 *  transaction and the order, and success clears the cart for the next sale.
	 *
	 *  'record' — "record payment" on an existing order (from the order
	 *  list/detail page). The transaction was already created with the order,
	 *  so the modal must NOT cancel anything on close —
	 *  the order is real customer data. On success/partial-owe it reloads the
	 *  order list instead of touching the cart (there is no cart in this flow). */
	context: 'checkout' | 'record';
}

const initial: PaymentModalState = {
	status: PaymentModalStatus.Idle,
	show: false,
	orderId: '',
	orderSerial: '',
	totalAmount: 0,
	paidAmount: 0,
	transactionId: '',
	methods: OFFLINE_PAYMENT_METHODS,
	usedMethods: [],
	context: 'checkout'
};

export const paymentModal = writable<PaymentModalState>(initial);

/** Shown when store has no enabled payment channel — pre-check before opening payment modal */
export const noPaymentChannelModal = writable<boolean>(false);

const POLL_INTERVAL_MS = 3000;
export const PAYMENT_PROVIDER = PaymentProvider.SUKIPAY;

/** Map a request failure to an i18n keyword:
 *  no response (network/timeout) → payment.error.timeout, 503 → payment.error.sukipay_unavailable. */
function classifyPaymentError(err: unknown): string | undefined {
	if (isAxiosError(err)) {
		if (err.response?.status === 503) return 'payment.error.sukipay_unavailable';
		if (!err.response) return 'payment.error.timeout';
	}
	return undefined;
}

// Poll generation token: each open/close/cancel bumps it so a poll loop from a
// previous payment session becomes a no-op against the current modal state
// (a single shared boolean let stale polls clobber a freshly-opened modal).
let pollGeneration = 0;

/** Payment-channel type that must be enabled for a given Sukipay method.
 *  bankTransferOffline shares the `bankTransfer` channel type — "offline" is a
 *  sale-context distinction, not a separate channel. creditCard/qrCode aren't
 *  channel-config gated yet → undefined (not filtered out). */
function requiredChannelType(method: PaymentMethod): PaymentType | undefined {
	switch (method) {
		case PaymentMethod.CASH:
			return PaymentType.CASH;
		case PaymentMethod.BANK_TRANSFER:
		case PaymentMethod.BANK_TRANSFER_OFFLINE:
			return PaymentType.BANK_TRANSFER;
		default:
			return undefined;
	}
}

/**
 * Resolve which of the given sale-context methods are actually usable for this store,
 * based on its enabled payment channels — a method is kept only if the store has an
 * enabled channel of the matching type (cash can be disabled even on the first payment).
 * Serves as both the pre-check (empty result = no usable channel → NoPaymentChannelModal)
 * and the source for the modal's tabs.
 *
 * On API error returns the context list unchanged — don't block the cashier on a
 * transient lookup failure.
 */
export async function resolveAvailablePaymentMethods(
	companyId: string,
	storeId: string,
	contextMethods: PaymentMethod[]
): Promise<PaymentMethod[]> {
	try {
		const resp = await listPaymentChannels(companyId, storeId);
		const enabledTypes = new Set(
			resp.data
				.filter((ch) => ch.status === true)
				.map((ch) => ch.data?.type)
				.filter((t): t is PaymentType => !!t)
		);
		return contextMethods.filter((m) => {
			const t = requiredChannelType(m);
			return t === undefined || enabledTypes.has(t);
		});
	} catch (err) {
		console.warn('[payment] resolve available payment methods failed:', err);
		return contextMethods;
	}
}

export function showNoPaymentChannelModal() {
	noPaymentChannelModal.set(true);
}

export function closeNoPaymentChannelModal() {
	noPaymentChannelModal.set(false);
}

export function openPaymentModal(args: {
	orderId: string;
	orderSerial: string;
	totalAmount: number;
	methods?: PaymentMethod[];
}) {
	pollGeneration++;
	paymentModal.set({
		...initial,
		show: true,
		orderId: args.orderId,
		orderSerial: args.orderSerial,
		totalAmount: args.totalAmount,
		methods: args.methods ?? OFFLINE_PAYMENT_METHODS
	});
}

// Open the payment modal in record context for an existing order from the order list
export function openRecordPaymentModal(args: {
	orderId: string;
	orderSerial: string;
	totalAmount: number;
	paidAmount: number;
	transactionId: string;
	usedMethods: string[];
	methods?: PaymentMethod[];
}) {
	pollGeneration++;
	paymentModal.set({
		...initial,
		context: 'record',
		show: true,
		status: PaymentModalStatus.Idle,
		orderId: args.orderId,
		orderSerial: args.orderSerial,
		totalAmount: args.totalAmount,
		paidAmount: args.paidAmount,
		transactionId: args.transactionId,
		usedMethods: args.usedMethods,
		methods: args.methods ?? OFFLINE_PAYMENT_METHODS
	});
}

/**
 * Initialize a payment transaction at OMS. Called right after order creation,
 * before the user fills the payment form. Updates state with transactionId + amounts.
 * Modal shows 'idle' state once this resolves so the cashier can fill the form.
 * Wraps backend operation `CreateOrderPaymentTransaction`.
 *
 * Throws on failure — caller should handle / surface the error.
 */
export async function initPaymentTransaction(args: {
	storeId: string;
	orderId: string;
	createRequest?: CreatePaymentTransactionRequest;
}): Promise<void> {
	const { storeId, orderId, createRequest } = args;

	const finalRequest: CreatePaymentTransactionRequest = {
		currency: 'THB',
		payment_provider: PAYMENT_PROVIDER,
		...createRequest,
		idempotency_key: createRequest?.idempotency_key ?? createIdempotencyKey()
	};

	try {
		const txn = await createOrderPaymentTransaction(storeId, orderId, finalRequest);

		paymentModal.update((s) => ({
			...s,
			status: PaymentModalStatus.Idle,
			transactionId: txn.transaction_id,
			totalAmount: txn.amount || s.totalAmount,
			paidAmount: txn.paid_amount
		}));
	} catch (err) {
		paymentModal.update((s) => ({
			...s,
			status: PaymentModalStatus.Failed,
			error: err instanceof Error ? err.message : String(err),
			errorKey: classifyPaymentError(err)
		}));
		throw err;
	}
}

/**
 * Reset form back to idle so user can pay the remaining amount
 * after seeing the "partial" warning. Keeps order context and paidAmount.
 */
export function continuePayment() {
	paymentModal.update((s) => ({
		...s,
		status: PaymentModalStatus.Idle,
		error: undefined,
		errorKey: undefined
	}));
}

export function closePaymentModal() {
	pollGeneration++;
	paymentModal.set(initial);
}

/**
 * Classify the settled outcome of a submit-and-approve for a specific payment,
 * reading the order's payment projection. Returns `undefined` to mean "not settled
 * yet — keep polling". `expectedApproved` comes from the combined endpoint's
 * `approved` flag: when true, an UNDER_REVIEW state is just Kafka lag (keep polling);
 * when false, UNDER_REVIEW is the terminal (approve-failed) outcome.
 */
export function classifySubmitApproveSettlement(args: {
	txn: PaymentTransaction | undefined;
	paymentId: string;
	expectedApproved: boolean;
}): PaymentModalStatus | undefined {
	const payment = args.txn?.payments.find((p) => p.paymentId === args.paymentId);
	if (!payment || !payment.paymentState) return undefined;

	switch (payment.paymentState) {
		case SlipPaymentState.COMPLETED: {
			const paid = args.txn?.paidAmount ?? 0;
			const total = args.txn?.amount ?? 0;
			return paid >= total && total > 0 ? PaymentModalStatus.Success : PaymentModalStatus.Partial;
		}
		case SlipPaymentState.UNDER_REVIEW:
			return args.expectedApproved ? undefined : PaymentModalStatus.Pending;
		case SlipPaymentState.REJECTED:
			return PaymentModalStatus.Failed;
		default:
			return undefined;
	}
}

/**
 * Submit a payment record for the (already-created) payment transaction.
 * Called after user fills the form and clicks ยืนยัน in the modal.
 * Transitions to polling state on success.
 * Wraps backend operation `SubmitOrderPayment`.
 *
 * Pre-condition: initPaymentTransaction has already run (transactionId set in state).
 */
export async function submitPayment(args: {
	storeId: string;
	orderId: string;
	submitRequest: SubmitPaymentRequest;
	slipCleanup?: UploadedSlipFiles;
}): Promise<void> {
	const { storeId, orderId, submitRequest, slipCleanup } = args;

	const finalRequest: SubmitPaymentRequest = {
		...submitRequest,
		idempotency_key: submitRequest.idempotency_key ?? createIdempotencyKey()
	};

	paymentModal.update((s) => ({
		...s,
		status: PaymentModalStatus.Submitting,
		error: undefined,
		errorKey: undefined
	}));

	try {
		const resp = await submitOrderPayment(storeId, orderId, finalRequest);

		paymentModal.update((s) => ({ ...s, status: PaymentModalStatus.Polling }));
		const gen = pollGeneration;
		// Settle on THIS payment's id, not on an aggregate amount: the payments task is
		// updated asynchronously (Kafka), so a poll right after the 200 still shows the
		// pre-tender state. We wait until our payment_id appears on the task before
		// reading success/partial — otherwise a tender that completes the order is misread
		// as partial → cashier charges again → backend rejects "transaction already paid".
		void pollUntilSettled(storeId, orderId, resp.payment_id, gen);
	} catch (err) {
		if (slipCleanup) {
			await cleanupUploadedSlipFiles(slipCleanup);
		}
		paymentModal.update((s) => ({
			...s,
			status: PaymentModalStatus.Failed,
			error: err instanceof Error ? err.message : String(err),
			errorKey: classifyPaymentError(err)
		}));
	}
}

/** Minimum time to show the polling UI so the cashier actually sees it,
 *  even if the backend resolves the transaction faster than that. */
const MIN_POLLING_DISPLAY_MS = 800;

/** Stop polling after this long if the payment never settles (Kafka lag / stuck
 *  upstream) so the cashier isn't trapped on the spinner. Surfaces a timeout the
 *  same way a submit failure does — Confirm stays disabled in Failed and closing
 *  from Failed does NOT cancel the transaction, so a late-landing payment is kept
 *  (cashier refreshes the order to confirm the real status). */
const MAX_POLL_DURATION_MS = 90_000;

async function pollUntilSettled(
	storeId: string,
	orderId: string,
	paymentId: string,
	gen: number
): Promise<void> {
	const pollStartedAt = Date.now();

	const ensureMinPollingTime = async () => {
		const elapsed = Date.now() - pollStartedAt;
		if (elapsed < MIN_POLLING_DISPLAY_MS) {
			await sleep(MIN_POLLING_DISPLAY_MS - elapsed);
		}
	};

	while (pollGeneration === gen) {
		try {
			const order = await storeGetOrder(storeId, orderId);
			// A newer session opened/closed while this poll was awaiting — bail so we
			// don't write a stale order's state over the current modal.
			if (pollGeneration !== gen) return;
			const paymentTask = order?.tasks?.find((t) => t.name === OrderTaskName.Payments);
			const attrs = readPaymentAttributes(paymentTask?.attributes);

			if (attrs) {
				paymentModal.update((s) => ({
					...s,
					paidAmount: attrs.paid_amount,
					usedMethods: attrs.usedMethods
				}));

				// Until our payment_id appears, paid_amount is the pre-tender value — keep polling
				if (attrs.paymentIds.includes(paymentId)) {
					await ensureMinPollingTime();

					const settled =
						attrs.paid_amount >= attrs.amount && attrs.amount > 0
							? PaymentModalStatus.Success
							: PaymentModalStatus.Partial;
					paymentModal.update((s) => ({ ...s, status: settled }));
					return;
				}
			}
		} catch (err) {
			// Network error → retry (don't surface)
			console.warn('[payment] poll failed, retrying:', err);
		}

		if (Date.now() - pollStartedAt >= MAX_POLL_DURATION_MS) {
			if (pollGeneration !== gen) return;
			paymentModal.update((s) => ({
				...s,
				status: PaymentModalStatus.Failed,
				errorKey: 'payment.error.timeout'
			}));
			return;
		}
		await sleep(POLL_INTERVAL_MS);
	}
}

/**
 * Submit a slip payment and approve it in one action, then reflect the result.
 * approved:false (approve failed after a successful submit) -> Pending immediately.
 * approved:true -> poll the order projection until the payment reaches COMPLETED
 * (Success / Partial); on timeout, fall back to Pending and let a background refresh
 * surface the final state.
 */
export async function submitAndApprovePayment(args: {
	storeId: string;
	orderId: string;
	submitRequest: SubmitPaymentRequest;
	slipCleanup?: UploadedSlipFiles;
}): Promise<void> {
	const { storeId, orderId, submitRequest, slipCleanup } = args;

	const finalRequest: SubmitPaymentRequest = {
		...submitRequest,
		idempotency_key: submitRequest.idempotency_key ?? createIdempotencyKey()
	};

	paymentModal.update((s) => ({
		...s,
		status: PaymentModalStatus.Submitting,
		error: undefined,
		errorKey: undefined
	}));

	try {
		const resp = await submitAndApproveOrderPayment(storeId, orderId, finalRequest);

		if (!resp.approved) {
			// submit ok, approve failed upstream -> slip left UNDER_REVIEW, approvable later
			paymentModal.update((s) => ({ ...s, status: PaymentModalStatus.Pending }));
			return;
		}

		paymentModal.update((s) => ({ ...s, status: PaymentModalStatus.Polling }));
		const gen = pollGeneration;
		void pollUntilApproved(storeId, orderId, resp.payment_id, gen);
	} catch (err) {
		if (slipCleanup) {
			await cleanupUploadedSlipFiles(slipCleanup);
		}
		paymentModal.update((s) => ({
			...s,
			status: PaymentModalStatus.Failed,
			error: err instanceof Error ? err.message : String(err),
			errorKey: classifyPaymentError(err)
		}));
	}
}

async function pollUntilApproved(
	storeId: string,
	orderId: string,
	paymentId: string,
	gen: number
): Promise<void> {
	const pollStartedAt = Date.now();

	const ensureMinPollingTime = async () => {
		const elapsed = Date.now() - pollStartedAt;
		if (elapsed < MIN_POLLING_DISPLAY_MS) {
			await sleep(MIN_POLLING_DISPLAY_MS - elapsed);
		}
	};

	while (pollGeneration === gen) {
		try {
			const order = await storeGetOrder(storeId, orderId);
			if (pollGeneration !== gen) return;

			const txn = toPaymentTransaction(order);
			if (txn?.paidAmount != null) {
				paymentModal.update((s) => ({ ...s, paidAmount: txn.paidAmount ?? s.paidAmount }));
			}

			const settled = classifySubmitApproveSettlement({ txn, paymentId, expectedApproved: true });
			if (settled) {
				await ensureMinPollingTime();
				if (pollGeneration !== gen) return;
				paymentModal.update((s) => ({ ...s, status: settled }));
				return;
			}
		} catch (err) {
			console.warn('[payment] approve poll failed, retrying:', err);
		}

		if (Date.now() - pollStartedAt >= MAX_POLL_DURATION_MS) {
			if (pollGeneration !== gen) return;
			// approve acknowledged upstream but the projection never caught up -> leave it
			// as pending; the order page's background refresh surfaces the final state.
			paymentModal.update((s) => ({ ...s, status: PaymentModalStatus.Pending }));
			return;
		}
		await sleep(POLL_INTERVAL_MS);
	}
}

/**
 * Cancel the (in-flight) payment transaction. Stops polling locally.
 * Wraps backend operation `CancelOrderPaymentTransaction`.
 *
 * Returns whether the backend cancel succeeded — callers that chain a follow-up
 * (e.g. canceling the order itself) must skip it on failure, otherwise the order
 * would be canceled while its SukiPay transaction is still PENDING (orphan).
 */
export async function cancelPaymentTransaction(storeId: string, orderId: string): Promise<boolean> {
	pollGeneration++;

	try {
		await cancelOrderPaymentTransaction(storeId, orderId, {
			payment_provider: PAYMENT_PROVIDER,
			description: 'cancelled by cashier'
		});
		paymentModal.update((s) => ({ ...s, status: PaymentModalStatus.Canceled }));
		return true;
	} catch (err) {
		console.warn('[payment] cancel transaction failed:', err);
		paymentModal.update((s) => ({
			...s,
			status: PaymentModalStatus.Canceled,
			error: err instanceof Error ? err.message : String(err)
		}));
		return false;
	}
}

interface PaymentTaskAttrs {
	paid_amount: number;
	amount: number;
	/** payment_method values from the task's `payments` array. */
	usedMethods: string[];
	/** payment_id values from the task's `payments` array — used to detect when a
	 *  specific submitted payment's event has landed on the order. */
	paymentIds: string[];
}

function readPaymentAttributes(attrs: Attributes | undefined): PaymentTaskAttrs | undefined {
	if (!attrs) return undefined;
	const paid = Number(attrs.paid_amount);
	const amount = Number(attrs.amount);
	if (Number.isNaN(paid) || Number.isNaN(amount)) return undefined;

	// Each payment in the task's `payments` array carries `method` and `payment_id` keys
	// (OMS attr keys).
	const payments = Array.isArray(attrs.payments) ? attrs.payments : [];
	const usedMethods = payments
		.map((p) => (p && typeof p === 'object' ? p.method ?? p.payment_method : undefined))
		.filter((m): m is string => typeof m === 'string' && m.length > 0);
	const paymentIds = payments
		.map((p) => (p && typeof p === 'object' ? p.payment_id : undefined))
		.filter((id): id is string => typeof id === 'string' && id.length > 0);

	return { paid_amount: paid, amount, usedMethods, paymentIds };
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Try to open the record-context payment modal for an existing order.
 * Shared by the order list (OrderTable.svelte) and order detail (Order.svelte)
 * "pay" actions so both run the same checks.
 *
 * Returns:
 * - `true`  — handled: opened the record payment modal, or showed
 *             NoPaymentChannelModal when the store has no usable channel.
 * - `false` — not handled: order has no SukiPay transaction (legacy order) or
 *             no company/store is selected. Caller falls back to its own flow
 *             (navigate / legacy modal).
 */
export async function tryOpenRecordPaymentModal(order: Order): Promise<boolean> {
	const txn = toPaymentTransaction(order);
	// Legacy (non-SukiPay) orders have no transactionId — caller handles the fallback.
	if (!txn?.transactionId) return false;

	const companyId = get(currentCompany)?.id;
	const storeId = get(currentStore)?.id;
	if (!companyId || !storeId) return false;

	// Online orders accept bankTransfer only; offline orders accept cash + bankTransferOffline.
	const contextMethods =
		order.saleChannel?.type === SaleChannelType.Online
			? ONLINE_PAYMENT_METHODS
			: OFFLINE_PAYMENT_METHODS;

	const methods = await resolveAvailablePaymentMethods(companyId, storeId, contextMethods);
	if (methods.length === 0) {
		showNoPaymentChannelModal();
		return true; // handled — NoPaymentChannelModal is showing
	}

	openRecordPaymentModal({
		orderId: order.orderId ?? '',
		orderSerial: order.orderSerial ?? '',
		totalAmount: txn.amount ?? 0,
		paidAmount: txn.paidAmount ?? 0,
		transactionId: txn.transactionId,
		usedMethods: txn.payments.map((p) => p.method).filter((m): m is string => !!m),
		methods
	});
	return true;
}
