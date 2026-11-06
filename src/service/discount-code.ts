import type { DiscountCode } from '$lib/entities/discount/discount-code';
import type { discountType } from '$stores/cart';

/**
 * Discount codes have no backend yet — there is no coupon/promotion endpoint anywhere in
 * management (grep: no /coupon, /promotion, /discount-code), and an order records a
 * discount only as a raw PricingDetail the cashier typed. This module is the single seam
 * that will become that API call: everything else in the app asks it, never a table.
 *
 * Until the endpoint exists it answers `unsupported` on a real backend, and resolves from
 * the catalogue below only inside the offline review shell (VITE_MOCK_API), so a code can
 * be designed and demoed without a build ever pretending a code was verified.
 */
export type DiscountCodeResult =
	| { status: 'ok'; code: string; type: discountType; value: number; label: string }
	| { status: 'not_found' }
	| { status: 'expired' }
	| { status: 'not_eligible'; message: string }
	| { status: 'min_spend_not_met'; minSpend: number }
	| { status: 'unsupported' };

/** Who a code is being looked up / listed for — the context an eligibility check needs. */
export interface DiscountCodeContext {
	storeId?: string;
	customerId?: string;
	/** Customer's membership tier, if known (e.g. "Platinum") — used against `requiredTier`. */
	customerTier?: string;
	/** Current cart subtotal, for `minSpend` codes. */
	subtotal?: number;
}

// Review fixtures only — never consulted against a real backend. Store-wide codes any
// cashier can use, plus codes scoped to a specific customer or membership tier so the
// "member-only coupon" flow has something real to demo.
const MOCK_CODES: DiscountCode[] = [
	{ code: 'SAVE10', type: 'percentage', value: 10, label: 'ลด 10%', audience: 'all' },
	{ code: 'SAVE20', type: 'percentage', value: 20, label: 'ลด 20%', audience: 'all' },
	{ code: 'HALF', type: 'percentage', value: 50, label: 'ลดครึ่งราคา', audience: 'all' },
	{ code: 'CASH50', type: 'fixed', value: 50, label: 'ลด 50 บาท', audience: 'all' },
	{
		code: 'CASH100',
		type: 'fixed',
		value: 100,
		label: 'ลด 100 บาท (ซื้อครบ 500)',
		audience: 'all',
		minSpend: 500
	},
	// Deliberately expired, so the error path has something real to exercise.
	{
		code: 'OLDCODE',
		type: 'percentage',
		value: 15,
		label: 'โค้ดเก่า',
		audience: 'all',
		expiresAt: '2020-01-01T00:00:00Z'
	},
	// Customer-restricted — only a Platinum member (or whoever's id is listed) can use it.
	{
		code: 'PLATINUM15',
		type: 'percentage',
		value: 15,
		label: 'สิทธิพิเศษสมาชิก Platinum',
		audience: 'customer',
		requiredTier: 'Platinum'
	},
	{
		code: 'VIP1ONLY',
		type: 'fixed',
		value: 150,
		label: 'คูปองส่วนตัวของลูกค้า',
		audience: 'customer',
		eligibleCustomerIds: ['1']
	}
];

// Mock-only membership lookup, keyed by customer-book `id` (stringified). There is no
// membership-tier field on the real Customer entity/backend yet, so this stays local to
// the discount demo instead of pretending customer-book-v2 already returns one.
const MOCK_CUSTOMER_TIERS: Record<string, string> = {
	'1': 'Platinum'
};

export const mockCustomerTier = (customerId?: string): string | undefined =>
	customerId ? MOCK_CUSTOMER_TIERS[customerId] : undefined;

/** True only where a code can actually be resolved — see the note above. */
export const canResolveDiscountCode = (): boolean => !!import.meta.env.VITE_MOCK_API;

export const normalizeDiscountCode = (raw: string): string => raw.trim().toUpperCase();

const isExpired = (c: DiscountCode): boolean => !!c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();

const isEligible = (c: DiscountCode, ctx: DiscountCodeContext): boolean => {
	if (c.audience === 'all') return true;
	if (c.requiredTier) return ctx.customerTier === c.requiredTier;
	if (c.eligibleCustomerIds) return !!ctx.customerId && c.eligibleCustomerIds.includes(ctx.customerId);
	return false;
};

const eligibilityMessage = (c: DiscountCode): string => {
	if (c.requiredTier) return `คูปองนี้ใช้ได้เฉพาะสมาชิก ${c.requiredTier}`;
	return 'คูปองนี้ไม่ใช่ของลูกค้าคนนี้';
};

/**
 * Store's available coupons for the given context: every store-wide code, plus any
 * customer-specific code the selected customer is eligible for. Walk-in / no customer
 * selected sees store-wide codes only. Expired codes never surface here.
 *
 * TODO(management API): replace this with a GET to the (not-yet-built) discount-code
 * endpoint, e.g. `management.get('/stores/{storeId}/discount-codes', { params: { customerId } })`.
 */
export const listAvailableDiscountCodes = async (ctx: DiscountCodeContext = {}): Promise<DiscountCode[]> => {
	if (!canResolveDiscountCode()) return [];

	return MOCK_CODES.filter((c) => !isExpired(c) && isEligible(c, ctx));
};

export const lookupDiscountCode = async (
	raw: string,
	ctx: DiscountCodeContext = {}
): Promise<DiscountCodeResult> => {
	const code = normalizeDiscountCode(raw);
	if (!code) return { status: 'not_found' };

	if (!canResolveDiscountCode()) return { status: 'unsupported' };

	const found = MOCK_CODES.find((c) => c.code === code);
	if (!found) return { status: 'not_found' };
	if (isExpired(found)) return { status: 'expired' };
	if (!isEligible(found, ctx)) return { status: 'not_eligible', message: eligibilityMessage(found) };
	if (found.minSpend && (ctx.subtotal ?? 0) < found.minSpend) {
		return { status: 'min_spend_not_met', minSpend: found.minSpend };
	}

	return { status: 'ok', code: found.code, type: found.type, value: found.value, label: found.label };
};

export type DiscountCodeSuggestion = { code: string; label: string };

// As the cashier types, surface any code (from the same eligible list) that starts with
// what's typed so far — tappable, so they don't have to remember/type the whole thing
// once it's recognizable. An empty/blank prefix matches everything (every string starts
// with ""), which is deliberate: the idle "คูปองที่ใช้ได้" list is this same list before
// anything has been typed, not a separate catalogue.
export const suggestDiscountCodes = (
	raw: string,
	available: DiscountCode[]
): DiscountCodeSuggestion[] => {
	const prefix = normalizeDiscountCode(raw);
	return available.filter((c) => c.code.startsWith(prefix)).map((c) => ({ code: c.code, label: c.label }));
};

export const discountCodeMessage = (result: DiscountCodeResult): string => {
	switch (result.status) {
		case 'ok':
			return `ใช้รหัส ${result.code} — ${result.label}`;
		case 'expired':
			return 'รหัสนี้หมดอายุแล้ว';
		case 'not_eligible':
			return result.message;
		case 'min_spend_not_met':
			return `ยอดซื้อขั้นต่ำ ฿${result.minSpend}`;
		case 'unsupported':
			return 'ยังไม่เปิดใช้งาน — รอระบบรหัสส่วนลดจากหลังบ้าน';
		case 'not_found':
		default:
			return 'ไม่พบรหัสนี้';
	}
};
