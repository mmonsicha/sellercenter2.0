import { describe, it, expect } from 'vitest';
import { getCancellationRefund, RefundStatus } from './cancellation-refund';
import { OrderTaskName, type Order } from './order';
import { toPaymentTransaction } from '$service/payment-adapter';

function makeOrder(
	payments: Record<string, any>[],
	paidAmount?: number,
	opts?: {
		remark?: string;
		cashierName?: string;
		status?: string;
		attrs?: Record<string, any>;
		flowType?: string;
	}
): Order {
	return {
		orderId: 'o1',
		orderSerial: 'SO1234',
		flow: { type: opts?.flowType ?? 'POS-ONLINE-SUKIPAY-V1' },
		buyer: { name: 'buyer' },
		items: [],
		status: opts?.status,
		buyerStatement: { totalPrice: 0, netPrice: 0, receivedAmount: 0 },
		cashierInfo: opts?.cashierName ? { name: opts.cashierName } : undefined,
		tasks: [
			{
				name: OrderTaskName.Payments,
				remark: opts?.remark,
				attributes: {
					paid_amount: paidAmount,
					payments,
					// transaction-level state-change context stamped at the payments-task top level
					...(opts?.attrs ?? {})
				}
			}
		]
	};
}

describe('getCancellationRefund', () => {
	it('returns undefined when there are no refund/void rows (only COMPLETED payments)', () => {
		const order = makeOrder(
			[{ payment_id: 'p1', payment_state: 'COMPLETED', method: 'cash', amount: 1360 }],
			1360
		);

		expect(getCancellationRefund(order, toPaymentTransaction(order))).toBeUndefined();
	});

	it('returns undefined for a LEGACY (non-sukipay) canceled order — no refund section', () => {
		// Regression guard (PAT-2038): a legacy order cancels via a direct state change
		// (PUT .../state) and has no void/refund concept, so the sukipay "Cancellation &
		// Refund" section must NOT render — even though status=canceled would otherwise
		// trigger the isCancelling fallback.
		for (const flowType of ['POS-ONLINE', 'POS-OFFLINE', 'POS-OFFLINE-DELIVERY-LATER']) {
			const order = makeOrder([], undefined, { status: 'canceled', flowType });
			expect(getCancellationRefund(order, toPaymentTransaction(order))).toBeUndefined();
		}
	});

	it('maps VOIDED (cash) to a Voided entry', () => {
		const order = makeOrder([
			{ payment_id: 'p1', payment_state: 'VOIDED', method: 'cash', amount: 360 }
		]);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info).toBeDefined();
		expect(info?.refunds).toEqual([
			expect.objectContaining({
				method: 'cash',
				amount: 360,
				status: RefundStatus.Voided
			})
		]);
	});

	it('maps REFUND_PENDING (bankTransfer) to a Pending entry', () => {
		const order = makeOrder([
			{ payment_id: 'p1', payment_state: 'REFUND_PENDING', method: 'bankTransfer', amount: 1000 }
		]);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info?.refunds).toEqual([
			expect.objectContaining({
				method: 'bankTransfer',
				amount: 1000,
				status: RefundStatus.Pending
			})
		]);
		expect(info?.refunds[0].refundedAt).toBeUndefined();
	});

	it('maps REFUNDED to Refunded with refundedAt set', () => {
		const order = makeOrder([
			{
				payment_id: 'p1',
				payment_state: 'REFUNDED',
				method: 'bankTransfer',
				amount: 1000,
				payment_state_changed_at: '2024-01-22T00:20:00+07:00'
			}
		]);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info?.refunds).toEqual([
			expect.objectContaining({
				method: 'bankTransfer',
				status: RefundStatus.Refunded,
				refundedAt: '2024-01-22T00:20:00+07:00'
			})
		]);
	});

	it('maps REFUND_REJECTED to Rejected', () => {
		const order = makeOrder([
			{ payment_id: 'p1', payment_state: 'REFUND_REJECTED', method: 'bankTransfer', amount: 1000 }
		]);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info?.refunds).toEqual([
			expect.objectContaining({
				method: 'bankTransfer',
				status: RefundStatus.Rejected
			})
		]);
	});

	it('renders a reason-only summary (no refund rows) when OMS stamped a cancel reason on the remark', () => {
		// bank-only cancel: order is refunding but no void/refund row has been projected yet.
		const order = makeOrder(
			[{ payment_id: 'p1', payment_state: 'COMPLETED', method: 'bankTransfer', amount: 1360 }],
			1360,
			{ remark: 'order_cancelled_by_seller', cashierName: 'Pan (Kim) Nitiyothin' }
		);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info).toBeDefined();
		expect(info?.reasonCode).toBe('order_cancelled_by_seller');
		expect(info?.byName).toBe('Pan (Kim) Nitiyothin');
		expect(info?.refunds).toHaveLength(0);
	});

	it('renders "who cancelled" for a refunding order with no void row and no reason yet (cashier fallback)', () => {
		// bank-only cancel before the reversal/reason lands — must still show the canceller.
		const order = makeOrder(
			[{ payment_id: 'p1', payment_state: 'COMPLETED', method: 'bankTransfer', amount: 1776 }],
			1776,
			{ cashierName: 'Pan (Kim) Nitiyothin', status: 'refunding' }
		);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info).toBeDefined();
		expect(info?.byName).toBe('Pan (Kim) Nitiyothin');
		expect(info?.reasonCode).toBeUndefined();
		expect(info?.refunds).toHaveLength(0);
	});

	it('ignores a non-cancel remark (e.g. payment_expired_7day) so no reason-only summary shows', () => {
		const order = makeOrder(
			[{ payment_id: 'p1', payment_state: 'COMPLETED', method: 'cash', amount: 100 }],
			100,
			{ remark: 'payment_expired_7day' }
		);

		expect(getCancellationRefund(order, toPaymentTransaction(order))).toBeUndefined();
	});

	it('skips a system operator for byName and falls back to the cashier', () => {
		const order = makeOrder(
			[
				{
					payment_id: 'p1',
					payment_state: 'VOIDED',
					method: 'cash',
					amount: 100,
					operator: { name: 'order-management-backend', type: 'system' }
				}
			],
			0,
			{ cashierName: 'Pan (Kim) Nitiyothin' }
		);

		expect(getCancellationRefund(order, toPaymentTransaction(order))?.byName).toBe('Pan (Kim) Nitiyothin');
	});

	it('uses a human (non-system) operator name for byName when present', () => {
		const order = makeOrder([
			{
				payment_id: 'p1',
				payment_state: 'VOIDED',
				method: 'cash',
				amount: 100,
				operator: { name: 'นะโม พาโตนะ', type: 'user' }
			}
		]);

		expect(getCancellationRefund(order, toPaymentTransaction(order))?.byName).toBe('นะโม พาโตนะ');
	});

	it('uses event-captured reason + state_changed_by_name from the task attributes', () => {
		const order = makeOrder(
			[
				{
					payment_id: 'p1',
					payment_state: 'VOIDED',
					method: 'cash',
					amount: 100,
					// the void was performed by the system, but the event carries the real canceller
					operator: { name: 'order-management-backend', type: 'system' }
				}
			],
			0,
			// OMS now stamps who/why at the payments-task top level, not on the void row
			{ attrs: { reason: 'ORDER_CANCELLED_BY_SELLER', state_changed_by_name: 'Supervisor' } }
		);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info?.reasonCode).toBe('ORDER_CANCELLED_BY_SELLER');
		// event name (task-level) beats the system operator
		expect(info?.byName).toBe('Supervisor');
	});

	it('excludes forward COMPLETED payments from refunds when refund rows are also present', () => {
		const order = makeOrder([
			{ payment_id: 'p1', payment_state: 'COMPLETED', method: 'cash', amount: 360 },
			{ payment_id: 'p2', payment_state: 'VOIDED', method: 'cash', amount: 360 }
		]);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info?.refunds).toHaveLength(1);
		expect(info?.refunds[0].status).toBe(RefundStatus.Voided);
	});

	it('propagates the free-text note (transaction-level) into the summary', () => {
		const order = makeOrder(
			[{ payment_id: 'p1', payment_state: 'VOIDED', method: 'cash', amount: 100 }],
			0,
			{ attrs: { reason: 'other', note: 'ลูกค้าเปลี่ยนใจ ขอยกเลิก' } }
		);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info?.reasonCode).toBe('other');
		expect(info?.note).toBe('ลูกค้าเปลี่ยนใจ ขอยกเลิก');
	});

	it('collapses empty-string transaction context ("" seeded by the flow schema) so byName/reason fallbacks fire', () => {
		// The OMS flow seeds reason/note/state_changed_by* as "" on every task; `|| undefined`
		// (not `??`) in toPaymentTransaction must collapse those so the cashier fallback still fires.
		const order = makeOrder(
			[{ payment_id: 'p1', payment_state: 'VOIDED', method: 'cash', amount: 100 }],
			0,
			{
				cashierName: 'Pan (Kim) Nitiyothin',
				attrs: { reason: '', note: '', state_changed_by: '', state_changed_by_name: '' }
			}
		);

		const info = getCancellationRefund(order, toPaymentTransaction(order));

		expect(info?.reasonCode).toBeUndefined();
		expect(info?.note).toBeUndefined();
		// empty state_changed_by_name collapsed → falls back to the cashier, not ''
		expect(info?.byName).toBe('Pan (Kim) Nitiyothin');
	});
});
