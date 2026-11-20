import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
	convertFilterToQueryParams,
	countActiveFilters,
	oFilter,
	resetFilterOptions,
	setDefaultOrderFilter,
	setFilter
} from '$stores/order/filter';

describe('OMS2 order filter store', () => {
	it('counts active groups incl. date range', () => {
		expect(countActiveFilters({})).toBe(0);
		expect(
			countActiveFilters({
				channels: ['ch-pos'],
				stocks: [],
				createdDate: { start: 'a', end: 'b' }
			})
		).toBe(2);
	});

	it('setFilter drops empty groups and derives total', () => {
		setDefaultOrderFilter();
		setFilter({ paymentStatuses: ['cod_pending'], fulfillments: [], statuses: ['delivering'] });
		const f = get(oFilter);
		expect(f.fulfillments).toBeUndefined();
		expect(f.total).toBe(2);
		resetFilterOptions();
		expect(get(oFilter).total).toBe(0);
		expect(get(oFilter).paymentStatuses).toBeUndefined();
	});

	it('query params always carry every key so stale ones are removed', () => {
		const p = convertFilterToQueryParams({ total: 1, channels: ['a', 'b'] });
		expect(p.channels).toBe('a,b');
		expect(p).toMatchObject({ paymentStatus: '', fulfillment: '', status: '', stock: '' });
		expect(p.total).toBe('1');
	});
});
