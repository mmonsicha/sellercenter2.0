import { describe, expect, it } from 'vitest';
import {
	ChannelGroup,
	FulfillmentType,
	Oms2Tab,
	StockState
} from '$lib/entities/order/oms2-order-list';
import {
	ORDER_TABS,
	channelGroupTheme,
	fulfillmentBadges,
	fulfillmentDisplay,
	stockKey,
	toOms2Tab
} from '$pages/order/list/order-tab';

describe('order-tab presentation', () => {
	it('has 5 tabs in spec order', () => {
		expect(ORDER_TABS.map((t) => t.tab)).toEqual([
			Oms2Tab.All,
			Oms2Tab.InProgress,
			Oms2Tab.Completed,
			Oms2Tab.Refund,
			Oms2Tab.Cancelled
		]);
	});

	it('legacy tab values fall back to All', () => {
		expect(toOms2Tab('process')).toBe(Oms2Tab.All);
		expect(toOms2Tab('refund')).toBe(Oms2Tab.Refund);
	});

	it('channel groups map to 3 distinct colours', () => {
		const c = Object.values(ChannelGroup).map(channelGroupTheme);
		expect(new Set(c).size).toBe(3);
	});

	it('fulfillment display', () => {
		expect(fulfillmentDisplay({ types: [FulfillmentType.Shipping], shippingGroups: 2 })).toEqual({
			key: 'oms.order.fulfillment.shipping'
		});
		expect(
			fulfillmentDisplay({
				types: [FulfillmentType.Digital, FulfillmentType.Service],
				shippingGroups: 0
			})
		).toEqual({ key: 'oms.order.fulfillment.multi', count: 2 });
		expect(fulfillmentDisplay({ types: [FulfillmentType.Digital], shippingGroups: 0 })).toEqual({
			key: 'oms.order.fulfillment.digital'
		});
		expect(fulfillmentDisplay({ types: [], shippingGroups: 0 }).key).toBe('');
	});

	it('stock keys', () => {
		expect(stockKey(StockState.Partial)).toBe('oms.order.stock.partial');
	});
});

describe('fulfillmentBadges', () => {
	it('one badge per method in data order, no address-group count', () => {
		const b = fulfillmentBadges({
			types: [FulfillmentType.PickupLater, FulfillmentType.Shipping, FulfillmentType.Digital],
			shippingGroups: 2
		});
		expect(b.map((x) => x.type)).toEqual([
			FulfillmentType.PickupLater,
			FulfillmentType.Shipping,
			FulfillmentType.Digital
		]);
		expect(b.every((x) => !('groups' in x))).toBe(true);
		expect(b[1].icon).toBe('outline-truck');
	});
});

describe('channelColor', () => {
	it('uses brand colour for online sub-channels and DS tokens otherwise', async () => {
		const { channelColor } = await import('$pages/order/list/order-tab');
		expect(
			channelColor({ id: 'a', name: 'LINE', group: ChannelGroup.Online, source: 'line' })
		).toBe('#06C755');
		expect(
			channelColor({ id: 'b', name: 'Shopee', group: ChannelGroup.Online, source: 'shopee' })
		).toBe('#EE4D2D');
		expect(channelColor({ id: 'c', name: 'POS', group: ChannelGroup.Store })).toContain(
			'--ssk-colors-gray'
		); // PO U8: neutral, never Shopee-orange
		expect(
			channelColor({ id: 'd', name: '?', group: ChannelGroup.Online, source: 'new-one' })
		).toContain('gray');
	});
});
