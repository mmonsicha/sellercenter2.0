import type { SaleProduct } from '$lib/entities/sale/sale';
import type { TCartItem } from '$stores/cart';
import { configurationStore } from '$stores/configuration';
import { fetchProducts } from '$stores/sales/sales';
import { get } from 'svelte/store';

function is2Digit(num: string) {
	return /^\d+(?:\.\d{0,2})?$/.test(num);
}

function toWithoutDash(id: string): string {
	if (/-/.test(id)) {
		return id.split('-')[0];
	}

	return id;
}

export function isDiscountValueValid(vs: string, dType: string): boolean {
	if (vs === '') {
		return true;
	}

	if (!is2Digit(vs)) {
		return false;
	}

	const v = +vs;
	switch (dType) {
		case 'fixed':
			if (v > 0) {
				return true;
			} else {
				return false;
			}
		case 'percentage':
			if (v >= 1) {
				return true;
			} else {
				return false;
			}
	}

	return true;
}

export async function toSaleProduct(cartItem: TCartItem): Promise<SaleProduct | undefined> {
	const cId = get(configurationStore)?.data?.user?.selectedCompanyId;
	const itemId = toWithoutDash(cartItem.product_id);
	const resp = await fetchProducts(cId, 0, 10, '', toWithoutDash(cartItem.code));

	const saleProduct = resp.results?.find((product) => toWithoutDash(product.product_id) === itemId);

	return saleProduct;
}
