import { describe, it, expect } from 'vitest';
import { resolveOrderFlow } from './order-flow';
import { FullfilmentType, OrderFlow } from '$lib/entities/order/order';

describe('resolveOrderFlow', () => {
	it('online + sukipay → POS_ONLINE_SUKIPAY_V1 regardless of fulfillment', () => {
		expect(
			resolveOrderFlow({
				isSukipay: true,
				isOnline: true,
				fullfilmentType: FullfilmentType.ShopDelivery,
				hasBuyer: true,
				isDeliveryLater: false
			})
		).toBe(OrderFlow.POS_ONLINE_SUKIPAY_V1);
	});

	it('offline + sukipay + pickup-immediate → offline pickup-instant flow (unchanged)', () => {
		expect(
			resolveOrderFlow({
				isSukipay: true,
				isOnline: false,
				fullfilmentType: FullfilmentType.PickupImmediate,
				hasBuyer: false,
				isDeliveryLater: false
			})
		).toBe(OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_INSTANT_V1);
	});

	it('non-sukipay → offline flows (unchanged)', () => {
		expect(
			resolveOrderFlow({
				isSukipay: false,
				isOnline: true,
				fullfilmentType: FullfilmentType.PickupImmediate,
				hasBuyer: true,
				isDeliveryLater: true
			})
		).toBe(OrderFlow.POS_OFFLINE_DELIVERY_LATER);
	});
});
