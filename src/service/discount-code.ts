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
	| { status: 'unsupported' };

type MockCode = { type: discountType; value: number; label: string; expired?: boolean };

// Review fixtures only — never consulted against a real backend.
const MOCK_CODES: Record<string, MockCode> = {
	SAVE10: { type: 'percentage', value: 10, label: 'ลด 10%' },
	SAVE20: { type: 'percentage', value: 20, label: 'ลด 20%' },
	HALF: { type: 'percentage', value: 50, label: 'ลดครึ่งราคา' },
	CASH50: { type: 'fixed', value: 50, label: 'ลด 50 บาท' },
	CASH100: { type: 'fixed', value: 100, label: 'ลด 100 บาท' },
	// Deliberately expired, so the error path has something real to exercise.
	OLDCODE: { type: 'percentage', value: 15, label: 'โค้ดเก่า', expired: true }
};

/** True only where a code can actually be resolved — see the note above. */
export const canResolveDiscountCode = (): boolean => !!import.meta.env.VITE_MOCK_API;

export const normalizeDiscountCode = (raw: string): string => raw.trim().toUpperCase();

export const lookupDiscountCode = async (raw: string): Promise<DiscountCodeResult> => {
	const code = normalizeDiscountCode(raw);
	if (!code) return { status: 'not_found' };

	if (!canResolveDiscountCode()) return { status: 'unsupported' };

	const found = MOCK_CODES[code];
	if (!found) return { status: 'not_found' };
	if (found.expired) return { status: 'expired' };

	return { status: 'ok', code, type: found.type, value: found.value, label: found.label };
};

export type DiscountCodeSuggestion = { code: string; label: string };

// As the cashier types, surface any ACTIVE code that starts with what's typed so far —
// tappable, so they don't have to remember/type the whole thing once it's recognizable.
// An empty/blank prefix matches everything (every string starts with ""), which is
// deliberate: the coupon tab's idle "ลองโค้ดตัวอย่าง" row is this same list before
// anything has been typed, not a separate catalogue — typing then narrows the same row
// instead of swapping it out for a different one. Expired codes never suggest themselves
// (tapping one would just land on "หมดอายุแล้ว", which isn't a suggestion so much as a
// trap); same `canResolveDiscountCode` gate as lookupDiscountCode — there is nothing to
// suggest against until a real backend exists.
export const suggestDiscountCodes = (raw: string): DiscountCodeSuggestion[] => {
	const prefix = normalizeDiscountCode(raw);
	if (!canResolveDiscountCode()) return [];

	return Object.entries(MOCK_CODES)
		.filter(([code, info]) => !info.expired && code.startsWith(prefix))
		.map(([code, info]) => ({ code, label: info.label }));
};

export const discountCodeMessage = (result: DiscountCodeResult): string => {
	switch (result.status) {
		case 'ok':
			return `ใช้รหัส ${result.code} — ${result.label}`;
		case 'expired':
			return 'รหัสนี้หมดอายุแล้ว';
		case 'unsupported':
			return 'ยังไม่เปิดใช้งาน — รอระบบรหัสส่วนลดจากหลังบ้าน';
		case 'not_found':
		default:
			return 'ไม่พบรหัสนี้';
	}
};
