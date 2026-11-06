import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	canResolveDiscountCode,
	discountCodeMessage,
	listAvailableDiscountCodes,
	lookupDiscountCode,
	mockCustomerTier,
	normalizeDiscountCode,
	suggestDiscountCodes
} from './discount-code';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('normalizeDiscountCode', () => {
	it('trims and upper-cases, so a code typed however still matches', () => {
		expect(normalizeDiscountCode('  save10 ')).toBe('SAVE10');
	});
});

describe('lookupDiscountCode without a backend', () => {
	it('answers unsupported rather than "not found" — the code was never checked', () => {
		// The distinction is the whole point: "ไม่พบรหัสนี้" would tell a cashier the code
		// is wrong, when in fact nothing is able to verify it yet.
		vi.stubEnv('VITE_MOCK_API', '');
		expect(canResolveDiscountCode()).toBe(false);
		return expect(lookupDiscountCode('SAVE10')).resolves.toEqual({ status: 'unsupported' });
	});
});

describe('lookupDiscountCode in the offline review shell', () => {
	const inMockShell = () => vi.stubEnv('VITE_MOCK_API', 'true');

	it('resolves a percentage code to its type and value', async () => {
		inMockShell();
		await expect(lookupDiscountCode('save10')).resolves.toEqual({
			status: 'ok',
			code: 'SAVE10',
			type: 'percentage',
			value: 10,
			label: 'ลด 10%'
		});
	});

	it('resolves a baht code as a fixed amount, not a percentage', async () => {
		inMockShell();
		const result = await lookupDiscountCode('CASH50');
		expect(result).toMatchObject({ status: 'ok', type: 'fixed', value: 50 });
	});

	it('reports an expired code apart from an unknown one', async () => {
		inMockShell();
		await expect(lookupDiscountCode('OLDCODE')).resolves.toEqual({ status: 'expired' });
		await expect(lookupDiscountCode('NOPE')).resolves.toEqual({ status: 'not_found' });
	});

	it('treats an empty code as nothing entered', async () => {
		inMockShell();
		await expect(lookupDiscountCode('   ')).resolves.toEqual({ status: 'not_found' });
	});

	it('refuses a customer-only code below the required spend, with no customer at all', async () => {
		inMockShell();
		await expect(lookupDiscountCode('VIP1ONLY')).resolves.toMatchObject({ status: 'not_eligible' });
	});

	it('accepts a customer-only code for the customer it belongs to', async () => {
		inMockShell();
		await expect(lookupDiscountCode('VIP1ONLY', { customerId: '1' })).resolves.toMatchObject({
			status: 'ok',
			code: 'VIP1ONLY'
		});
	});

	it('refuses a tier-restricted code for a customer without that tier', async () => {
		inMockShell();
		await expect(lookupDiscountCode('PLATINUM15', { customerId: '2', customerTier: undefined })).resolves.toEqual({
			status: 'not_eligible',
			message: 'คูปองนี้ใช้ได้เฉพาะสมาชิก Platinum'
		});
	});

	it('accepts a tier-restricted code once the customer carries that tier', async () => {
		inMockShell();
		await expect(
			lookupDiscountCode('PLATINUM15', { customerId: '1', customerTier: mockCustomerTier('1') })
		).resolves.toMatchObject({ status: 'ok', code: 'PLATINUM15' });
	});

	it('reports a code below its minimum spend apart from a plain rejection', async () => {
		inMockShell();
		await expect(lookupDiscountCode('CASH100', { subtotal: 100 })).resolves.toEqual({
			status: 'min_spend_not_met',
			minSpend: 500
		});
		await expect(lookupDiscountCode('CASH100', { subtotal: 500 })).resolves.toMatchObject({ status: 'ok' });
	});
});

describe('listAvailableDiscountCodes', () => {
	const inMockShell = () => vi.stubEnv('VITE_MOCK_API', 'true');

	it('answers nothing without a backend', async () => {
		vi.stubEnv('VITE_MOCK_API', '');
		await expect(listAvailableDiscountCodes()).resolves.toEqual([]);
	});

	it('lists only store-wide codes for a walk-in with no customer selected', async () => {
		inMockShell();
		const codes = await listAvailableDiscountCodes();
		expect(codes.every((c) => c.audience === 'all')).toBe(true);
		expect(codes.map((c) => c.code)).toContain('SAVE10');
		expect(codes.map((c) => c.code)).not.toContain('PLATINUM15');
	});

	it('never lists an expired code', async () => {
		inMockShell();
		const codes = await listAvailableDiscountCodes();
		expect(codes.map((c) => c.code)).not.toContain('OLDCODE');
	});

	it('adds the customer-restricted codes a Platinum member is eligible for', async () => {
		inMockShell();
		const codes = await listAvailableDiscountCodes({ customerId: '1', customerTier: mockCustomerTier('1') });
		const codeNames = codes.map((c) => c.code);
		expect(codeNames).toContain('PLATINUM15');
		expect(codeNames).toContain('VIP1ONLY');
	});

	it('does not leak a Platinum coupon to a non-member customer', async () => {
		inMockShell();
		const codes = await listAvailableDiscountCodes({ customerId: '2' });
		expect(codes.map((c) => c.code)).not.toContain('PLATINUM15');
		expect(codes.map((c) => c.code)).not.toContain('VIP1ONLY');
	});
});

describe('suggestDiscountCodes', () => {
	const inMockShell = () => vi.stubEnv('VITE_MOCK_API', 'true');

	it('lists every available code for an empty prefix — the coupon tab\'s idle list', async () => {
		inMockShell();
		const available = await listAvailableDiscountCodes();
		expect(suggestDiscountCodes('   ', available).map((s) => s.code)).toEqual(
			available.map((c) => c.code)
		);
	});

	it('matches every available code sharing the typed prefix, case-insensitively', async () => {
		inMockShell();
		const available = await listAvailableDiscountCodes();
		expect(suggestDiscountCodes('sa', available)).toEqual([
			{ code: 'SAVE10', label: 'ลด 10%' },
			{ code: 'SAVE20', label: 'ลด 20%' }
		]);
	});

	it('answers nothing once the prefix no longer matches anything available', async () => {
		inMockShell();
		const available = await listAvailableDiscountCodes();
		expect(suggestDiscountCodes('ZZZ', available)).toEqual([]);
	});
});

describe('discountCodeMessage', () => {
	it('names the code and what it gave when it worked', () => {
		expect(
			discountCodeMessage({
				status: 'ok',
				code: 'SAVE10',
				type: 'percentage',
				value: 10,
				label: 'ลด 10%'
			})
		).toBe('ใช้รหัส SAVE10 — ลด 10%');
	});

	it('never blames the cashier for a feature that does not exist yet', () => {
		expect(discountCodeMessage({ status: 'unsupported' })).toContain('ยังไม่เปิดใช้งาน');
	});

	it('names the minimum spend a code still needs', () => {
		expect(discountCodeMessage({ status: 'min_spend_not_met', minSpend: 500 })).toBe('ยอดซื้อขั้นต่ำ ฿500');
	});
});
