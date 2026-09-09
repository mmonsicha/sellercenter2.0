import { OrderTaskName, type Order } from '$lib/entities/order/order';
import {
	PaymentTxnState,
	RejectReason,
	SlipPaymentState,
	type PaymentItem,
	type PaymentTransaction
} from '$lib/entities/payment/payment-transaction';
import type { components } from './management-gen';

type ApprovePaymentRaw = components['schemas']['approvePaymentResponse'];
type ApprovePaymentReq = components['schemas']['approvePaymentRequest'];
type RejectPaymentRaw = components['schemas']['rejectPaymentResponse'];
type RejectPaymentReq = components['schemas']['rejectPaymentRequest'];
type EditPaymentRaw = components['schemas']['editPaymentDetailResponse'];
type EditPaymentReq = components['schemas']['editPaymentDetailRequest'];

export interface ApprovePaymentResult {
	paymentId?: string;
	transactionId?: string;
	paymentState?: string;
	transactionState?: string;
	paidAmount?: number;
	timestamp?: string;
}

export interface RejectPaymentResult {
	paymentId?: string;
	paymentState?: string;
	rejectReason?: string;
	rejectNote?: string;
	timestamp?: string;
}

export interface EditPaymentResult {
	paymentId?: string;
	paymentState?: string;
	changedFields?: string[];
	timestamp?: string;
}

export interface EditPaymentInput {
	paymentChannelId?: number;
	transferAt?: string;
	slipId?: string;
	amount?: number;
	fullImageUrl?: string;
	thumbnailUrl?: string;
	/** optimistic-lock version loaded with the payment; required by sukipay */
	version?: number;
}

export const toApprovePaymentResult = (raw: ApprovePaymentRaw): ApprovePaymentResult => ({
	paymentId: raw.payment_id ?? undefined,
	transactionId: raw.transaction_id ?? undefined,
	paymentState: raw.payment_state ?? undefined,
	transactionState: raw.transaction_state ?? undefined,
	paidAmount: raw.paid_amount ?? undefined,
	timestamp: raw.timestamp ?? undefined
});

export const toApprovePaymentRequest = (): ApprovePaymentReq => {
	return {};
};

export const toRejectPaymentRequest = (reason: string, note?: string): RejectPaymentReq => {
	const req: RejectPaymentReq = { reject_reason: reason };
	if (note && note.length > 0) {
		req.reject_note = note;
	}
	return req;
};

export const toRejectPaymentResult = (raw: RejectPaymentRaw): RejectPaymentResult => ({
	paymentId: raw.payment_id ?? undefined,
	paymentState: raw.payment_state ?? undefined,
	rejectReason: raw.reject_reason ?? undefined,
	rejectNote: raw.reject_note ?? undefined,
	timestamp: raw.timestamp ?? undefined
});

export const toEditPaymentRequest = (input: EditPaymentInput): EditPaymentReq => {
	const req: EditPaymentReq = {};
	if (input.paymentChannelId !== undefined) req.payment_channel_id = input.paymentChannelId;
	if (input.transferAt !== undefined) req.transfer_at = input.transferAt;
	if (input.slipId !== undefined) req.slip_id = input.slipId;
	if (input.amount !== undefined) req.amount = input.amount;
	if (input.fullImageUrl !== undefined) req.full_image_url = input.fullImageUrl;
	if (input.thumbnailUrl !== undefined) req.thumbnail_url = input.thumbnailUrl;
	if (input.version !== undefined) req.version = input.version;
	return req;
};

export const toEditPaymentResult = (raw: EditPaymentRaw): EditPaymentResult => ({
	paymentId: raw.payment_id ?? undefined,
	paymentState: raw.payment_state ?? undefined,
	changedFields: raw.changed_fields ?? undefined,
	timestamp: raw.timestamp ?? undefined
});

const parseSlipPaymentState = (raw: unknown): SlipPaymentState | undefined =>
	typeof raw === 'string' && (Object.values(SlipPaymentState) as string[]).includes(raw)
		? (raw as SlipPaymentState)
		: undefined;

const parsePaymentTxnState = (raw: unknown): PaymentTxnState | undefined => {
	if (
		raw === PaymentTxnState.PENDING ||
		raw === PaymentTxnState.CLOSED ||
		raw === PaymentTxnState.CANCELLED ||
		raw === PaymentTxnState.EXPIRED ||
		raw === PaymentTxnState.COMPENSATING ||
		raw === PaymentTxnState.COMPENSATED
	) {
		return raw;
	}
	return undefined;
};

const parseRejectReason = (raw: unknown): RejectReason | undefined => {
	if (
		raw === RejectReason.WRONG_AMOUNT ||
		raw === RejectReason.WRONG_ACCOUNT ||
		raw === RejectReason.DUPLICATE_PAYMENT ||
		raw === RejectReason.SLIP_UNREADABLE ||
		raw === RejectReason.SLIP_FRAUDULENT ||
		raw === RejectReason.OTHER
	) {
		return raw;
	}
	return undefined;
};

const toPaymentItem = (raw: Record<string, any>): PaymentItem => {
	const operator = raw.operator ?? undefined;
	const receivingAccount = raw.receiving_account ?? undefined;
	return {
		paymentId: raw.payment_id ?? undefined,
		paymentState: parseSlipPaymentState(raw.payment_state),
		amount: raw.amount ?? undefined,
		method: raw.method ?? undefined,
		bankCode: raw.bank_code ?? undefined,
		slipId: raw.slip_id ?? undefined,
		fullImageUrl: raw.full_image_url ?? undefined,
		thumbnailUrl: raw.thumbnail_url ?? undefined,
		transferAt: raw.transfer_at ?? undefined,
		paymentChannelId: raw.payment_channel_id ?? undefined,
		receivingAccount: receivingAccount
			? {
					accountName: receivingAccount.account_name ?? undefined,
					accountNumber: receivingAccount.account_number ?? undefined
				}
			: undefined,
		eventType: raw.event_type ?? undefined,
		createdAt: raw.created_at ?? undefined,
		paymentStateChangedAt: raw.payment_state_changed_at ?? undefined,
		operator: operator
			? {
					id: operator.id ?? undefined,
					name: operator.name ?? undefined,
					roles: normalizeOperatorRoles(operator),
					type: operator.type ?? undefined
				}
			: undefined,
		rejectReason: parseRejectReason(raw.reject_reason),
		rejectNote: raw.reject_note ?? undefined,
		version: raw.version ?? undefined
	};
};

// Operator role became an array (operator.roles); tolerate the legacy scalar
// `operator.role` still present in older task-attribute snapshots.
function normalizeOperatorRoles(operator: Record<string, any>): string[] | undefined {
	if (Array.isArray(operator.roles)) return operator.roles;
	if (typeof operator.role === 'string' && operator.role.length > 0) return [operator.role];
	return undefined;
}

export const toPaymentTransaction = (order: Order): PaymentTransaction | undefined => {
	const task = order.tasks?.find((t) => t.name === OrderTaskName.Payments);
	if (!task) {
		return undefined;
	}

	let attrs: Record<string, any> = {};
	const rawAttrs = task.attributes;
	if (typeof rawAttrs === 'string') {
		try {
			attrs = JSON.parse(rawAttrs) ?? {};
		} catch {
			attrs = {};
		}
	} else if (rawAttrs && typeof rawAttrs === 'object') {
		attrs = rawAttrs;
	}

	const rawPayments = attrs.payments;
	const payments: PaymentItem[] = Array.isArray(rawPayments)
		? rawPayments.map((p: Record<string, any>) => toPaymentItem(p))
		: [];

	return {
		transactionId: attrs.transaction_id ?? undefined,
		transactionState: parsePaymentTxnState(attrs.transaction_state),
		amount: attrs.amount ?? undefined,
		paidAmount: attrs.paid_amount ?? undefined,
		createdAt: attrs.created_at ?? undefined,
		payments,
		// Transaction-level state-change context, stamped by OMS at the payments-task top level.
		// `|| undefined` (not `??`): the flow schema seeds these keys as "" on every task, so an
		// empty string means "not set" — collapse it so the byName/reason fallbacks still fire.
		reason: attrs.reason || undefined,
		note: attrs.note || undefined,
		stateChangedBy: attrs.state_changed_by || undefined,
		stateChangedByName: attrs.state_changed_by_name || undefined
	};
};
