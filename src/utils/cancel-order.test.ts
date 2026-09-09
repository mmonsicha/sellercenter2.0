import { describe, it, expect } from 'vitest';
import { getCancelContext, cancelToastKey, hasUnderReviewPayment } from './cancel-order';
import { OrderTaskName, type Order } from '$lib/entities/order/order';

function makeOrder(payments: Record<string, any>[], paidAmount?: number): Order {
	return {
		orderId: 'o1',
		orderSerial: 'SO1234',
		flow: { type: 'POS-ONLINE-SUKIPAY-V1' },
		buyer: { name: 'buyer' },
		items: [],
		buyerStatement: { totalPrice: 0, netPrice: 0, receivedAmount: 0 },
		tasks: [
			{
				name: OrderTaskName.Payments,
				attributes: {
					paid_amount: paidAmount,
					payments
				}
			}
		]
	};
}

describe('getCancelContext', () => {
	it('no completed payments -> unpaid, total 0, 0 lines (under_review not counted here)', () => {
		const order = makeOrder([{ payment_state: 'UNDER_REVIEW', method: 'cash', amount: 500 }], 0);

		const ctx = getCancelContext(order);

		expect(ctx).toEqual({ kind: 'unpaid', refundTotal: 0, lines: [] });
	});

	it('one COMPLETED cash 1360 -> cash, total 1360, 1 line', () => {
		const order = makeOrder(
			[{ payment_state: 'COMPLETED', method: 'cash', amount: 1360 }],
			1360
		);

		const ctx = getCancelContext(order);

		expect(ctx.kind).toBe('cash');
		expect(ctx.refundTotal).toBe(1360);
		expect(ctx.lines).toEqual([{ method: 'cash', labelKey: 'payment.method.cash', amount: 1360 }]);
	});

	it('COMPLETED cash 360 + COMPLETED bankTransfer 1000 -> transfer, total 1360, 2 lines', () => {
		const order = makeOrder(
			[
				{ payment_state: 'COMPLETED', method: 'cash', amount: 360 },
				{ payment_state: 'COMPLETED', method: 'bankTransfer', amount: 1000 }
			],
			1360
		);

		const ctx = getCancelContext(order);

		expect(ctx.kind).toBe('transfer');
		expect(ctx.refundTotal).toBe(1360);
		expect(ctx.lines).toHaveLength(2);
		expect(ctx.lines).toEqual(
			expect.arrayContaining([
				{ method: 'cash', labelKey: 'payment.method.cash', amount: 360 },
				{ method: 'bankTransfer', labelKey: 'payment.method.bank_transfer', amount: 1000 }
			])
		);
	});

	it('transfer-only -> transfer', () => {
		const order = makeOrder(
			[{ payment_state: 'COMPLETED', method: 'bankTransfer', amount: 1000 }],
			1000
		);

		const ctx = getCancelContext(order);

		expect(ctx.kind).toBe('transfer');
	});

	it('UNDER_REVIEW payment is ignored in the refund calc (routing handles blocking)', () => {
		const order = makeOrder(
			[
				{ payment_state: 'COMPLETED', method: 'cash', amount: 360 },
				{ payment_state: 'UNDER_REVIEW', method: 'bankTransfer', amount: 1000 }
			],
			360
		);

		const ctx = getCancelContext(order);

		expect(ctx.kind).toBe('cash');
		expect(ctx.refundTotal).toBe(360);
		expect(ctx.lines).toEqual([{ method: 'cash', labelKey: 'payment.method.cash', amount: 360 }]);
	});
});

describe('hasUnderReviewPayment', () => {
	it('true when any payment is UNDER_REVIEW', () => {
		const order = makeOrder([{ payment_state: 'UNDER_REVIEW', method: 'cash', amount: 500 }], 0);
		expect(hasUnderReviewPayment(order)).toBe(true);
	});

	it('true when a completed payment coexists with an under-review slip', () => {
		const order = makeOrder(
			[
				{ payment_state: 'COMPLETED', method: 'cash', amount: 360 },
				{ payment_state: 'UNDER_REVIEW', method: 'bankTransfer', amount: 1000 }
			],
			360
		);
		expect(hasUnderReviewPayment(order)).toBe(true);
	});

	it('false when there are no payments', () => {
		expect(hasUnderReviewPayment(makeOrder([], 0))).toBe(false);
	});

	it('false when all payments are COMPLETED / REJECTED', () => {
		const order = makeOrder(
			[
				{ payment_state: 'COMPLETED', method: 'cash', amount: 360 },
				{ payment_state: 'REJECTED', method: 'bankTransfer', amount: 1000 }
			],
			360
		);
		expect(hasUnderReviewPayment(order)).toBe(false);
	});
});

describe('cancelToastKey', () => {
	it('maps unpaid -> success toast key', () => {
		expect(cancelToastKey('unpaid')).toBe('patona-sellercenter-orderdetail-toast-canceled-success');
	});

	it('maps cash -> cash toast key', () => {
		expect(cancelToastKey('cash')).toBe('patona-sellercenter-orderdetail-toast-canceled-cash');
	});

	it('maps transfer -> transfer toast key', () => {
		expect(cancelToastKey('transfer')).toBe('patona-sellercenter-orderdetail-toast-canceled-transfer');
	});
});
