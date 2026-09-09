import { describe, it, expect } from 'vitest';
import { getOrderTracking } from './orderHandler';
import { Status, type Order, type Task } from '$lib/entities/order/order';
import { PaymentTxnState } from '$lib/entities/payment/payment-transaction';

function orderWith(tasks: Task[], state: string): Order {
	return {
		orderId: 'o1',
		orderSerial: 'SO1234',
		flow: { type: 'POS-ONLINE-SUKIPAY-V1' },
		buyer: { name: 'buyer' },
		items: [],
		buyerStatement: { totalPrice: 0, netPrice: 0, receivedAmount: 0 },
		state,
		status: Status.Canceled,
		createdAt: '2026-07-02T00:00:00Z',
		tasks
	};
}

describe('getOrderTracking — paid-cancel refund step', () => {
	it('adds a refund step for a COMPENSATED payment at the unified terminal canceled:canceled', () => {
		// Under the final flow the paid-cancel finalizes to canceled:canceled and the
		// payments task status is overwritten to canceled — the only durable signal is
		// the COMPENSATED marker in attributes.
		const tasks: Task[] = [
			{
				name: 'payments',
				status: Status.Canceled,
				state: 'canceled',
				canceledAt: '2026-07-02T01:00:00Z',
				attributes: { transaction_state: PaymentTxnState.COMPENSATED }
			},
			{ name: 'delivery', status: Status.Canceled, state: 'canceled' }
		];

		const t = getOrderTracking(orderWith(tasks, 'canceled:canceled'));
		const names = (t.tasks ?? []).map((x) => x.name);

		expect(names).toContain('refund');
		// payments is shown as the completed "money-in" step, refund as the "money-out" step
		const payments = t.tasks?.find((x) => x.name === 'payments');
		expect(payments?.status).toBe(Status.Completed);
		expect(payments?.canceledAt).toBeUndefined();
	});

	it('does NOT add a refund step for an unpaid cancel (no COMPENSATED marker)', () => {
		const tasks: Task[] = [
			{
				name: 'payments',
				status: Status.Canceled,
				state: 'canceled',
				attributes: { transaction_state: PaymentTxnState.CANCELLED }
			},
			{ name: 'delivery', status: Status.Canceled, state: 'canceled' }
		];

		const t = getOrderTracking(orderWith(tasks, 'canceled:canceled'));
		expect((t.tasks ?? []).map((x) => x.name)).not.toContain('refund');
	});

	it('still handles the legacy refunded:canceled composite', () => {
		const tasks: Task[] = [
			{
				name: 'payments',
				status: Status.Canceled,
				state: 'refunded',
				canceledAt: '2026-07-02T01:00:00Z'
			},
			{ name: 'delivery', status: Status.Canceled, state: 'canceled' }
		];

		const t = getOrderTracking(orderWith(tasks, 'refunded:canceled'));
		expect((t.tasks ?? []).map((x) => x.name)).toContain('refund');
	});
});
