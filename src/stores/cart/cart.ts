import { getItem, localStorageKey } from '$utils/local-storage';
import { writable, get } from 'svelte/store';
import type { TCartListInfo, TCartItem, TCartOptions, discountType } from '.';
import { configurationStore } from '$stores/configuration';
import {
	DeliveryGroupKind,
	ItemFulfilmentType,
	ReceiveMode,
	itemFulfilmentOf
} from '$lib/entities/order/delivery-group';

export interface OpenFulfilmentPile {
	kind: string;
	/** PickupLater only — which branch this particular pile collects for. */
	pickupStoreId?: string;
	/** Shipping only — which customer address this particular pile ships to. undefined is
	 *  the sale's own default address; a second (third, ...) "จัดส่งจากหน้าร้าน" pile the
	 *  cashier opens via "เพิ่มตัวเลือกรับสินค้า" carries its own, distinct address id here. */
	addressId?: string;
}

function samePile(a: OpenFulfilmentPile, b: OpenFulfilmentPile): boolean {
	return (
		a.kind === b.kind && a.pickupStoreId === b.pickupStoreId && (a.addressId ?? '') === (b.addressId ?? '')
	);
}

// "เพิ่มตัวเลือกรับสินค้า" — a pile the cashier opened but hasn't (yet, or ever) put
// anything in. Cart items alone can't represent an empty pile (there's nothing to bucket
// by), so this is the registry CartFulfilmentPiles reads to still render its section —
// the cashier drags existing lines into it from there (see CartItem's drag & drop). Purely
// a display aid: a pile with items in it already renders from the items themselves and
// doesn't need an entry here (though one surviving alongside is harmless — buckets dedupe
// by kind/pickupStoreId).
export const openFulfilmentPiles = writable<OpenFulfilmentPile[]>([]);

export function addOpenFulfilmentPile(pile: OpenFulfilmentPile): void {
	openFulfilmentPiles.update((piles) =>
		piles.some((p) => samePile(p, pile)) ? piles : [...piles, pile]
	);
}

export function removeOpenFulfilmentPile(pile: OpenFulfilmentPile): void {
	openFulfilmentPiles.update((piles) => piles.filter((p) => !samePile(p, pile)));
	// A closed pile can't stay the tap target — otherwise the next product tapped from the
	// catalog would silently build a line for a pile that no longer has a section to show it in.
	activeFulfilmentPile.update((active) => (active && samePile(active, pile) ? undefined : active));
}

// Which pile a freshly-tapped product lands in — undefined means the ordinary, no-override
// line (today's default behaviour). Without this, re-tapping a product already in the
// cart always created ANOTHER plain default line (findMergeTarget skips any line that
// already has an override), so the only way to put more of it into a just-opened pile was
// to drag the new line there by hand. Cart.svelte sets this whenever a pile is opened or
// its section is clicked, and shows which one is active so the cashier isn't guessing
// where the next tap goes.
export const activeFulfilmentPile = writable<OpenFulfilmentPile | undefined>(undefined);

export function setActiveFulfilmentPile(pile: OpenFulfilmentPile | undefined): void {
	activeFulfilmentPile.set(pile);
}

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

// Which existing line (if any) a freshly tapped product should merge into. A tapped
// product must stay separate from a line sitting in a DIFFERENT fulfilment pile than the
// active one (see activeFulfilmentPile) — the whole point of "เพิ่มตัวเลือกรับสินค้า" is
// that the SAME product can sit in two piles at once with its own qty each (เสื้อ รับทันที
// 2 + เสื้อ จัดส่งจากหน้าร้าน 10). No active pile means "the ordinary, non-overridden
// line", matching every line added before piles existed at all.
function findMergeTarget(productId: string, localCart: TCartItem[]): TCartItem | undefined {
	const pile = get(activeFulfilmentPile);
	return localCart.find((c) => {
		if (c.product_id !== productId) return false;
		if (!pile) return !c.lineFulfilment;
		if (c.lineFulfilment !== pile.kind) return false;
		if (pile.kind === DeliveryGroupKind.PickupLater) return c.linePickupStoreId === pile.pickupStoreId;
		if (pile.kind === DeliveryGroupKind.Shipping) return (c.lineAddressId ?? '') === (pile.addressId ?? '');
		return true;
	});
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

	const pile = get(activeFulfilmentPile);
	// ให้บริการนอกสถานที่ only ever accepts a service item (see resolveLineKind/
	// lineFulfilmentOptions, which never offer OnSite to a plain physical line either) — a
	// physical product tapped while that pile is active still lands as an ordinary,
	// non-overridden line instead of silently carrying a kind the line could never resolve
	// to anyway.
	const appliesPile =
		!!pile &&
		(pile.kind !== DeliveryGroupKind.OnSite ||
			itemFulfilmentOf(cart.fulfilmentType) === ItemFulfilmentType.Service);

	localCart.push({
		...cart,
		lineId: cart.lineId ?? newLineId(),
		...(appliesPile
			? {
					lineFulfilment: pile!.kind,
					linePickupStoreId:
						pile!.kind === DeliveryGroupKind.PickupLater ? pile!.pickupStoreId : undefined,
					lineAddressId: pile!.kind === DeliveryGroupKind.Shipping ? pile!.addressId : undefined
				}
			: {})
	});
	setCartLocalAndCartStore(localCart);
}

export function UpdateCartItem(id: string, cart: TCartItem) {
	const localCart = GetExistingCart();

	// A different LINE of the same product (not the one being edited) still gets its
	// qty merged in the same way AddCartItem would — editing a variant's options into
	// matching another existing line's options should fold them together, same as
	// before. `c.lineId !== id` (not product_id) is what tells "itself" apart from
	// "another line of the same SKU" now that more than one line can share a product_id —
	// but only a candidate that's actually the SAME line in every other sense (destination,
	// fulfilment pile/branch) counts as "the same SKU", or editing one line's options could
	// silently fold it into an unrelated line sitting in a completely different pile.
	const editing = localCart.find((c) => c.lineId === id);
	const existingItem = localCart.find(
		(c) =>
			c.product_id === cart.product_id &&
			c.lineId !== id &&
			(c.lineFulfilment ?? '') === (editing?.lineFulfilment ?? '') &&
			(c.linePickupStoreId ?? '') === (editing?.linePickupStoreId ?? '') &&
			(c.lineAddressId ?? '') === (editing?.lineAddressId ?? '')
	);
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

// Drag-and-drop reorder (CartItem.svelte's onDropOnRow) — `orderedLineIds` is the new
// relative order for a SLICE of the cart (one pile's worth, or the whole list for a plain
// walk-in cart), not the whole thing, since CartFulfilmentPiles only ever hands CartItem
// one bucket at a time. The slice's lines are put back into the exact index positions they
// already occupied in the full cart, just in the new order, so interleaved lines belonging
// to OTHER piles never move.
export function ReorderCartItems(orderedLineIds: string[]): void {
	const localCart = GetExistingCart();
	const slots = localCart
		.map((c, i) => ({ lineId: c.lineId, index: i }))
		.filter((s) => s.lineId && orderedLineIds.includes(s.lineId))
		.map((s) => s.index);
	const byId = new Map(localCart.map((c) => [c.lineId, c]));
	const reordered = orderedLineIds.map((id) => byId.get(id)).filter((c): c is TCartItem => !!c);
	if (slots.length !== reordered.length) return;

	const result = [...localCart];
	slots.forEach((slot, i) => {
		result[slot] = reordered[i];
	});
	setCartLocalAndCartStore(result);
}

// Folds one line's qty into another and drops the first — two lines of the SAME product
// ending up in the SAME pile (same destination/fulfilment/branch) have nothing left to
// tell them apart, so they must read as one row with a combined qty, not two identical-
// looking rows. Used when a drag (CartItem/CartFulfilmentPiles) lands a line on top of
// another line of the same product, whether that's a reorder within one pile or a move
// across piles. Silently no-ops if either id is gone (stale drag after some other change).
export function MergeCartLines(targetLineId: string, sourceLineId: string): void {
	if (targetLineId === sourceLineId) return;
	const localCart = GetExistingCart();
	const target = localCart.find((c) => c.lineId === targetLineId);
	const source = localCart.find((c) => c.lineId === sourceLineId);
	if (!target || !source) return;

	const mergedQty = Math.min(999, target.qty + source.qty);
	const result = localCart
		.filter((c) => c.lineId !== sourceLineId)
		.map((c) => (c.lineId === targetLineId ? { ...c, qty: mergedQty } : c));
	setCartLocalAndCartStore(result);
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

// Basic mode's per-line override (see TCartItem.lineFulfilment) — same persistence
// pattern as SetCartItemReceiveMode above. `undefined` clears back to "follow the sale
// default", it does not delete the line.
export function SetCartItemFulfilment(id: string, kind: string | undefined) {
	const localCart = GetExistingCart();

	localCart.map((c) => {
		if (c.lineId === id) {
			c.lineFulfilment = kind;
		}

		return c;
	});

	setCartLocalAndCartStore(localCart);
}

// Stamps a specific รับภายหลัง branch onto one line (set when a line is dragged into a
// "เพิ่มตัวเลือกรับสินค้า" pile for a specific branch — see CartFulfilmentPiles.svelte —
// and also used to fix up every existing รับภายหลัง line at once when the cashier edits
// the branch from the merged card; see Cart.svelte's onSelectPickupBranch).
export function SetCartItemPickupStore(id: string, pickupStoreId: string | undefined) {
	const localCart = GetExistingCart();

	localCart.map((c) => {
		if (c.lineId === id) {
			c.linePickupStoreId = pickupStoreId;
		}

		return c;
	});

	setCartLocalAndCartStore(localCart);
}

// Stamps a specific "เพิ่มตัวเลือกรับสินค้า" Shipping address onto one line (set when a
// line is dragged into such a pile — see CartFulfilmentPiles.svelte — and also used to fix
// up every existing line in a pile at once when the cashier edits that pile's own address
// from its settings drawer). Same persistence pattern as SetCartItemPickupStore.
export function SetCartItemAddressId(id: string, addressId: string | undefined) {
	const localCart = GetExistingCart();

	localCart.map((c) => {
		if (c.lineId === id) {
			c.lineAddressId = addressId;
		}

		return c;
	});

	setCartLocalAndCartStore(localCart);
}

// Clears every line's per-line fulfilment override AND legacy receiveMode — used when the
// sale-level fulfilment/channel changes in a way that invalidates whatever the cashier had
// picked per line before (e.g. switching the whole sale between POS/online/marketplace),
// so a stale line-level pick never silently outlives the context it was made in.
export function ResetPhysicalLineFulfilment() {
	const localCart = GetExistingCart();

	const updated = localCart.map((c) => ({
		...c,
		lineFulfilment: undefined,
		receiveMode: undefined,
		linePickupStoreId: undefined,
		lineAddressId: undefined
	}));

	setCartLocalAndCartStore(updated);
	openFulfilmentPiles.set([]);
	activeFulfilmentPile.set(undefined);
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
	// Otherwise the NEXT sale opens with whatever empty "เพิ่มตัวเลือกรับสินค้า" sections
	// (or an active one) the cashier happened to leave on this one — there's no cart left
	// for either to mean anything about.
	openFulfilmentPiles.set([]);
	activeFulfilmentPile.set(undefined);
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
