import { debounced } from '$utils/debounce';
import { derived, writable } from 'svelte/store';
import _ from 'lodash';

export type Sort = 'desc' | 'asc';
export type OrderFilter = {
	search?: string;
	sort?: Sort;

	// filter options
	total: number;
	createdDate?: {
		start: string;
		end: string;
	};
	payment?: {
		status?: string[];
		type?: string[];
	};
	salesChannels?: string[];
	couriers?: string[];
};

export const isClearSearchFilter = writable<Boolean>(false);
export const oFilter = writable<OrderFilter>({ total: 0 });
const previousFilterStore = writable<OrderFilter>({ total: 0 });

export const setTotal = (t: number) => {
	oFilter.update((f) => ({ ...f, total: t }));
};

export const setFilter = (o: OrderFilter) => {
	oFilter.update((f) => ({
		...f,
		createdDate: o.createdDate,
		payment: o.payment,
		salesChannels: o.salesChannels,
		couriers: o.couriers
	}));
};

export const setSorting = (s: Sort) => {
	oFilter.update((f) => ({
		...f,
		sort: s
	}));
};

export const setSearch = (s: string) => {
	oFilter.update((f) => ({
		...f,
		search: s
	}));
};

export const setDefaultOrderFilter = () => {
	oFilter.set({
		total: 0
	});
};

export const resetFilterOptions = () => {
	oFilter.update((f) => ({
		...f,
		total: 0,
		createdDate: undefined,
		payment: undefined,
		salesChannels: undefined,
		couriers: undefined
	}));
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

export function convertFilterToQueryParams(oFilter: OrderFilter): Record<string, string> {
	const params: Record<string, string> = {};

	if (oFilter.search) {
		params.search = oFilter.search;
	}

	if (oFilter.sort) {
		params.dir = oFilter.sort;
	}

	if (oFilter.createdDate?.start && oFilter.createdDate?.end) {
		params.startDate = oFilter.createdDate.start;
		params.endDate = oFilter.createdDate.end;
	}

	if (oFilter.payment?.status?.length) {
		params.paymentStatus = oFilter.payment.status.join(',');
	}

	if (oFilter.payment?.type?.length) {
		params.paymentType = oFilter.payment.type.join(',');
	}

	if (oFilter.salesChannels?.length) {
		params.salesChannels = oFilter.salesChannels.join(',');
	}

	if (oFilter.couriers?.length) {
		params.couriers = oFilter.couriers.join(',');
	}

	if (oFilter.total) {
		params.total = oFilter.total.toString();
	}
	return params;
}
