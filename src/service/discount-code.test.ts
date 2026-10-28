import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	canResolveDiscountCode,
	discountCodeMessage,
	lookupDiscountCode,
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
});

describe('suggestDiscountCodes', () => {
	const inMockShell = () => vi.stubEnv('VITE_MOCK_API', 'true');

	it('answers nothing without a backend to suggest against', () => {
		vi.stubEnv('VITE_MOCK_API', '');
		expect(suggestDiscountCodes('SA')).toEqual([]);
	});

	it('lists every active code for an empty prefix — the coupon tab\'s idle sample list', () => {
		inMockShell();
		expect(suggestDiscountCodes('   ')).toEqual([
			{ code: 'SAVE10', label: 'ลด 10%' },
			{ code: 'SAVE20', label: 'ลด 20%' },
			{ code: 'HALF', label: 'ลดครึ่งราคา' },
			{ code: 'CASH50', label: 'ลด 50 บาท' },
			{ code: 'CASH100', label: 'ลด 100 บาท' }
		]);
	});

	it('matches every active code sharing the typed prefix, case-insensitively', () => {
		inMockShell();
		expect(suggestDiscountCodes('sa')).toEqual([
			{ code: 'SAVE10', label: 'ลด 10%' },
			{ code: 'SAVE20', label: 'ลด 20%' }
		]);
	});

	it('never suggests an expired code', () => {
		inMockShell();
		expect(suggestDiscountCodes('OLD')).toEqual([]);
	});

	it('answers nothing once the prefix no longer matches anything active', () => {
		inMockShell();
		expect(suggestDiscountCodes('ZZZ')).toEqual([]);
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
});
