import type { Order } from '$lib/entities/order/order';
import { toPaymentTransaction } from '$service/payment-adapter';
import { SlipPaymentState } from '$lib/entities/payment/payment-transaction';
import { PaymentMethod, PAYMENT_METHOD_LABEL_KEYS } from '$lib/entities/payment/payment-method';
import type { CancelReason } from '$service/management-rest';

// Cancel-reason → i18n label key. Centralized here (was duplicated verbatim in
// CancelOrderModal + CancellationRefund). Two shapes for two consumers:
//  • USER_CANCEL_REASON_LABEL_KEYS — the 4 OMS codes the seller can PICK in the cancel modal.
//  • CANCEL_REASON_LABEL_KEYS      — full DISPLAY map: those 4 OMS codes + the SukiPay
//    compensation-reason enum variants OMS may stamp on a reversal row (read-only display).
export const USER_CANCEL_REASON_LABEL_KEYS: Record<CancelReason, string> = {
	order_cancelled_by_customer: 'patona-sellercenter-order-cancel-reason-by_customer',
	customer_rejected_goods: 'patona-sellercenter-order-cancel-reason-customer_rejected',
	order_cancelled_by_seller: 'patona-sellercenter-order-cancel-reason-by_seller',
	other: 'patona-sellercenter-order-cancel-reason-other'
};

export const CANCEL_REASON_LABEL_KEYS: Record<string, string> = {
	...USER_CANCEL_REASON_LABEL_KEYS,
	// SukiPay compensation-reason enum (event.data.reason)
	ORDER_CANCELLED_BY_SELLER: 'patona-sellercenter-order-cancel-reason-by_seller',
	ORDER_CANCELLED_BY_CUSTOMER: 'patona-sellercenter-order-cancel-reason-by_customer',
	CUSTOMER_REJECTED_GOODS: 'patona-sellercenter-order-cancel-reason-customer_rejected',
	OMS_ORDER_CANCELLED: 'patona-sellercenter-order-cancel-reason-other',
	OTHER: 'patona-sellercenter-order-cancel-reason-other'
};

export type CancelCase = 'unpaid' | 'cash' | 'transfer';
export interface RefundLine {
	method: string;
	labelKey: string;
	amount: number;
}
export interface CancelContext {
	kind: CancelCase;
	refundTotal: number;
	lines: RefundLine[];
}

const TRANSFER_METHODS: string[] = [
	PaymentMethod.BANK_TRANSFER,
	PaymentMethod.BANK_TRANSFER_OFFLINE
];
const labelKey = (m: string) =>
	PAYMENT_METHOD_LABEL_KEYS[m as PaymentMethod] ?? PAYMENT_METHOD_LABEL_KEYS[PaymentMethod.CASH];

/**
 * True when the order still has a payment slip awaiting review (UNDER_REVIEW).
 * Cancel must be blocked in that case — the merchant has to approve/reject every
 * pending slip first (the backend rejects it too). This is the routing check for
 * the dedicated "cannot cancel" modal, kept separate from the refund-case logic.
 */
export function hasUnderReviewPayment(order: Order): boolean {
	const txn = toPaymentTransaction(order);
	return (txn?.payments ?? []).some((p) => p.paymentState === SlipPaymentState.UNDER_REVIEW);
}

export function getCancelContext(order: Order): CancelContext {
	const txn = toPaymentTransaction(order);
	const completed = (txn?.payments ?? []).filter(
		(p) => p.paymentState === SlipPaymentState.COMPLETED
	);
	if (completed.length === 0) return { kind: 'unpaid', refundTotal: 0, lines: [] };

	const byMethod = new Map<string, number>();
	for (const p of completed) {
		const m = p.method ?? 'cash';
		byMethod.set(m, (byMethod.get(m) ?? 0) + (p.amount ?? 0));
	}
	const lines: RefundLine[] = [...byMethod.entries()].map(([method, amount]) => ({
		method,
		labelKey: labelKey(method),
		amount
	}));
	const refundTotal = txn?.paidAmount ?? lines.reduce((s, l) => s + l.amount, 0);
	const hasTransfer = [...byMethod.keys()].some((m) => TRANSFER_METHODS.includes(m));
	return { kind: hasTransfer ? 'transfer' : 'cash', refundTotal, lines };
}

export function cancelToastKey(kind: CancelCase): string {
	if (kind === 'cash') return 'patona-sellercenter-orderdetail-toast-canceled-cash';
	if (kind === 'transfer') return 'patona-sellercenter-orderdetail-toast-canceled-transfer';
	return 'patona-sellercenter-orderdetail-toast-canceled-success';
}
