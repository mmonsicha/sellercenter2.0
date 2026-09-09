import { getItem, localStorageKey } from '$utils/local-storage';
import { writable, get } from 'svelte/store';
import type { TCartListInfo, TCartItem, TCartOptions, discountType } from '.';
import { configurationStore } from '$stores/configuration';

export const cartListInfo = writable<TCartListInfo>({
	data: [],
	totalPrice: 0,
	summaryPrice: 0,
	discount: {
		type: 'percentage',
		value: 0
	}
});

function getStoreId(): string {
	return get(configurationStore)?.data?.user?.selectedStoreId;
}

function alreadyAddToCart(id: string, list: TCartItem[]): TCartItem | undefined {
	const item = list.find((l) => l.product_id === id);
	return item;
}

function setCartLocalAndCartStore(list: TCartItem[]) {
	cartListInfo.update((c) => {
		return { ...c, data: list };
	});
	localStorage.setItem(`${localStorageKey.CART}_${getStoreId()}`, JSON.stringify(list));
}

export function GetExistingCart(): TCartItem[] {
	var existingCart = localStorage.getItem(`${localStorageKey.CART}_${getStoreId()}`);
	var localCart: TCartItem[] = [];

	if (existingCart) {
		localCart = JSON.parse(existingCart);
	}

	cartListInfo.update((c) => {
		return { ...c, data: localCart };
	});
	return localCart;
}

export function AddCartItem(cart: TCartItem) {
	const localCart = GetExistingCart();

	// check cart
	const existingItem = alreadyAddToCart(cart.product_id, localCart);
	if (existingItem) {
		UpdateCartInput(existingItem.product_id, cart.input ?? []);
		const maxQty = existingItem.qty + cart.qty > 999 ? 999 : existingItem.qty + cart.qty;
		UpdateCartItemQty(existingItem.product_id, maxQty);
		return;
	}
	localCart.push(cart);
	setCartLocalAndCartStore(localCart);
}

export function UpdateCartItem(id: string, cart: TCartItem) {
	const localCart = GetExistingCart();

	// if already exists, increase qty and remove current cart
	const existingItem = alreadyAddToCart(cart.product_id, localCart);
	if (existingItem) {
		UpdateCartInput(existingItem.product_id, cart.input ?? []);
		if (id !== existingItem.product_id) {
			RemoveCartItem(id);
			const maxQty = existingItem.qty + cart.qty > 999 ? 999 : existingItem.qty + cart.qty;
			UpdateCartItemQty(existingItem.product_id, maxQty);
		} else {
			UpdateCartItemQty(existingItem.product_id, cart.qty);
		}
		return;
	}

	const updatedLocalCart = localCart.map((c) => {
		if (c.product_id === id) {
			c = { ...c, ...cart, product_name: c.product_name };
		}
		return c;
	});

	setCartLocalAndCartStore(updatedLocalCart);
}

export function UpdateCartInput(id: string, cIp: TCartOptions[]) {
	const localCart = GetExistingCart();

	localCart.map((c) => {
		if (c.product_id === id) {
			c.input = cIp;
		}

		return c;
	});

	setCartLocalAndCartStore(localCart);
}

export function UpdateCartItemQty(id: string, qty: number) {
	const localCart = GetExistingCart();

	localCart.map((c) => {
		if (c.product_id === id) {
			if (c.qty === qty) return;
			c.qty = qty;
		}

		return c;
	});

	setCartLocalAndCartStore(localCart);
}

export function RemoveCartItem(id: string) {
	const localCart = GetExistingCart();
	const newCartList = localCart.filter((c) => c.product_id != id);

	setCartLocalAndCartStore(newCartList);
}

export function ClearAllItem() {
	cartListInfo.set({
		data: [],
		totalPrice: 0,
		summaryPrice: 0,
		discount: {
			type: 'percentage',
			value: 0
		}
	});
	localStorage.removeItem(`${localStorageKey.CART}_${getStoreId()}`);
}

export function calculateTotalPrice(cartList: TCartItem[]): number {
	var total = 0;

	cartList.map((c) => {
		const qty = isNaN(c.qty) ? 0 : c.qty;
		total += qty * c.price;
	});

	cartListInfo.update((c) => {
		return { ...c, totalPrice: total };
	});

	return total;
}

export function calculateSummary(tp: number, dp: number) {
	const result = tp - dp;
	cartListInfo.update((c) => {
		return { ...c, summaryPrice: result < 0 ? 0 : result };
	});
}

export function calculateDiscount(tp: number, dType: discountType, dAmount: number) {
	var d = 0;
	switch (dType) {
		case 'fixed': {
			d = dAmount;
			break;
		}
		case 'percentage': {
			const actualDiscount = (dAmount / 100) * tp;
			d = actualDiscount > 0 ? actualDiscount : 0;
			break;
		}
	}
	cartListInfo.update((c) => {
		return {
			...c,
			discount: {
				type: dType,
				value: d
			}
		};
	});
}
