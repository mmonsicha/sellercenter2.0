import { describe, expect, it } from 'vitest';
import {
	ChannelGroup,
	FulfillmentType,
	Oms2OrderStatus,
	Oms2PaymentStatus,
	Oms2Tab,
	fulfillmentLabel,
	toOrderStatus
} from '$lib/entities/order/oms2-order-list';
import { MOCK_OMS2_ORDERS, mockOms2Channels, queryOms2Orders } from '$lib/mock/mock-oms2-orders';

const base = { tab: Oms2Tab.All, page: 1, rows: 50, sort: 'desc' as const };

describe('queryOms2Orders', () => {
	it('tab counts add up and unknown only lives in All', () => {
		const r = queryOms2Orders(base);
		const c = r.tabCounts;
		expect(c.all).toBe(MOCK_OMS2_ORDERS.length);
		expect(c.in_progress + c.completed + c.refund + c.cancelled + r.unknownCount).toBe(c.all);
		expect(r.unknownCount).toBe(1);
	});

	it('refund tab holds reversed and refunded', () => {
		const r = queryOms2Orders({ ...base, tab: Oms2Tab.Refund });
		expect(r.rows.map((o) => o.status).sort()).toEqual([
			Oms2OrderStatus.Refunded,
			Oms2OrderStatus.Reversed
		]);
	});

	it('filters apply to tab counts too', () => {
		const r = queryOms2Orders({ ...base, paymentStatuses: [Oms2PaymentStatus.CodPending] });
		expect(r.total).toBe(1);
		expect(r.tabCounts.in_progress).toBe(1);
		expect(r.tabCounts.completed).toBe(0);
	});

	it('fulfillment filter matches any type on multi-method orders', () => {
		const r = queryOms2Orders({ ...base, fulfillments: [FulfillmentType.Digital] });
		expect(r.rows.length).toBeGreaterThan(1);
		expect(r.rows.every((o) => o.fulfillment.types.includes(FulfillmentType.Digital))).toBe(true);
		expect(r.rows.map((o) => o.id)).toEqual(expect.arrayContaining(['o4', 'o6']));
	});

	it('paginates and sorts', () => {
		const total = MOCK_OMS2_ORDERS.length;
		const lastPage = Math.ceil(total / 5);
		const p1 = queryOms2Orders({ ...base, rows: 5, sort: 'asc' });
		const pLast = queryOms2Orders({ ...base, rows: 5, page: lastPage, sort: 'asc' });
		expect(p1.rows).toHaveLength(5);
		expect(pLast.rows).toHaveLength(total - (lastPage - 1) * 5);
		expect(p1.rows[0].createdAt <= p1.rows[1].createdAt).toBe(true);
	});

	it('search matches serial or customer', () => {
		expect(queryOms2Orders({ ...base, search: '0003' }).total).toBe(1);
		expect(queryOms2Orders({ ...base, search: 'kanda' }).total).toBe(1);
	});

	it('channels come from data and cover the sale page channels', () => {
		const ch = mockOms2Channels();
		// POS (one per branch; list is branch-scoped) + 9 online sub-channels + ลิงก์
		expect(ch.length).toBe(11);
		expect(new Set(ch.map((c) => c.group))).toEqual(
			new Set([ChannelGroup.Store, ChannelGroup.Online, ChannelGroup.Link])
		);
		expect(ch.filter((c) => c.group === ChannelGroup.Online && c.logo).length).toBe(8);
	});
});

describe('PO coverage set', () => {
	const all = MOCK_OMS2_ORDERS;

	it('every fulfillment type appears alone and in a mix', () => {
		for (const t of Object.values(FulfillmentType)) {
			expect(
				all.some((o) => o.fulfillment.types.length === 1 && o.fulfillment.types[0] === t)
			).toBe(true);
			expect(
				all.some((o) => o.fulfillment.types.length > 1 && o.fulfillment.types.includes(t))
			).toBe(true);
		}
		expect(all.some((o) => o.fulfillment.types.length === 5)).toBe(true);
	});

	it('every channel group carries a multi-method order', () => {
		for (const g of Object.values(ChannelGroup))
			expect(all.some((o) => o.channel.group === g && o.fulfillment.types.length > 1)).toBe(true);
	});

	it('every order and payment status appears', () => {
		for (const s of Object.values(Oms2OrderStatus))
			expect(all.some((o) => o.status === s)).toBe(true);
		for (const p of Object.values(Oms2PaymentStatus))
			expect(all.some((o) => o.paymentStatus === p)).toBe(true);
	});
});

describe('helpers', () => {
	it('fulfillmentLabel', () => {
		expect(
			fulfillmentLabel({
				types: [FulfillmentType.Shipping, FulfillmentType.Digital],
				shippingGroups: 1
			})
		).toEqual({ kind: 'multi', count: 2 });
		expect(fulfillmentLabel({ types: [FulfillmentType.Shipping], shippingGroups: 3 })).toEqual({
			kind: 'groups',
			count: 3
		});
		expect(fulfillmentLabel({ types: [FulfillmentType.PickupNow], shippingGroups: 0 })).toEqual({
			kind: 'single',
			type: FulfillmentType.PickupNow
		});
		expect(fulfillmentLabel({ types: [], shippingGroups: 0 })).toEqual({ kind: 'none' });
	});

	it('toOrderStatus falls back to unknown', () => {
		expect(toOrderStatus('delivering')).toBe(Oms2OrderStatus.Delivering);
		expect(toOrderStatus('weird')).toBe(Oms2OrderStatus.Unknown);
		expect(toOrderStatus(undefined)).toBe(Oms2OrderStatus.Unknown);
	});
});

describe('date range', () => {
	it('end date includes the whole day', () => {
		const target = MOCK_OMS2_ORDERS.find((o) => o.id === 'o1')!; // created "today" 03:15Z
		const day = target.createdAt.slice(0, 10);
		const r = queryOms2Orders({
			...base,
			startDate: `${day}T00:00:00.000Z`,
			endDate: `${day}T00:00:00.000Z`
		});
		expect(r.rows.map((o) => o.id)).toContain('o1');
	});
});
