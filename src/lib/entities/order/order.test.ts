import { describe, it, expect } from 'vitest';
import { isSukipayFlow, OrderFlow } from './order';

describe('isSukipayFlow', () => {
	it('is true for every current SukiPay flow', () => {
		for (const flow of [
			OrderFlow.POS_ONLINE_SUKIPAY_V1,
			OrderFlow.POS_OFFLINE_SUKIPAY_DELIVER_FROM_STORE_V1,
			OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_INSTANT_V1,
			OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_LATER_V1
		]) {
			expect(isSukipayFlow(flow)).toBe(true);
		}
	});

	it('is false for every legacy flow', () => {
		for (const flow of [
			OrderFlow.POS_OFFLINE,
			OrderFlow.POS_OFFLINE_DELIVERY_LATER,
			OrderFlow.POS_ONLINE
		]) {
			expect(isSukipayFlow(flow)).toBe(false);
		}
	});

	it('covers a future SukiPay flow named by the "-SUKIPAY-" convention without a code change', () => {
		expect(isSukipayFlow('POS-ONLINE-SUKIPAY-V2')).toBe(true);
		expect(isSukipayFlow('POS-OFFLINE-SUKIPAY-SOME-NEW-VARIANT-V1')).toBe(true);
	});

	it('is false for undefined / empty / unknown non-sukipay flow', () => {
		expect(isSukipayFlow(undefined)).toBe(false);
		expect(isSukipayFlow('')).toBe(false);
		expect(isSukipayFlow('POS-ONLINE-SOMETHING-ELSE')).toBe(false);
	});
});
