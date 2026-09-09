import type { SaleProduct } from '$lib/entities/sale/sale';
import type { TCartOptions } from '$stores/cart';
import { writable } from 'svelte/store';

// detail variant handler
export const cInputValue = writable<TCartOptions[]>([]);
export const variantValue = writable<TCartOptions[]>([]);

export const selectedProductInfo = writable<SaleProduct>({
	product_id: '',
	code: '',
	label: '',
	price: { min: 0 },
	image: ''
});

export function setSelectedProduct(pd: SaleProduct) {
	selectedProductInfo.set(pd);
}
export function setVariantValue(v: TCartOptions[]) {
	variantValue.set(v);
}

export function setDefaultCustomerInput() {
	cInputValue.set([]);
}

export function setCustomerInput(inputs: TCartOptions[]) {
	cInputValue.set(inputs);
}
