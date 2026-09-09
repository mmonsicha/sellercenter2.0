// Cancellation & refund summary shown in the order-detail right sidebar
// (section "การยกเลิก & คืนเงิน").
//
// Built from the order's real payment history: the OMS projects void/refund
// rows into the same payments[] task attribute as forward payments, after a
// paid order is cancelled. See `payment-transaction.ts` (isRefundPayment) and
// `payment-adapter.ts` (toPaymentTransaction) for how those rows are parsed.

import { isSukipayFlow, OrderTaskName, Status, type Order } from './order';
import {
	SlipPaymentState,
	isRefundPayment,
	type PaymentItem,
	type PaymentTransaction
} from '$lib/entities/payment/payment-transaction';

export enum RefundStatus {
	/** คืนเงินแล้ว — money returned to the customer */
	Refunded = 'refunded',
	/** ยกเลิกการชำระ — a cash payment was voided on cancel (money returned at the counter, not a refund) */
	Voided = 'voided',
	/** รอคืนเงิน — refund approved but not yet transferred back */
	Pending = 'pending',
	/** คืนเงินไม่สำเร็จ — refund attempt was rejected */
	Rejected = 'rejected'
}

export interface RefundEntry {
	/** originating refund/void payment id — stable {#each} key across polling */
	paymentId?: string;
	/** Payment-method key (e.g. 'cash', 'bankTransfer'); the component maps it to a localized label */
	method: string;
	amount: number;
	status: RefundStatus;
	/** ISO datetime — present when the money is settled (status Refunded or Voided) */
	refundedAt?: string;
}

export interface CancellationRefund {
	/** raw OMS cancel-reason code (e.g. 'order_cancelled_by_seller'), stored on the
	 * payments task remark at cancel time; mapped to a localized label in the component */
	reasonCode?: string;
	/** person who performed the cancellation, e.g. "นะโม พาโตนะ" */
	byName?: string;
	/** free-text note stamped alongside the reason (compensation / OTHER) */
	note?: string;
	refunds: RefundEntry[];
}

/** OMS cancel-reason codes (mirrors CancelOrderModal); anything else in the remark
 * (e.g. "payment_expired_7day") is not treated as a user cancel reason. */
const CANCEL_REASON_CODES = new Set([
	'order_cancelled_by_customer',
	'customer_rejected_goods',
	'order_cancelled_by_seller',
	'other'
]);

/** Green "คืนเงินแล้ว"/"ยกเลิกการชำระ" vs. amber "รอคืนเงิน" vs. red "คืนเงินไม่สำเร็จ" → ssk-badge themecolor */
export const refundStatusTheme = (s: RefundStatus): string =>
	s === RefundStatus.Refunded || s === RefundStatus.Voided
		? 'success'
		: s === RefundStatus.Rejected
			? 'error'
			: 'warning';

const refundStatusFromPaymentState = (s?: SlipPaymentState): RefundStatus => {
	switch (s) {
		case SlipPaymentState.REFUNDED:
			return RefundStatus.Refunded;
		case SlipPaymentState.VOIDED: // cash voided at the counter — money returned immediately, shown as its own status (not a refund)
			return RefundStatus.Voided;
		case SlipPaymentState.REFUND_REJECTED:
			return RefundStatus.Rejected;
		case SlipPaymentState.REFUND_PENDING:
		default:
			return RefundStatus.Pending;
	}
};

const toRefundEntry = (p: PaymentItem): RefundEntry => {
	const status = refundStatusFromPaymentState(p.paymentState);
	return {
		paymentId: p.paymentId,
		method: p.method ?? 'cash',
		amount: p.amount ?? 0,
		status,
		refundedAt:
			status === RefundStatus.Refunded || status === RefundStatus.Voided
				? p.paymentStateChangedAt ?? p.transferAt ?? p.createdAt
				: undefined
	};
};

/**
 * Build the Cancellation & Refund summary from the order's real payment history
 * (the void/refund rows the OMS projects after a paid cancel) plus the
 * cancel reason OMS stamps on the payments-task remark at cancel time.
 *
 * Renders as soon as a cancel is recorded (reason present) — even for a bank-only
 * cancel that has no void/refund row yet — so "who cancelled & why" shows without
 * waiting for the money to move. Returns undefined for non-cancelled orders.
 */
export const getCancellationRefund = (
	order: Order,
	txn: PaymentTransaction | undefined
): CancellationRefund | undefined => {
	// SukiPay-only concept: a legacy order has no SukiPay transaction, void/refund rows,
	// or compensation reason, so this section must not render for it (a cancelled legacy
	// order would otherwise show an empty "การยกเลิก & คืนเงิน" card via the isCancelling
	// fallback below).
	if (!isSukipayFlow(order.flow?.type)) return undefined;

	const refundRows = (txn?.payments ?? []).filter(isRefundPayment);

	const paymentsTask = order.tasks?.find((t) => t.name === OrderTaskName.Payments);
	const remark = paymentsTask?.remark?.trim();
	// Reason precedence: the OMS cancel-reason code stamped on the payments-task remark
	// (most precise — what the user picked in the modal), else the SukiPay compensation
	// reason enum carried on a void/refund row from the Kafka event.
	const remarkReason = remark && CANCEL_REASON_CODES.has(remark) ? remark : undefined;
	// Else the SukiPay compensation-reason enum, now stamped by OMS at the payments-task
	// top level (transaction-level), not on a void/refund row.
	const reasonCode = remarkReason ?? txn?.reason;

	// Show the section for any order that is being reversed / has been cancelled — even a
	// bank-only cancel with no void/refund row and no reason stamped yet — so at least
	// "who cancelled" appears immediately (falls back to the cashier).
	const isCancelling = order.status === Status.Refunding || order.status === Status.Canceled;
	if (refundRows.length === 0 && !reasonCode && !isCancelling) return undefined;

	const cashierName = order.cashierInfo?.name?.trim();
	// Who cancelled: prefer the state-changed-by name carried from the event (task-level),
	// then a real human operator on a reversal row (skip system operators like
	// "order-management-backend"), finally the cashier who handled the order.
	const eventName = txn?.stateChangedByName;
	const humanOperator = refundRows.find(
		(r) => r.operator?.name && r.operator.type !== 'system'
	)?.operator?.name;
	const byName = eventName ?? humanOperator ?? (cashierName || undefined);

	return {
		reasonCode,
		byName,
		note: txn?.note,
		refunds: refundRows.map(toRefundEntry)
	};
};
