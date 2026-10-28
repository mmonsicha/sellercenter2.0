import { describe, it, expect } from 'vitest';
import {
	getBadgeOrderStatus,
	deliveryMethodLabel,
	getDeliveryMethod,
	getOrderRowAction,
	mapOrderPayment,
	mapOrderStateForDeliveryCompleteByFlow,
	mapOrderStateForPaymentCompleteByFlow,
	orderDisplayStatus,
	OrderRowActionKind,
	shouldUseSukipayOnline,
	totalShippingFee
} from './utils-order';
import { orderStatusI18nKey } from './i18n-keys';
import {
	OrderFlow,
	PaymentType,
	ShippingType,
	Status,
	type Order,
	type Task
} from '$lib/entities/order/order';
import { PaymentMode } from '$lib/entities/configuration/configuration';

// Build a payments task with raw (snake_case) payment entries, mirroring the
// shape OMS projects into task.attributes.
const paymentsTask = (
	status: string,
	payments: Array<{ payment_id: string; payment_state: string; amount: number }>,
	attributesAsString = false
): Task => {
	const attributes = { payments };
	return {
		name: 'payments',
		status,
		attributes: attributesAsString ? (JSON.stringify(attributes) as unknown as Task['attributes']) : attributes
	};
};

describe('mapOrderStateForDeliveryCompleteByFlow', () => {
	it('online sukipay flow delivers to paid:shipped', () => {
		// regression: POS-ONLINE-SUKIPAY-V1 must resolve to a real graph edge
		// (paid:not_deliver -> paid:shipped); returning '' made the deliver
		// handler bail before ever calling the API.
		expect(mapOrderStateForDeliveryCompleteByFlow(OrderFlow.POS_ONLINE_SUKIPAY_V1)).toBe(
			'paid:shipped'
		);
	});

	it('POS_ONLINE still delivers to paid:shipped', () => {
		expect(mapOrderStateForDeliveryCompleteByFlow(OrderFlow.POS_ONLINE)).toBe('paid:shipped');
	});

	it('offline sukipay deliver-from-store delivers to paid:delivered', () => {
		// regression: POS-OFFLINE-SUKIPAY-DELIVER-FROM-STORE-V1 fell to the default ''
		// case, so the deliver handler bailed before calling updateState.
		expect(
			mapOrderStateForDeliveryCompleteByFlow(OrderFlow.POS_OFFLINE_SUKIPAY_DELIVER_FROM_STORE_V1)
		).toBe('paid:delivered');
	});

	it('offline sukipay pickup-instant completes to paid:pickedup_at_store', () => {
		expect(
			mapOrderStateForDeliveryCompleteByFlow(OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_INSTANT_V1)
		).toBe('paid:pickedup_at_store');
	});

	it('offline sukipay pickup-later completes to paid:pickedup', () => {
		// distinct from pickup-instant: later pickup uses paid:pickedup, not
		// paid:pickedup_at_store.
		expect(
			mapOrderStateForDeliveryCompleteByFlow(OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_LATER_V1)
		).toBe('paid:pickedup');
	});

	it('unknown flow returns empty string', () => {
		expect(mapOrderStateForDeliveryCompleteByFlow('SOMETHING-ELSE')).toBe('');
	});
});

describe('mapOrderStateForPaymentCompleteByFlow', () => {
	it('online sukipay flow completes payment to paid:not_deliver', () => {
		expect(mapOrderStateForPaymentCompleteByFlow(OrderFlow.POS_ONLINE_SUKIPAY_V1)).toBe(
			'paid:not_deliver'
		);
	});
});

describe('mapOrderPayment - under_review dominates the list badge', () => {
	// PAT-2295 regression: rejecting one of two concurrent UNDER_REVIEW slips must
	// not flip the order badge to "partially_paid" while the other slip is still
	// under review. OMS projects the money position (partial_completed), so the FE
	// re-derives: any slip still UNDER_REVIEW → show under_review.
	it('reject leaves a remaining under-review slip → badge stays under_review', () => {
		const tasks = [
			paymentsTask('partial_completed', [
				{ payment_id: 'pay-1', payment_state: 'REJECTED', amount: 150 },
				{ payment_id: 'pay-2', payment_state: 'UNDER_REVIEW', amount: 150 }
			])
		];
		const got = mapOrderPayment(tasks, PaymentType.BankTransfer);
		expect(got.status).toBe(Status.Processing);
		expect(got.label).toBe('payment.status.under_review');
	});

	it('no slip under review → passes the OMS status through (partial_completed)', () => {
		const tasks = [
			paymentsTask('partial_completed', [
				{ payment_id: 'pay-1', payment_state: 'COMPLETED', amount: 150 },
				{ payment_id: 'pay-2', payment_state: 'REJECTED', amount: 150 }
			])
		];
		const got = mapOrderPayment(tasks, PaymentType.BankTransfer);
		expect(got.status).toBe(Status.PartialCompleted);
		expect(got.label).toBe('payment.status.partially_paid');
	});

	it('completed is terminal → never overridden by a stray under-review entry', () => {
		const tasks = [
			paymentsTask('completed', [
				{ payment_id: 'pay-1', payment_state: 'UNDER_REVIEW', amount: 150 }
			])
		];
		expect(mapOrderPayment(tasks, PaymentType.BankTransfer).status).toBe(Status.Completed);
	});

	it('attributes delivered as a JSON string are parsed too', () => {
		const tasks = [
			paymentsTask(
				'partial_completed',
				[{ payment_id: 'pay-2', payment_state: 'UNDER_REVIEW', amount: 150 }],
				true
			)
		];
		expect(mapOrderPayment(tasks, PaymentType.BankTransfer).status).toBe(Status.Processing);
	});
});

describe('mapOrderPayment - a canceled order is terminal, never "waiting for payment"', () => {
	// PAT-2038 regression: a canceled order whose payment was never collected
	// (transaction still PENDING, no slips) used to fall through to the yellow
	// "รอชำระเงิน" badge. A canceled payment is terminal — void, not pending.
	const canceledTask = (state: string): Task[] =>
		[
			{ name: 'payments', status: 'canceled', state, attributes: { payments: [] } }
		] as unknown as Task[];

	it('canceled + never paid → voided label + gray (canceled) badge, NOT waiting', () => {
		const got = mapOrderPayment(canceledTask('canceled'), PaymentType.SukiPay);
		expect(got.status).toBe(Status.Canceled);
		expect(got.label).toBe('payment.status.voided');
	});

	it('canceled + money returned → refunded label (terminal)', () => {
		const got = mapOrderPayment(canceledTask('refunded'), PaymentType.SukiPay);
		expect(got.status).toBe(Status.Canceled);
		expect(got.label).toBe('patona-sellercenter-badge-paymentstatus-refunded');
	});

	it('active unpaid order still shows waiting-for-payment (pending path untouched)', () => {
		const tasks = [
			{ name: 'payments', status: 'pending', attributes: { payments: [] } }
		] as unknown as Task[];
		const got = mapOrderPayment(tasks, PaymentType.SukiPay);
		expect(got.status).toBe(Status.Pending);
		expect(got.label).toBe('patona-sellercenter-badge-paymentstatus-waitingforpayment');
	});
});

describe('getOrderRowAction - follows OMS money position (non-rejected coverage)', () => {
	// The button reads the OMS-projected payments-task status (which counts
	// UNDER_REVIEW as submitted money); order.status only gates terminal/refund.
	const orderWith = (orderStatus: string, paymentStatus: string): Order =>
		({
			status: orderStatus,
			flow: { type: OrderFlow.POS_ONLINE_SUKIPAY_V1 },
			tasks: [{ name: 'payments', status: paymentStatus }]
		}) as unknown as Order;

	it('nothing submitted (pending) → Pay', () => {
		expect(getOrderRowAction(orderWith(Status.Pending, 'pending')).kind).toBe(OrderRowActionKind.Pay);
	});

	// order 078 / case 2: partial coverage → still owes → PayMore.
	it('partial coverage (partial_completed) → PayMore', () => {
		expect(getOrderRowAction(orderWith(Status.PartialCompleted, 'partial_completed')).kind).toBe(
			OrderRowActionKind.PayMore
		);
	});

	// case 1: full amount submitted but a slip still under review → nothing to
	// collect (OMS = processing) → View, NOT Pay.
	it('fully covered, a slip under review (processing) → View', () => {
		expect(getOrderRowAction(orderWith(Status.Processing, 'processing')).kind).toBe(
			OrderRowActionKind.View
		);
	});

	it('fully paid, delivery pending (task completed) → Deliver', () => {
		expect(getOrderRowAction(orderWith(Status.Processing, 'completed')).kind).toBe(
			OrderRowActionKind.Deliver
		);
	});

	// Refund/void is a separate card (PAT-2038) — a refunding order must not offer
	// a pay button. Guarded via order.status.
	it('refunding order → View (refund handled by PAT-2038)', () => {
		expect(getOrderRowAction(orderWith('refunding', 'refunding')).kind).toBe(OrderRowActionKind.View);
	});
});

describe('orderDisplayStatus - order badge reflects confirmed (approved) money', () => {
	const orderWith = (
		orderStatus: string,
		total: number,
		slips: Array<{ state: string; amount: number }>,
		asString = false
	): Order =>
		({
			status: orderStatus,
			flow: { type: OrderFlow.POS_ONLINE_SUKIPAY_V1 },
			// netPrice = amount owed (after discounts); the badge coverage math uses it.
			buyerStatement: { netPrice: total },
			tasks: [
				paymentsTask(
					'',
					slips.map((s, i) => ({ payment_id: `pay-${i}`, payment_state: s.state, amount: s.amount })),
					asString
				)
			]
		}) as unknown as Order;

	// Rejected-2 regression: approved 150 of 300, remaining 150 under review → OMS
	// coverage is full so it projects `processing`, but only 150 is confirmed, so the
	// badge must read ชำระบางส่วน until the full order total is approved.
	it('approved partial + remaining under review covers the total → partial_completed', () => {
		const order = orderWith('processing', 300, [
			{ state: 'COMPLETED', amount: 150 },
			{ state: 'UNDER_REVIEW', amount: 150 }
		]);
		expect(orderDisplayStatus(order)).toBe(Status.PartialCompleted);
		expect(orderStatusI18nKey(orderDisplayStatus(order))).toBe('payment.status.partially_paid');
	});

	// Discount regression: a 50%-off order owes net_price 64 on a gross total_Price
	// 128. Approving the full 64 (cash 1 + transfer 63) is fully paid, so the badge
	// must read `processing` (กำลังดำเนินการ), NOT `partially_paid`. Before the fix,
	// coverage was compared against the gross total → 64 < 128 → wrong partial badge.
	it('discounted order paid in full at net_price → processing, not partial_completed', () => {
		const order = {
			status: 'processing',
			flow: { type: OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_INSTANT_V1 },
			buyerStatement: { totalPrice: 128, netPrice: 64 },
			tasks: [
				paymentsTask('completed', [
					{ payment_id: 'p-cash', payment_state: 'COMPLETED', amount: 1 },
					{ payment_id: 'p-transfer', payment_state: 'COMPLETED', amount: 63 }
				])
			]
		} as unknown as Order;
		expect(orderDisplayStatus(order)).toBe(Status.Processing);
		expect(orderStatusI18nKey(orderDisplayStatus(order))).toBe(
			'patona-sellercenter-badge-orderstatus-inprogress'
		);
	});

	it('approved partial, coverage below total → partial_completed', () => {
		const order = orderWith('partial_completed', 300, [
			{ state: 'COMPLETED', amount: 100 },
			{ state: 'UNDER_REVIEW', amount: 150 }
		]);
		expect(orderDisplayStatus(order)).toBe(Status.PartialCompleted);
	});

	// nothing approved yet, a slip under review → in progress
	it('nothing approved, a slip under review → processing', () => {
		const order = orderWith('processing', 300, [
			{ state: 'REJECTED', amount: 150 },
			{ state: 'UNDER_REVIEW', amount: 150 }
		]);
		expect(orderDisplayStatus(order)).toBe(Status.Processing);
		expect(orderStatusI18nKey(orderDisplayStatus(order))).toBe(
			'patona-sellercenter-badge-orderstatus-inprogress'
		);
	});

	it('completed is terminal → never overridden', () => {
		const order = orderWith(Status.Completed, 300, [{ state: 'COMPLETED', amount: 300 }]);
		expect(orderDisplayStatus(order)).toBe(Status.Completed);
	});

	it('refunding passes through (refund badge handled by PAT-2038)', () => {
		const order = orderWith('refunding', 300, [{ state: 'VOIDED', amount: 300 }]);
		expect(orderDisplayStatus(order)).toBe('refunding');
	});

	it('refunded/voided are terminal → pass through with the canceled badge label', () => {
		const refunded = orderWith(Status.Refunded, 300, [{ state: 'REFUNDED', amount: 300 }]);
		expect(orderDisplayStatus(refunded)).toBe(Status.Refunded);
		expect(orderStatusI18nKey(orderDisplayStatus(refunded))).toBe(
			'patona-sellercenter-badge-orderstatus-canceled'
		);

		const voided = orderWith(Status.Voided, 300, [{ state: 'VOIDED', amount: 300 }]);
		expect(orderDisplayStatus(voided)).toBe(Status.Voided);
		expect(orderStatusI18nKey(orderDisplayStatus(voided))).toBe(
			'patona-sellercenter-badge-orderstatus-canceled'
		);
	});

	it('parses payments attributes delivered as a JSON string (production shape)', () => {
		const order = orderWith(
			'processing',
			300,
			[
				{ state: 'COMPLETED', amount: 150 },
				{ state: 'UNDER_REVIEW', amount: 150 }
			],
			true
		);
		expect(orderDisplayStatus(order)).toBe(Status.PartialCompleted);
	});
});

describe('getBadgeOrderStatus - terminal reversal statuses are neutral (gray)', () => {
	it('canceled/refunded/voided → gray', () => {
		expect(getBadgeOrderStatus(Status.Canceled)).toBe('gray');
		expect(getBadgeOrderStatus(Status.Refunded)).toBe('gray');
		expect(getBadgeOrderStatus(Status.Voided)).toBe('gray');
	});

	it('refunding (in-progress) → warning, completed → success', () => {
		expect(getBadgeOrderStatus(Status.Refunding)).toBe('warning');
		expect(getBadgeOrderStatus(Status.Completed)).toBe('success');
	});
});

describe('shouldUseSukipayOnline', () => {
	it('true only when SukiPay mode AND bank transfer', () => {
		expect(shouldUseSukipayOnline(PaymentMode.Sukipay, PaymentType.BankTransfer)).toBe(true);
	});

	it('false when SukiPay mode but method is not bank transfer', () => {
		expect(shouldUseSukipayOnline(PaymentMode.Sukipay, PaymentType.Cod)).toBe(false);
		expect(shouldUseSukipayOnline(PaymentMode.Sukipay, 'unknown')).toBe(false);
		expect(shouldUseSukipayOnline(PaymentMode.Sukipay, undefined)).toBe(false);
	});

	it('false when company is not in SukiPay mode', () => {
		expect(shouldUseSukipayOnline(undefined, PaymentType.BankTransfer)).toBe(false);
	});
});

// MULTI-DESTINATION-REWORK.md §3: read paths must sum every delivery's fee instead of
// only deliveries[0], so a row total does not silently drop real fees once the backend
// starts sending more than one delivery.
describe('totalShippingFee', () => {
	it('is 0 when the order has no deliveries at all', () => {
		expect(totalShippingFee({ deliveries: [] } as unknown as Order)).toBe(0);
		expect(totalShippingFee({} as unknown as Order)).toBe(0);
	});

	it('reads the single delivery unchanged — byte-identical to the old deliveries[0] read', () => {
		expect(totalShippingFee({ deliveries: [{ shippingFee: 40 }] } as unknown as Order)).toBe(40);
	});

	it('sums every delivery across a 3-delivery order', () => {
		const order = {
			deliveries: [{ shippingFee: 40 }, { shippingFee: 25 }, { shippingFee: 0 }]
		} as unknown as Order;
		expect(totalShippingFee(order)).toBe(65);
	});

	it('treats a missing shippingFee on any one delivery as 0, not NaN', () => {
		const order = {
			deliveries: [{ shippingFee: 40 }, {}, { shippingFee: 10 }]
		} as unknown as Order;
		expect(totalShippingFee(order)).toBe(50);
	});
});

describe('deliveryMethodLabel — more than one delivery', () => {
	it('names the count instead of describing only deliveries[0]', () => {
		const order = {
			deliveries: [{ type: ShippingType.Standard, method: 'flash' }, { type: ShippingType.SameDay }, {}]
		} as unknown as Order;
		expect(deliveryMethodLabel(order)).toBe('3 พัสดุ');
	});

	it('still names the courier when the order has a single delivery', () => {
		const order = {
			deliveries: [{ type: ShippingType.Standard, method: 'flash' }]
		} as unknown as Order;
		expect(deliveryMethodLabel(order)).toBe('Flash Express');
	});

	// getDeliveryMethod feeds DrawerChannel's selected option, so it must keep answering
	// with a real courier a cashier could have picked — never a synthetic "multiple",
	// which would be written back into the order on save.
	it('leaves getDeliveryMethod answering with the real courier option', () => {
		const order = {
			deliveries: [{ type: ShippingType.Standard, method: 'flash' }, { type: ShippingType.SameDay }]
		} as unknown as Order;
		expect(getDeliveryMethod(order)?.value).toBe('flash');
	});
});
