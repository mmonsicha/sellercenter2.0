import { debounced } from '$utils/debounce';
import { derived, writable } from 'svelte/store';

export type Sort = 'desc' | 'asc';

// OMS 2.0 filter set (DES-2235). Replaces the legacy payment-method / courier filters.
// Values are the raw enum strings from oms2-order-list.ts so they round-trip via the URL.
export type OrderFilterOptions = {
	createdDate?: {
		start: string;
		end: string;
	};
	channels?: string[];
	paymentStatuses?: string[];
	fulfillments?: string[];
	statuses?: string[];
	stocks?: string[];
};

export type OrderFilter = OrderFilterOptions & {
	search?: string;
	sort?: Sort;
	total: number; // number of active filter groups, for the badge
};

// URL key for each multi-select group.
export const FILTER_QUERY_KEYS = {
	channels: 'channels',
	paymentStatuses: 'paymentStatus',
	fulfillments: 'fulfillment',
	statuses: 'status',
	stocks: 'stock'
} as const;

export type FilterGroup = keyof typeof FILTER_QUERY_KEYS;
export const FILTER_GROUPS = Object.keys(FILTER_QUERY_KEYS) as FilterGroup[];

export const countActiveFilters = (o: OrderFilterOptions): number =>
	(o.createdDate?.start && o.createdDate?.end ? 1 : 0) +
	FILTER_GROUPS.filter((g) => (o[g]?.length ?? 0) > 0).length;

export const isClearSearchFilter = writable<boolean>(false);
export const oFilter = writable<OrderFilter>({ total: 0 });
const previousFilterStore = writable<OrderFilter>({ total: 0 });

const emptyOptions = (): OrderFilterOptions => ({
	createdDate: undefined,
	channels: undefined,
	paymentStatuses: undefined,
	fulfillments: undefined,
	statuses: undefined,
	stocks: undefined
});

const nonEmpty = (a?: string[]) => (a?.length ? a : undefined);

export const setFilter = (o: OrderFilterOptions) => {
	oFilter.update((f) => ({
		...f,
		createdDate: o.createdDate,
		channels: nonEmpty(o.channels),
		paymentStatuses: nonEmpty(o.paymentStatuses),
		fulfillments: nonEmpty(o.fulfillments),
		statuses: nonEmpty(o.statuses),
		stocks: nonEmpty(o.stocks),
		total: countActiveFilters(o)
	}));
};

export const setSorting = (s: Sort) => {
	oFilter.update((f) => ({ ...f, sort: s }));
};

export const setSearch = (s: string) => {
	oFilter.update((f) => ({ ...f, search: s }));
};

export const setDefaultOrderFilter = () => {
	oFilter.set({ total: 0 });
};

export const resetFilterOptions = () => {
	oFilter.update((f) => ({ ...f, ...emptyOptions(), total: 0 }));
};

export const setIsClearSearchOrderFilter = (f: boolean) => {
	isClearSearchFilter.set(f);
};

export const debouncedSearch = debounced(setSearch, 1000);

export const hasFilterChanged = derived(
	[oFilter, previousFilterStore],
	([$oFilter, $previousFilter]) => {
		const { sort: _sort1, ...filterWithoutSort } = $oFilter;
		const { sort: _sort2, ...previousWithoutSort } = $previousFilter;

		const isChanged = JSON.stringify(filterWithoutSort) !== JSON.stringify(previousWithoutSort);

		if (isChanged) {
			previousFilterStore.set({ ...$oFilter });
		}

		return isChanged;
	}
);

// Every filter key always present ('' = cleared) so setQueryParams can delete stale ones.
export function convertFilterToQueryParams(f: OrderFilter): Record<string, string> {
	const hasDate = !!(f.createdDate?.start && f.createdDate?.end);
	const params: Record<string, string> = {
		search: f.search ?? '',
		dir: f.sort ?? '',
		startDate: hasDate ? f.createdDate!.start : '',
		endDate: hasDate ? f.createdDate!.end : '',
		total: f.total ? f.total.toString() : ''
	};
	for (const g of FILTER_GROUPS) params[FILTER_QUERY_KEYS[g]] = f[g]?.join(',') ?? '';
	return params;
}
