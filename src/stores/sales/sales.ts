import type { SaleProduct } from '$lib/entities/sale/sale';
import { get, writable } from 'svelte/store';
import { listProduct } from '../../service/pis-rest';
import { debounced } from '$utils/debounce';
import { configurationStore } from './../configuration';

const pageSize = 10;
export const mappingTabsTitle = [
	{ key: 'patona-sellercenter-sales-tab-all', value: '' },
	{ key: 'patona-sellercenter-sales-tab-pysical', value: 'physical' },
	{ key: 'patona-sellercenter-sales-tab-services', value: 'service' },
	{ key: 'patona-sellercenter-sales-tab-digital', value: 'digital' }
];

export type SalesProductState = {
	loading: boolean;
	data: SaleProduct[] | undefined;
	offset: number;
	hasMore?: boolean;
	total: number;
};

export const salesProductList = writable<SalesProductState>({
	loading: false,
	data: undefined,
	hasMore: false,
	offset: 0,
	total: 0
});

const updateSalesProductList = (resp: any, currentState: SalesProductState, isCombine: boolean) => {
	if (!resp) {
		return {
			...currentState,
			loading: false,
			hasMore: false,
			total: isCombine ? currentState.total : 0
		};
	}

	const total = isCombine ? currentState.total : resp.total;
	const data = isCombine ? combineProductData(resp.results, currentState.data ?? []) : resp.results;

	const hasMore = data.length < total;
	return {
		...currentState,
		loading: false,
		hasMore,
		data,
		total
	};
};

export const fetchProducts = async (
	companyId: string,
	offset: number,
	limit: number,
	type: string = '',
	keyword: string = ''
) => {
	return await listProduct(`sellsuki.company:${companyId}`, offset, limit, type, keyword);
};

export const search = async (
	type?: string,
	keyword?: string,
	isCombine?: boolean
): Promise<void> => {
	salesProductList.update((s) => {
		return { ...s, loading: true };
	});
	const isSearch = !!(type || keyword);
	let hasMore = get(salesProductList).hasMore;
	let offset = isSearch && !isCombine ? 0 : get(salesProductList).offset;
	if (isCombine && hasMore) offset += pageSize;

	const companyId = get(configurationStore)?.data?.user?.selectedCompanyId;
	const resp = await fetchProducts(companyId, offset, pageSize, type, keyword);
	if (isSearch && resp.total === 0) {
		resp.total = 1;
	}

	salesProductList.update((s) => {
		s.offset = offset;
		return updateSalesProductList(resp, s, !!(hasMore && isCombine));
	});
};

export const debouncedSearch = debounced(search, 1000);

export async function loadSales(type: string, isTabs: boolean) {
	salesProductList.update((s) => {
		return { ...s, loading: true };
	});

	const offset = 0;
	const companyId = get(configurationStore)?.data?.user?.selectedCompanyId;
	const resp = await fetchProducts(companyId, offset, pageSize, type);
	if (isTabs && resp.total === 0) {
		resp.total = 1;
	}

	salesProductList.update((s) => {
		s.offset = offset;
		return updateSalesProductList(resp, s, false);
	});
}

function combineProductData(newProduct: SaleProduct[], exProduct: SaleProduct[]): SaleProduct[] {
	const combinationData = [...exProduct, ...newProduct];
	const uniqueProductById = [
		...new Map(combinationData.map((item) => [item.product_id, item])).values()
	];
	return uniqueProductById;
}

export function resetSalesProductList() {
	salesProductList.set({
		loading: false,
		data: undefined,
		hasMore: false,
		offset: 0,
		total: 0
	});
}
