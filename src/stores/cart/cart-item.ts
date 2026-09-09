import { derived, writable } from 'svelte/store';
import type { TCartItem, TCartOptions } from '.';

export const currentCartId = writable<string>('');

// pre cart info before add to list cart
export const cartItemInfo = writable<TCartItem>({
	product_id: '',
	code: '',
	product_name: '',
	price: 0,
	qty: 1
});

export function setCurrentCartId(id: string) {
	currentCartId.set(id);
}
export function setCartItemDefault() {
	cartItemInfo.set({
		product_id: '',
		code: '',
		product_name: '',
		price: 0,
		qty: 1
	});
}

export function setCartItemInfo(item: TCartItem) {
	cartItemInfo.set(item);
}

export function updateCartOptionInfo(cOpt: TCartOptions[]) {
	cartItemInfo.update((c) => ({
		...c,
		options: cOpt
	}));
}

export function updateCartPriceInfo(p: number) {
	cartItemInfo.update((c) => ({
		...c,
		price: p
	}));
}

export function updateCartQuantityInfo(qty: number) {
	cartItemInfo.update((c) => ({
		...c,
		qty
	}));
}

export function updateCartIdInfo(id: string) {
	cartItemInfo.update((c) => ({
		...c,
		product_id: id
	}));
}

export function updateCartInput(cIp: TCartOptions[]) {
	cartItemInfo.update((c) => ({
		...c,
		input: cIp
	}));
}

export function updateCartImage(cImg: string) {
	cartItemInfo.update((c) => ({
		...c,
		image: cImg
	}));
}
