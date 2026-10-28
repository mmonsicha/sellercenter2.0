import { getItem, localStorageKey } from '$utils/local-storage';
import { writable, get } from 'svelte/store';
import type { TCartListInfo, TCartItem, TCartOptions, discountType } from '.';
import { configurationStore } from '$stores/configuration';
import { ReceiveMode } from '$lib/entities/order/delivery-group';
import { activeDeliveryGroupId, deliveryGroups } from '$stores/order/delivery-group';

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

// Line identity — distinct from product_id so the same SKU can exist as independent
// cart lines across different delivery groups (see TCartItem.lineId). Same
// secure-context guard as delivery-group.ts's newGroupId: crypto.randomUUID only exists
// over https, and the dev server is reached over plain http on a LAN host.
function newLineId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

	// Backfill a stable lineId onto any line that predates this field (old localStorage
	// cart, or a cart built before a page reload picked up this change) and persist it
	// immediately — otherwise a fresh id would be minted on every read and nothing
	// keyed by lineId (qty edits, delivery-group membership) could ever find it again.
	let needsBackfill = false;
	localCart = localCart.map((c) => {
		if (c.lineId) return c;
		needsBackfill = true;
		return { ...c, lineId: newLineId() };
	});
	if (needsBackfill && localCart.length > 0) {
		localStorage.setItem(`${localStorageKey.CART}_${getStoreId()}`, JSON.stringify(localCart));
	}

	cartListInfo.update((c) => {
		return { ...c, data: localCart };
	});
	return localCart;
}

// Which existing line (if any) a freshly tapped product should merge into. Outside
// group-order mode (no active parcel) this is the plain old rule: any line of the same
// product_id, wherever it sits — one line per product, qty bumped on re-add. The moment
// a parcel is ACTIVE (the cashier is shopping into a specific group — see
// activeDeliveryGroupId), "the same product" only means "the same line" if that line is
// already a member of THAT active parcel. A line of the same product sitting in a
// DIFFERENT parcel must stay separate — tapping the product again means "put another one
// in THIS parcel", not "bump the one sitting over there" (which is what produced two
// visually-identical rows in the same parcel instead of one row at qty 2 — the active
// parcel's own existing line must still win the merge).
function findMergeTarget(productId: string, localCart: TCartItem[]): TCartItem | undefined {
	const activeId = get(activeDeliveryGroupId);
	if (!activeId) {
		return localCart.find((c) => c.product_id === productId);
	}
	const activeGroupItemIds = new Set(get(deliveryGroups).find((g) => g.id === activeId)?.itemIds ?? []);
	return localCart.find(
		(c) => c.product_id === productId && !!c.lineId && activeGroupItemIds.has(c.lineId)
	);
}

export function AddCartItem(cart: TCartItem) {
	const localCart = GetExistingCart();

	const existingItem = findMergeTarget(cart.product_id, localCart);
	if (existingItem) {
		// A cart saved before the product's fulfilment profile was carried here (or
		// before this field existed at all) has no fulfilmentType, and dedupe by
		// product_id means re-adding the item would never heal it — the line would stay
		// "physical" for the rest of the cart's life and an order with a digital item in
		// it would silently never split. Take the fresh values whenever the incoming
		// item has them.
		if (cart.fulfilmentType && cart.fulfilmentType !== existingItem.fulfilmentType) {
			existingItem.fulfilmentType = cart.fulfilmentType;
			existingItem.originId = cart.originId;
			existingItem.originName = cart.originName;
			setCartLocalAndCartStore(localCart);
		}

		UpdateCartInput(existingItem.lineId!, cart.input ?? []);
		const maxQty = existingItem.qty + cart.qty > 999 ? 999 : existingItem.qty + cart.qty;
		UpdateCartItemQty(existingItem.lineId!, maxQty);
		return;
	}
	localCart.push({ ...cart, lineId: cart.lineId ?? newLineId() });
	setCartLocalAndCartStore(localCart);
}

export function UpdateCartItem(id: string, cart: TCartItem) {
	const localCart = GetExistingCart();

	// A different LINE of the same product (not the one being edited) still gets its
	// qty merged in the same way AddCartItem would — editing a variant's options into
	// matching another existing line's options should fold them together, same as
	// before. `c.lineId !== id` (not product_id) is what tells "itself" apart from
	// "another line of the same SKU" now that more than one line can share a product_id.
	const existingItem = localCart.find((c) => c.product_id === cart.product_id && c.lineId !== id);
	if (existingItem) {
		UpdateCartInput(existingItem.lineId!, cart.input ?? []);
		RemoveCartItem(id);
		const maxQty = existingItem.qty + cart.qty > 999 ? 999 : existingItem.qty + cart.qty;
		UpdateCartItemQty(existingItem.lineId!, maxQty);
		return;
	}

	const updatedLocalCart = localCart.map((c) => {
		if (c.lineId === id) {
			c = { ...c, ...cart, lineId: c.lineId, product_name: c.product_name };
		}
		return c;
	});

	setCartLocalAndCartStore(updatedLocalCart);
}

export function UpdateCartInput(id: string, cIp: TCartOptions[]) {
	const localCart = GetExistingCart();

	localCart.map((c) => {
		if (c.lineId === id) {
			c.input = cIp;
		}

		return c;
	});

	setCartLocalAndCartStore(localCart);
}

// Re-merges every line of the same product back into one, summing their qty — the
// inverse of the active-parcel split AddCartItem/findMergeTarget perform. Multiple lines
// of one product only make sense WHILE the sale is actively split across several
// delivery groups; the moment that collapses back down to a single group (the cashier
// deleted their way back to "normal mode" — see removeUserDeliveryGroup's callers), the
// fragments must fold back into one ordinary row instead of sitting there as confusing
// duplicate-looking lines with nothing left to tell them apart. Options/input are not
// compared — this mirrors AddCartItem's own pre-existing dedupe rule, which has always
// matched by product_id alone.
export function ConsolidateCartLines(): void {
	const localCart = GetExistingCart();
	const merged: TCartItem[] = [];
	const indexByProduct = new Map<string, number>();

	localCart.forEach((item) => {
		const existingIndex = indexByProduct.get(item.product_id);
		if (existingIndex === undefined) {
			indexByProduct.set(item.product_id, merged.length);
			merged.push({ ...item });
			return;
		}
		const target = merged[existingIndex];
		target.qty = Math.min(999, target.qty + item.qty);
	});

	setCartLocalAndCartStore(merged);
}

export function UpdateCartItemQty(id: string, qty: number) {
	const localCart = GetExistingCart();

	localCart.map((c) => {
		if (c.lineId === id) {
			if (c.qty === qty) return;
			c.qty = qty;
		}

		return c;
	});

	setCartLocalAndCartStore(localCart);
}

// "รับบางส่วน" — flips one line between handed-over-now and shipped. Only meaningful on
// a POS จัดส่งให้ลูกค้า sale; syncDeliveryGroups is what actually acts on the value (see
// `allowPartialReceive`), this just persists the cashier's choice the same way every
// other per-line edit in this file does.
export function SetCartItemReceiveMode(id: string, mode: ReceiveMode) {
	const localCart = GetExistingCart();

	localCart.map((c) => {
		if (c.lineId === id) {
			c.receiveMode = mode;
		}

		return c;
	});

	setCartLocalAndCartStore(localCart);
}

export function RemoveCartItem(id: string) {
	const localCart = GetExistingCart();
	const newCartList = localCart.filter((c) => c.lineId != id);

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

export function calculateDiscount(
	tp: number,
	dType: discountType,
	dAmount: number,
	code?: string,
	reason?: string
) {
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
				value: d,
				code,
				reason
			}
		};
	});
}
