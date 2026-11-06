import type { discountType } from '$stores/cart';

/**
 * A coupon/discount code as the (future) management API will shape it. There is no
 * endpoint yet — see src/service/discount-code.ts — so this interface is the contract
 * that seam will fill in, not a type generated from a real response.
 */
export interface DiscountCode {
	code: string;
	label: string;
	type: discountType;
	value: number;
	/** Minimum cart subtotal (บาท) required to use the code, if any. */
	minSpend?: number;
	/** ISO datetime; past this, the code is expired. */
	expiresAt?: string;
	/** Who can use it — every customer, or only the ones named/tiered below. */
	audience: 'all' | 'customer';
	/** Specific customer ids this code belongs to (customer-book `id`, stringified). */
	eligibleCustomerIds?: string[];
	/** Membership tier required, e.g. "Platinum" — matched against the customer's own tier. */
	requiredTier?: string;
}
