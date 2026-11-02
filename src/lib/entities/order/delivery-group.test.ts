import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	newDeliveryGroup,
	isDestinationReady,
	DeliveryGroupKind,
	ItemFulfilmentType,
	ReceiveMode,
	SplitReason,
	receiveNowBlockReason,
	canChangeGroupKind,
	groupKindLabel,
	isMarketplaceChannel,
	lineFulfilmentOptions,
	resolveLineKind
} from './delivery-group';
import { FullfilmentType } from './order';
import type { TCartItem } from '$stores/cart';

// syncDeliveryGroups only ever reads `orderData`/`setDelivery` inside
// commitDeliveryGroupsToOrder, which none of the cases below call — so the store's
// real dependency on management-rest.ts / profile.ts (env-backed axios clients) never
// needs to load at all. A self-contained stub keeps this file a pure entity/store test.
vi.mock('$stores/order/order', () => ({
	orderData: { subscribe: () => () => {} },
	setDelivery: vi.fn()
}));

// The flag defaults to enabled (matches every case above and below except the
// "disabled" describe block, which overrides this per test via mockReturnValue).
const isMultiParcelEnabledMock = vi.fn(() => true);
vi.mock('$lib/feature-flags', () => ({
	isMultiParcelEnabled: () => isMultiParcelEnabledMock()
}));

import {
	syncDeliveryGroups,
	deliveryGroups,
	deliverySummary,
	hasSplitDelivery,
	showDeliveryDetail,
	resetDeliveryGroups,
	addUserDeliveryGroup,
	enableGroupOrder,
	canRemoveDeliveryGroup,
	removeUserDeliveryGroup,
	restoreDeliveryGroup,
	activeDeliveryGroupId,
	setActiveDeliveryGroup,
	updateDeliveryGroup,
	moveItemToGroup,
	groupOrderMode
} from '$stores/order/delivery-group';

const physicalItem = (id: string, overrides: Partial<TCartItem> = {}): TCartItem => ({
	lineId: id,
	product_id: id,
	product_name: `Physical ${id}`,
	code: id,
	price: 100,
	qty: 1,
	fulfilmentType: ItemFulfilmentType.Physical,
	...overrides
});

const digitalItem = (id: string, overrides: Partial<TCartItem> = {}): TCartItem => ({
	lineId: id,
	product_id: id,
	product_name: `Digital ${id}`,
	code: id,
	price: 50,
	qty: 1,
	fulfilmentType: ItemFulfilmentType.Digital,
	...overrides
});

// A service item (บริการห่อของขวัญ, ...) — performed AT the customer's site. Hard-split
// into its own locked OnSite group; see isServiceItem / syncDeliveryGroups.
const serviceItem = (id: string, overrides: Partial<TCartItem> = {}): TCartItem => ({
	lineId: id,
	product_id: id,
	product_name: `Service ${id}`,
	code: id,
	price: 80,
	qty: 1,
	fulfilmentType: ItemFulfilmentType.Service,
	...overrides
});

// The POS dev/staging hosts are plain http on a LAN name (vite.config.js: host 0.0.0.0
// + seller.sellsuki.local), which is an INSECURE context — and `crypto.randomUUID` only
// exists in a secure one. Calling it bare took the whole cart down with a blank screen
// the moment an order first split, so the fallback is covered here rather than left to
// be rediscovered on a device that happens not to be localhost.
describe('newDeliveryGroup id generation', () => {
	const realCrypto = globalThis.crypto;

	afterEach(() => {
		Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true });
	});

	// A browser on an insecure origin does not hide randomUUID on the instance — the
	// whole property is [SecureContext]-gated and never exposed, prototype included. In
	// Node it lives on Crypto.prototype, so deleting it off the instance proves nothing;
	// swapping the global for one without it is what actually reproduces the browser.
	const withoutRandomUUID = (run: () => void) => {
		Object.defineProperty(globalThis, 'crypto', {
			value: { getRandomValues: realCrypto?.getRandomValues?.bind(realCrypto) },
			configurable: true
		});
		run();
	};

	it('still returns an id where crypto.randomUUID does not exist', () => {
		withoutRandomUUID(() => {
			expect('randomUUID' in globalThis.crypto).toBe(false);
			expect(newDeliveryGroup().id).toBeTruthy();
		});
	});

	it('returns distinct ids for groups made in the same tick', () => {
		withoutRandomUUID(() => {
			const ids = Array.from({ length: 50 }, () => newDeliveryGroup().id);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});

	it('uses crypto.randomUUID when the context does provide it', () => {
		expect(newDeliveryGroup().id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
		);
	});
});

describe('isDestinationReady', () => {
	it('treats a digital parcel as ready on an email alone, never an address', () => {
		expect(
			isDestinationReady(
				newDeliveryGroup({ kind: DeliveryGroupKind.Digital, recipientEmail: 'a@b.co' })
			)
		).toBe(true);
		expect(
			isDestinationReady(
				newDeliveryGroup({ kind: DeliveryGroupKind.Digital, recipientAddress: '123 ถ.สุขุมวิท' })
			)
		).toBe(false);
	});

	it('is ready once a shipping parcel has an address', () => {
		expect(isDestinationReady(newDeliveryGroup({ recipientAddress: '123 ถ.สุขุมวิท' }))).toBe(true);
		expect(isDestinationReady(newDeliveryGroup())).toBe(false);
	});

	it('is always ready for a pickup parcel — the customer collects it, there is no destination to fill', () => {
		expect(isDestinationReady(newDeliveryGroup({ kind: DeliveryGroupKind.PickupInStore }))).toBe(
			true
		);
		expect(isDestinationReady(newDeliveryGroup({ kind: DeliveryGroupKind.PickupLater }))).toBe(
			true
		);
	});

	it('blocks a digital parcel with no email at all, same as one with only an address', () => {
		expect(isDestinationReady(newDeliveryGroup({ kind: DeliveryGroupKind.Digital }))).toBe(false);
	});
});

describe('syncDeliveryGroups', () => {
	beforeEach(() => {
		resetDeliveryGroups();
		// Every case in this describe exercises the feature switched on; the
		// disabled-flag cases live in their own describe below and restore this after.
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	it('leaves the group list empty for a physical-only walk-in sale — the zero-cost path', () => {
		// This is the bug this feature must not reintroduce: a pickup sale with nothing
		// digital in it must never build parcels at all.
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});

		expect(get(deliveryGroups)).toEqual([]);
		expect(get(hasSplitDelivery)).toBe(false);
	});

	// Basic mode (the default — no enableGroupOrder) now locks EVERY present category
	// group once more than one category exists, PickupInStore included — it reads as a
	// handover pile (SplitReason.Receive) exactly like the รับบางส่วน handover group
	// already does, rather than the old single "default, editable" bucket.
	it('splits a physical + digital walk-in sale into a locked PickupInStore parcel and a locked Digital parcel', () => {
		syncDeliveryGroups([physicalItem('p1'), digitalItem('d1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false,
			recipientEmail: 'buyer@example.com'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(2);
		expect(groups.map((g) => g.kind).sort()).toEqual(
			[DeliveryGroupKind.PickupInStore, DeliveryGroupKind.Digital].sort()
		);

		const digital = groups.find((g) => g.kind === DeliveryGroupKind.Digital);
		expect(digital?.locked).toBe(true);
		expect(digital?.recipientEmail).toBe('buyer@example.com');

		const pickup = groups.find((g) => g.kind === DeliveryGroupKind.PickupInStore);
		expect(pickup?.locked).toBe(true);
		expect(pickup?.splitReason).toBe(SplitReason.Receive);
		expect(pickup?.recipientAddress).toBeUndefined();
	});

	it('splits a physical + digital shopDelivery sale into Shipping and Digital parcels', () => {
		syncDeliveryGroups([physicalItem('p1'), digitalItem('d1')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท',
			recipientEmail: 'buyer@example.com'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(2);
		expect(groups.map((g) => g.kind).sort()).toEqual(
			[DeliveryGroupKind.Shipping, DeliveryGroupKind.Digital].sort()
		);

		const shipping = groups.find((g) => g.kind === DeliveryGroupKind.Shipping);
		expect(shipping?.recipientAddress).toBe('123 ถ.สุขุมวิท');
	});

	it('keeps a digital-only walk-in cart to a single Digital group, so hasSplitDelivery stays false', () => {
		syncDeliveryGroups([digitalItem('d1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false,
			recipientEmail: 'buyer@example.com'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.Digital);
		expect(get(hasSplitDelivery)).toBe(false);
	});

	// Problem 1 — a digital-only sale still needs the delivery UI (the email is the
	// only destination it has), even though it never splits into more than one parcel.
	it('turns on showDeliveryDetail for a digital-only pickup sale despite staying a single group', () => {
		syncDeliveryGroups([digitalItem('d1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false,
			recipientEmail: 'buyer@example.com'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.Digital);
		expect(get(showDeliveryDetail)).toBe(true);
		expect(get(hasSplitDelivery)).toBe(false);
	});

	it('flags a digital-only group with no recipient email as missing, so the pay gate can fire', () => {
		syncDeliveryGroups([digitalItem('d1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
			// no recipientEmail — the voucher has nowhere to send itself.
		});

		const summary = get(deliverySummary);
		expect(summary.missing).toHaveLength(1);
		expect(summary.missing[0].kind).toBe(DeliveryGroupKind.Digital);
	});

	it('keeps showDeliveryDetail false for a physical-only pickup sale — the zero-cost path', () => {
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});

		expect(get(deliveryGroups)).toEqual([]);
		expect(get(showDeliveryDetail)).toBe(false);
	});

	it('keeps showDeliveryDetail false for a physical-only shopDelivery sale, a single Shipping group', () => {
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.Shipping);
		expect(get(showDeliveryDetail)).toBe(false);
	});

	// Problem 2 (reversed again) — a service item is performed AT the customer's site, so
	// a NEW one is still auto-suggested into its own OnSite group, same instinct as
	// Digital's hard split — but it is never locked: a regular product and a service line
	// can be split apart or combined freely by drag-and-drop, matching
	// FULFILLMENT_LOGIC.md §2.4 (a service item forces its HOST group toward on-site, it
	// does not forever own a group of its own).
	// Basic mode locks both category groups the moment more than one is present —
	// dragging items between them is an advanced-mode-only action now (see the
	// enableGroupOrder-based version of the drag test below).
	it('splits service + physical on a pickup sale into a locked OnSite group and a locked PickupInStore group', () => {
		syncDeliveryGroups([serviceItem('s1'), physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(2);
		expect(groups.map((g) => g.kind).sort()).toEqual(
			[DeliveryGroupKind.OnSite, DeliveryGroupKind.PickupInStore].sort()
		);

		const onSite = groups.find((g) => g.kind === DeliveryGroupKind.OnSite);
		expect(onSite?.locked).toBe(true);
		expect(onSite?.itemIds).toEqual(['s1']);

		const pickup = groups.find((g) => g.kind === DeliveryGroupKind.PickupInStore);
		expect(pickup?.itemIds).toEqual(['p1']);
	});

	// Dragging a line between category parcels is advanced-mode-only (basic mode's
	// category groups are locked the moment more than one category exists) — entering
	// group order first is what makes both groups cashier-reassignable soft splits.
	it('keeps a service item exactly where the cashier drags it across a re-sync, instead of re-claiming it back into OnSite', () => {
		const ctx = { fulfilmentType: FullfilmentType.PickupImmediate, isDelivery: false };
		enableGroupOrder([serviceItem('s1'), physicalItem('p1')], ctx);
		syncDeliveryGroups([serviceItem('s1'), physicalItem('p1')], ctx);

		const onSiteGroupId = get(deliveryGroups).find((g) => g.kind === DeliveryGroupKind.OnSite)?.id;
		const pickupGroupId = get(deliveryGroups).find(
			(g) => g.kind === DeliveryGroupKind.PickupInStore
		)?.id;
		expect(onSiteGroupId).toBeDefined();
		expect(pickupGroupId).toBeDefined();

		// The cashier drags the service item out of its suggested OnSite bucket and into
		// the ordinary pickup group, right beside the physical item.
		moveItemToGroup('s1', pickupGroupId as string);

		// An unrelated cart change (qty bump, another sync tick) must not undo that move.
		syncDeliveryGroups([serviceItem('s1'), physicalItem('p1')], ctx);

		const groups = get(deliveryGroups);
		const onSiteAfter = groups.find((g) => g.id === onSiteGroupId);
		const pickupAfter = groups.find((g) => g.id === pickupGroupId);
		expect(onSiteAfter).toBeUndefined(); // emptied out, so it's gone — same as any other
		expect(pickupAfter?.itemIds.sort()).toEqual(['p1', 's1']);
	});

	it('splits service + digital into Digital and OnSite groups — neither holding the other item', () => {
		syncDeliveryGroups([serviceItem('s1'), digitalItem('d1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false,
			recipientEmail: 'buyer@example.com'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(2);

		const digital = groups.find((g) => g.kind === DeliveryGroupKind.Digital);
		const onSite = groups.find((g) => g.kind === DeliveryGroupKind.OnSite);
		expect(digital?.itemIds).toEqual(['d1']);
		expect(onSite?.itemIds).toEqual(['s1']);
		expect(digital?.itemIds.includes('s1')).toBe(false);
		expect(onSite?.itemIds.includes('d1')).toBe(false);
	});

	it('builds exactly one unlocked OnSite group for a service-only cart', () => {
		syncDeliveryGroups([serviceItem('s1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.OnSite);
		expect(groups[0].locked).toBe(false);
		expect(groups[0].itemIds).toEqual(['s1']);
	});

	// The sale-level OnSite fulfilment choice (physicalKindFor) must build an OnSite
	// default group even for perfectly ordinary physical items — the cashier picked this
	// fulfilment for the WHOLE sale, not because any one line is flagged "service". Without
	// the isOnSiteSale carve-out in the early-return guard, this cart (no digital/service
	// item, ctx.isDelivery false) would build no groups at all and lose its address/fee.
	// Basic mode's own line-fulfilment options never offer OnSite to a plain physical
	// item (only a service line forces it — see lineFulfilmentOptions), so a sale-wide
	// OnSite pick for ordinary physical items is advanced-mode-only now; enter it first.
	it('builds an OnSite default group for ordinary physical items when the SALE fulfilment is OnSite', () => {
		const ctx = {
			fulfilmentType: FullfilmentType.OnSite,
			isDelivery: false,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		};
		enableGroupOrder([physicalItem('p1'), physicalItem('p2')], ctx);
		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], ctx);

		const groups = get(deliveryGroups);
		const onSite = groups.find((g) => g.kind === DeliveryGroupKind.OnSite);
		expect(onSite).toBeDefined();
		expect(onSite?.itemIds.sort()).toEqual(['p1', 'p2']);
		expect(onSite?.recipientAddress).toBe('123 ถ.สุขุมวิท');
	});

	it('picks up recipientAddress/recipientName from ctx on the auto-suggested OnSite group', () => {
		syncDeliveryGroups([serviceItem('s1'), physicalItem('p1')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const groups = get(deliveryGroups);
		const onSite = groups.find((g) => g.kind === DeliveryGroupKind.OnSite);
		expect(onSite?.recipientName).toBe('คุณลูกค้า');
		expect(onSite?.recipientAddress).toBe('123 ถ.สุขุมวิท');
	});

	it('reuses the same auto-suggested OnSite group across a re-sync instead of recreating it', () => {
		syncDeliveryGroups([serviceItem('s1'), physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});
		const firstOnSiteId = get(deliveryGroups).find((g) => g.kind === DeliveryGroupKind.OnSite)?.id;

		syncDeliveryGroups([serviceItem('s1'), physicalItem('p1'), physicalItem('p2')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});
		const secondOnSiteId = get(deliveryGroups).find((g) => g.kind === DeliveryGroupKind.OnSite)?.id;

		expect(secondOnSiteId).toBeDefined();
		expect(secondOnSiteId).toBe(firstOnSiteId);
	});
});

// VITE_DISABLE_MULTI_PARCEL: no backend emails a digital parcel yet, so production can
// switch the whole feature off (feature-flags.ts). Disabled must behave exactly like the
// empty-cart case — no groups at all, even for a cart that would otherwise hard-split.
describe('syncDeliveryGroups — VITE_DISABLE_MULTI_PARCEL', () => {
	beforeEach(() => {
		resetDeliveryGroups();
	});

	afterEach(() => {
		// Every other describe block in this file assumes the feature is on.
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	it('produces no groups for a physical + digital shopDelivery cart while the flag is disabled', () => {
		isMultiParcelEnabledMock.mockReturnValue(false);

		syncDeliveryGroups([physicalItem('p1'), digitalItem('d1')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท',
			recipientEmail: 'buyer@example.com'
		});

		expect(get(deliveryGroups)).toEqual([]);
		expect(get(showDeliveryDetail)).toBe(false);
		expect(get(hasSplitDelivery)).toBe(false);
	});

	it('still splits the same cart into 2 groups once the flag is enabled again', () => {
		isMultiParcelEnabledMock.mockReturnValue(true);

		syncDeliveryGroups([physicalItem('p1'), digitalItem('d1')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท',
			recipientEmail: 'buyer@example.com'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(2);
		expect(groups.map((g) => g.kind).sort()).toEqual(
			[DeliveryGroupKind.Shipping, DeliveryGroupKind.Digital].sort()
		);
	});
});

// Problem 3 — "+ แยกพัสดุเพิ่ม" used to build a parcel that syncDeliveryGroups (or
// moveItemToGroup) immediately erased again for being empty, before the cashier had a
// chance to move anything into it.
describe('syncDeliveryGroups — user-made empty parcel survives a re-sync', () => {
	beforeEach(() => {
		resetDeliveryGroups();
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	// "+ แยกพัสดุเพิ่ม" only exists in advanced (group-order) mode — basic mode has no
	// cashier-made parcels at all, only its own fixed category buckets.
	it('keeps an empty parcel the cashier just added after the next sync run', () => {
		enableGroupOrder([physicalItem('p1'), physicalItem('p2')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const userGroupId = addUserDeliveryGroup();

		// Re-run sync with the exact same cart — nothing has been moved into the new
		// parcel yet, which is exactly the moment the old auto-collapse used to fire.
		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const userGroup = get(deliveryGroups).find((g) => g.id === userGroupId);
		expect(userGroup).toBeDefined();
		expect(userGroup?.itemIds).toEqual([]);
	});
});

// A pickup/pickup-later sale with no digital item builds no groups at all by default
// (the zero-cost path, see "leaves the group list empty..." above) — enableGroupOrder is
// the cashier's own opt-in past that, mirroring "สร้างคำสั่งขายกลุ่ม" in the reference
// prototype for the two pickup fulfilments, not just ShopDelivery.
describe('syncDeliveryGroups — enableGroupOrder on a pickup sale', () => {
	beforeEach(() => {
		resetDeliveryGroups();
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	it('folds items already in the cart into their own promoted "group 1" immediately, not just on the next sync', () => {
		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});
		expect(get(deliveryGroups)).toEqual([]); // not split yet — the zero-cost path

		const newGroupId = enableGroupOrder(
			[physicalItem('p1'), physicalItem('p2')],
			{
				fulfilmentType: FullfilmentType.PickupImmediate,
				isDelivery: false
			},
			DeliveryGroupKind.PickupInStore
		);

		// No second syncDeliveryGroups call here — this must already be true right after
		// enableGroupOrder returns, with no unrelated cart edit needed in between.
		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(2);

		const groupOne = groups.find((g) => g.id !== newGroupId);
		expect(groupOne?.itemIds.sort()).toEqual(['p1', 'p2']);
		expect(groupOne?.splitReason).toBe(SplitReason.User);
		expect(groupOne?.locked).toBe(false);

		const groupTwo = groups.find((g) => g.id === newGroupId);
		expect(groupTwo?.itemIds).toEqual([]);
		expect(groupTwo?.splitReason).toBe(SplitReason.User);
	});

	// Basic mode's own zero-cost collapse only fires for PickupInStore (รับทันที — nothing
	// to track) — a PickupLater sale still needs its own single plain group so the branch
	// the customer collects from (pickupStoreId) has somewhere to live.
	it('without enableGroupOrder, a PickupLater sale with no digital item still builds its own single plain group', () => {
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupLater,
			isDelivery: false,
			pickupStoreId: 'store-1'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.PickupLater);
		expect(groups[0].locked).toBe(false);
		expect(groups[0].splitReason).toBeUndefined();
		expect(groups[0].pickupStoreId).toBe('store-1');
	});

	it('without enableGroupOrder, a PickupImmediate sale with no digital item still clears groups on sync — regression guard', () => {
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});

		expect(get(deliveryGroups)).toEqual([]);
	});

	it('keeps a manually-started split alive across a re-sync on a PickupImmediate sale', () => {
		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});
		expect(get(deliveryGroups)).toEqual([]); // not split yet

		enableGroupOrder(
			[physicalItem('p1'), physicalItem('p2')],
			{ fulfilmentType: FullfilmentType.PickupImmediate, isDelivery: false },
			DeliveryGroupKind.PickupInStore
		);

		// An unrelated cart change (e.g. a qty bump) re-triggers sync exactly like
		// Cart.svelte's own reactive call — the split must survive it.
		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});

		const groups = get(deliveryGroups);
		expect(groups.length).toBeGreaterThan(1);
		expect(groups.every((g) => g.kind === DeliveryGroupKind.PickupInStore)).toBe(true);
	});

	it('keeps a manually-started split alive across a re-sync on a PickupLater sale', () => {
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupLater,
			isDelivery: false
		});
		enableGroupOrder(
			[physicalItem('p1')],
			{ fulfilmentType: FullfilmentType.PickupLater, isDelivery: false },
			DeliveryGroupKind.PickupLater
		);
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupLater,
			isDelivery: false
		});

		expect(get(deliveryGroups).length).toBeGreaterThan(1);
	});

	it('does not leak groupOrderActive forward once removal collapses back to a single group', () => {
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});
		const userGroupId = enableGroupOrder(
			[physicalItem('p1')],
			{ fulfilmentType: FullfilmentType.PickupImmediate, isDelivery: false },
			DeliveryGroupKind.PickupInStore
		);
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});
		expect(get(deliveryGroups).length).toBeGreaterThan(1);

		removeUserDeliveryGroup(userGroupId);
		expect(get(deliveryGroups)).toHaveLength(1);

		// A later, unrelated pickup sale (same session state) must not inherit a stale
		// "stay split" flag from the sale that just finished.
		syncDeliveryGroups([physicalItem('p3')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});
		expect(get(deliveryGroups)).toEqual([]);
	});
});

// Problem 3 (continued) — the new parcel must match how the rest of the sale is being
// collected, and must never be created as Digital (that split is the engine's, not the
// cashier's).
describe('addUserDeliveryGroup kind', () => {
	beforeEach(() => {
		resetDeliveryGroups();
	});

	it('creates a parcel of the requested kind', () => {
		const id = addUserDeliveryGroup(DeliveryGroupKind.PickupInStore);
		expect(get(deliveryGroups).find((g) => g.id === id)?.kind).toBe(
			DeliveryGroupKind.PickupInStore
		);
	});

	it('falls back to Shipping when asked for Digital — a digital parcel is a hard split, never a cashier one', () => {
		const id = addUserDeliveryGroup(DeliveryGroupKind.Digital);
		expect(get(deliveryGroups).find((g) => g.id === id)?.kind).toBe(DeliveryGroupKind.Shipping);
	});
});

describe('removeUserDeliveryGroup / restoreDeliveryGroup', () => {
	beforeEach(() => {
		resetDeliveryGroups();
	});

	it('removes an empty user group outright — nothing to relocate', () => {
		const userGroupId = addUserDeliveryGroup();

		expect(canRemoveDeliveryGroup(get(deliveryGroups), userGroupId)).toBe(true);

		const removed = removeUserDeliveryGroup(userGroupId);

		expect(removed?.group.id).toBe(userGroupId);
		expect(removed?.targetGroupId).toBeUndefined();
		expect(get(deliveryGroups)).toHaveLength(0);
	});

	it('merges a user group holding items into the default group and returns its id', () => {
		const defaultGroup = newDeliveryGroup({ itemIds: ['p1'] });
		const userGroup = newDeliveryGroup({
			splitReason: SplitReason.User,
			locked: false,
			itemIds: ['p2']
		});
		deliveryGroups.set([defaultGroup, userGroup]);

		expect(canRemoveDeliveryGroup(get(deliveryGroups), userGroup.id)).toBe(true);

		const removed = removeUserDeliveryGroup(userGroup.id);

		expect(removed?.targetGroupId).toBe(defaultGroup.id);
		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].id).toBe(defaultGroup.id);
		expect([...groups[0].itemIds].sort()).toEqual(['p1', 'p2']);
	});

	it('refuses to remove a locked group — the store is left unchanged', () => {
		const locked = newDeliveryGroup({
			splitReason: SplitReason.Origin,
			locked: true,
			itemIds: ['p1']
		});
		deliveryGroups.set([locked]);

		expect(canRemoveDeliveryGroup(get(deliveryGroups), locked.id)).toBe(false);
		expect(removeUserDeliveryGroup(locked.id)).toBeUndefined();
		expect(get(deliveryGroups)).toEqual([locked]);
	});

	it('refuses to remove the default group — the store is left unchanged', () => {
		const defaultGroup = newDeliveryGroup({ itemIds: ['p1'] });
		deliveryGroups.set([defaultGroup]);

		expect(canRemoveDeliveryGroup(get(deliveryGroups), defaultGroup.id)).toBe(false);
		expect(removeUserDeliveryGroup(defaultGroup.id)).toBeUndefined();
		expect(get(deliveryGroups)).toEqual([defaultGroup]);
	});

	it('restores a removed group at its original index and takes its items back off the receiver', () => {
		const defaultGroup = newDeliveryGroup({ itemIds: ['p1'] });
		const userGroup = newDeliveryGroup({
			splitReason: SplitReason.User,
			locked: false,
			itemIds: ['p2']
		});
		const another = newDeliveryGroup({
			splitReason: SplitReason.User,
			locked: false,
			itemIds: ['p3']
		});
		deliveryGroups.set([defaultGroup, userGroup, another]);

		const removed = removeUserDeliveryGroup(userGroup.id);
		expect(removed).toBeDefined();
		// Confirm the merge actually happened before restoring it.
		expect(get(deliveryGroups).find((g) => g.id === defaultGroup.id)?.itemIds).toContain('p2');

		restoreDeliveryGroup(removed!);

		const groups = get(deliveryGroups);
		expect(groups.map((g) => g.id)).toEqual([defaultGroup.id, userGroup.id, another.id]);
		expect(groups.find((g) => g.id === userGroup.id)?.itemIds).toEqual(['p2']);
		expect(groups.find((g) => g.id === defaultGroup.id)?.itemIds).toEqual(['p1']);
	});
});

// "รับบางส่วน" — a POS จัดส่งให้ลูกค้า sale can hand some lines over at the counter now
// while the rest still ship, instead of the whole sale being all-ship or all-pickup.
// Every case here sets allowPartialReceive/isDelivery explicitly since that's the one
// combination the feature is gated on (see syncDeliveryGroups step 1.5).
describe('partial receive (รับบางส่วน)', () => {
	beforeEach(() => {
		resetDeliveryGroups();
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	it('splits a ShopDelivery sale with one "now" item into a locked handover group plus a Shipping group', () => {
		syncDeliveryGroups(
			[physicalItem('p1', { receiveMode: ReceiveMode.Now }), physicalItem('p2')],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				allowPartialReceive: true,
				recipientName: 'คุณลูกค้า',
				recipientAddress: '123 ถ.สุขุมวิท'
			}
		);

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(2);

		const handover = groups.find((g) => g.splitReason === SplitReason.Receive);
		expect(handover?.kind).toBe(DeliveryGroupKind.PickupInStore);
		expect(handover?.locked).toBe(true);
		expect(handover?.shippingFee).toBe(0);
		expect(handover?.itemIds).toEqual(['p1']);

		const shipping = groups.find((g) => g.kind === DeliveryGroupKind.Shipping);
		expect(shipping?.itemIds).toEqual(['p2']);
	});

	it('collapses to a single handover group when every line is "now" — no delivery detail needed, nothing missing', () => {
		syncDeliveryGroups(
			[
				physicalItem('p1', { receiveMode: ReceiveMode.Now }),
				physicalItem('p2', { receiveMode: ReceiveMode.Now })
			],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				allowPartialReceive: true,
				recipientName: 'คุณลูกค้า',
				recipientAddress: '123 ถ.สุขุมวิท'
			}
		);

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].splitReason).toBe(SplitReason.Receive);
		expect(get(showDeliveryDetail)).toBe(false);
		expect(get(deliverySummary).missing).toEqual([]);
	});

	it('keeps a digital item in its own locked Digital group even when marked "now", never in the handover group', () => {
		syncDeliveryGroups(
			[
				digitalItem('d1', { receiveMode: ReceiveMode.Now }),
				physicalItem('p1', { receiveMode: ReceiveMode.Now })
			],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				allowPartialReceive: true,
				recipientEmail: 'buyer@example.com'
			}
		);

		const groups = get(deliveryGroups);
		const digital = groups.find((g) => g.kind === DeliveryGroupKind.Digital);
		expect(digital?.itemIds).toEqual(['d1']);

		// The digital step (1) claims d1 before step 1.5 ever runs, so it is never even a
		// candidate for the handover group — it stays "its own locked group" by construction.
		const handover = groups.find((g) => g.splitReason === SplitReason.Receive);
		expect(handover?.itemIds).toEqual(['p1']);
		expect(handover?.itemIds.includes('d1')).toBe(false);
	});

	it('ignores receiveMode entirely when allowPartialReceive is omitted or false', () => {
		syncDeliveryGroups(
			[physicalItem('p1', { receiveMode: ReceiveMode.Now }), physicalItem('p2')],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				recipientName: 'คุณลูกค้า',
				recipientAddress: '123 ถ.สุขุมวิท'
				// allowPartialReceive omitted — every other sale ignores receiveMode.
			}
		);

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.Shipping);
		expect([...groups[0].itemIds].sort()).toEqual(['p1', 'p2']);
	});

	it('never lists the handover group as missing a destination — pickup kinds are always destination-ready', () => {
		syncDeliveryGroups(
			[physicalItem('p1', { receiveMode: ReceiveMode.Now }), physicalItem('p2')],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				allowPartialReceive: true
				// no recipientAddress at all — the Shipping group is the one missing a
				// destination here, never the handover group.
			}
		);

		const summary = get(deliverySummary);
		const handover = get(deliveryGroups).find((g) => g.splitReason === SplitReason.Receive);
		expect(handover).toBeDefined();
		expect(summary.missing.some((g) => g.id === handover?.id)).toBe(false);
	});

	it('excludes the handover group from parcelCount but keeps it in count', () => {
		syncDeliveryGroups(
			[physicalItem('p1', { receiveMode: ReceiveMode.Now }), physicalItem('p2')],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				allowPartialReceive: true,
				recipientName: 'คุณลูกค้า',
				recipientAddress: '123 ถ.สุขุมวิท'
			}
		);

		const summary = get(deliverySummary);
		expect(summary.count).toBe(2);
		expect(summary.parcelCount).toBe(1);
		expect(summary.handoverGroup?.splitReason).toBe(SplitReason.Receive);
	});

	// Regression — a sale manually split into a pickup-now group, a pickup-later group,
	// and ONE real Shipping parcel used to read as "ค่าจัดส่ง (3 พัสดุ) ยังไม่ครบ" even
	// when that one real parcel already had its courier/fee fully set: feeUnknown checked
	// EVERY group's shippingFee for undefined, and a pickup group's is always undefined
	// (never asked for one), not actually missing anything.
	it('feeUnknown only looks at groups that actually need a fee, not pickup groups sitting beside them', () => {
		// A real Shipping default group to start from (ShopDelivery), holding all three
		// items — then two of them are dragged out into plain pickup groups, leaving the
		// default group as the one-and-only Shipping parcel.
		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2'), physicalItem('p3')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});
		const shippingGroup = get(deliveryGroups)[0];

		const pickupNowId = addUserDeliveryGroup(DeliveryGroupKind.PickupInStore);
		const pickupLaterId = addUserDeliveryGroup(DeliveryGroupKind.PickupLater);
		moveItemToGroup('p1', pickupNowId);
		moveItemToGroup('p2', pickupLaterId);
		updateDeliveryGroup(shippingGroup.id, { method: 'kex', shippingFee: 100 });

		const summary = get(deliverySummary);
		expect(summary.shippingCount).toBe(1);
		expect(summary.feeUnknown).toBe(false);
	});

	// Origin-aware blocking (canReceiveNow) only exists in the advanced engine — basic
	// mode's own legacy-receiveMode fallback (resolveLineKind) has no origin concept at
	// all (basic mode never splits by origin, period), so this now needs group order mode.
	it('blocks a "now" item from a foreign origin — it ships instead of joining the handover group', () => {
		const items = [
			physicalItem('p1', {
				receiveMode: ReceiveMode.Now,
				originId: 'origin-b',
				originName: 'คลัง B'
			}),
			physicalItem('p2')
		];
		const ctx = {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			allowPartialReceive: true,
			sellingOriginId: 'origin-a',
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		};
		enableGroupOrder(items, ctx);
		syncDeliveryGroups(items, ctx);

		const groups = get(deliveryGroups);
		expect(groups.some((g) => g.splitReason === SplitReason.Receive)).toBe(false);
		// p1 falls through to the ordinary Shipping group instead — the ▲ toggle would
		// already have been disabled for it, so this is stale state, and shipping is safe.
		// enableGroupOrder also appends its own empty user parcel — only the group that
		// actually holds the items is under test here.
		const shipping = groups.find((g) => g.itemIds.length > 0);
		expect(shipping?.kind).toBe(DeliveryGroupKind.Shipping);
		expect([...(shipping?.itemIds ?? [])].sort()).toEqual(['p1', 'p2']);
	});
});

// Pure unit tests — every caller of the "can this line be received now" rule goes through
// this one function, so its own behaviour is worth pinning down independent of the store.
describe('receiveNowBlockReason', () => {
	it('blocks a digital item — email is its only destination', () => {
		expect(receiveNowBlockReason({ fulfilmentType: ItemFulfilmentType.Digital })).toBe(
			'สินค้าดิจิทัลส่งทางอีเมลเท่านั้น'
		);
	});

	it('allows a plain physical item with no origin recorded', () => {
		expect(
			receiveNowBlockReason({ fulfilmentType: ItemFulfilmentType.Physical })
		).toBeUndefined();
	});

	it('blocks an item whose origin differs from the selling origin', () => {
		expect(
			receiveNowBlockReason(
				{ fulfilmentType: ItemFulfilmentType.Physical, originId: 'b', originName: 'คลัง B' },
				{ sellingOriginId: 'a' }
			)
		).toBe('สินค้ามาจากคลัง B — รับที่สาขานี้ไม่ได้');
	});

	it('allows a foreign-origin item once the selling origin is unknown — the check is disabled, not failed-open by accident', () => {
		expect(
			receiveNowBlockReason({ fulfilmentType: ItemFulfilmentType.Physical, originId: 'b' }, {})
		).toBeUndefined();
	});
});

// "Shop into this parcel" — prototype's activeGroupId. A product tapped while a
// cashier-made parcel is active lands in it; everything the engine owns still wins.
// "Shop into this parcel" (activeDeliveryGroupId) only means anything once a cashier has
// their own named parcels to shop into — i.e. advanced (group-order) mode. Basic mode has
// no such concept: its category groups are system-built, never a destination a tapped
// product gets routed into. Every test below enters group order first.
describe('active delivery group', () => {
	const ctx = {
		fulfilmentType: FullfilmentType.ShopDelivery,
		isDelivery: true,
		recipientName: 'คุณลูกค้า',
		recipientAddress: '123 ถ.สุขุมวิท'
	};

	beforeEach(() => {
		resetDeliveryGroups();
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	const groupOf = (itemId: string) => get(deliveryGroups).find((g) => g.itemIds.includes(itemId));

	it('puts a newly added line into the active user parcel instead of the default one', () => {
		enableGroupOrder([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup();
		setActiveDeliveryGroup(userId);

		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], ctx);

		expect(groupOf('p2')?.id).toBe(userId);
		expect(groupOf('p1')?.id).not.toBe(userId);
	});

	it('leaves a line that already had a parcel where it is (qty bump is not a new line)', () => {
		enableGroupOrder([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup();
		setActiveDeliveryGroup(userId);

		syncDeliveryGroups([physicalItem('p1', { qty: 3 })], ctx);

		expect(groupOf('p1')?.id).not.toBe(userId);
	});

	it('with nothing active, new lines keep going to the default parcel', () => {
		enableGroupOrder([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup();

		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], ctx);

		expect(groupOf('p2')?.id).not.toBe(userId);
	});

	it('never lets a digital line into the active parcel — the hard split still wins', () => {
		enableGroupOrder([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup();
		setActiveDeliveryGroup(userId);

		syncDeliveryGroups([physicalItem('p1'), digitalItem('d1')], ctx);

		expect(groupOf('d1')?.kind).toBe(DeliveryGroupKind.Digital);
		expect(groupOf('d1')?.id).not.toBe(userId);
	});

	// Pure predicate test — constructs the groups directly rather than via sync, since a
	// "locked hard split sitting beside an untouched default group" is just a shape, not
	// something either basic or advanced mode's engine necessarily produces on its own.
	it('refuses to activate a locked or default parcel', () => {
		const digital = newDeliveryGroup({
			kind: DeliveryGroupKind.Digital,
			locked: true,
			splitReason: SplitReason.Product
		});
		const normal = newDeliveryGroup({ locked: false });
		deliveryGroups.set([digital, normal]);

		setActiveDeliveryGroup(digital.id);
		expect(get(activeDeliveryGroupId)).toBeUndefined();
		setActiveDeliveryGroup(normal.id);
		expect(get(activeDeliveryGroupId)).toBeUndefined();
	});

	it('clears itself when the active parcel is removed or the cart empties', () => {
		syncDeliveryGroups([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup();
		setActiveDeliveryGroup(userId);
		expect(get(activeDeliveryGroupId)).toBe(userId);

		removeUserDeliveryGroup(userId);
		expect(get(activeDeliveryGroupId)).toBeUndefined();

		const again = addUserDeliveryGroup();
		setActiveDeliveryGroup(again);
		syncDeliveryGroups([], ctx);
		expect(get(activeDeliveryGroupId)).toBeUndefined();
	});
});

// Each sale-order-group card now independently picks its own kind — only a cashier-made
// (soft-split, SplitReason.User) group is theirs to reassign; the two real hard splits
// (Digital, the "รับบางส่วน" handover pile) stay engine-owned, never manually assignable.
describe('canChangeGroupKind', () => {
	it('allows a cashier-made (soft-split) group', () => {
		const userGroup = newDeliveryGroup({ splitReason: SplitReason.User, locked: false });
		expect(canChangeGroupKind(userGroup)).toBe(true);
	});

	it('refuses the hard-split Digital group', () => {
		const digital = newDeliveryGroup({
			kind: DeliveryGroupKind.Digital,
			splitReason: SplitReason.Product,
			locked: true
		});
		expect(canChangeGroupKind(digital)).toBe(false);
	});

	it('refuses the locked "รับบางส่วน" handover group', () => {
		const handover = newDeliveryGroup({
			kind: DeliveryGroupKind.PickupInStore,
			splitReason: SplitReason.Receive,
			locked: true
		});
		expect(canChangeGroupKind(handover)).toBe(false);
	});
});

describe('updateDeliveryGroup kind change survives a re-sync', () => {
	beforeEach(() => {
		resetDeliveryGroups();
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	// Soft-split groups keeping a manually-changed kind across a re-sync (step 3 of the
	// advanced engine) is advanced-mode-only — basic mode's syncBasicGroups rebuilds its
	// category groups from scratch every time, with no concept of a cashier override.
	it('keeps a user group on the kind it was switched to across the next sync', () => {
		const ctx = {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		};
		enableGroupOrder([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup(DeliveryGroupKind.Shipping);

		updateDeliveryGroup(userId, { kind: DeliveryGroupKind.OnSite, shippingFee: 150 });

		syncDeliveryGroups([physicalItem('p1')], ctx);

		const userGroup = get(deliveryGroups).find((g) => g.id === userId);
		expect(userGroup?.kind).toBe(DeliveryGroupKind.OnSite);
		expect(userGroup?.shippingFee).toBe(150);
	});
});

describe('groupKindLabel wording', () => {
	it('matches the mockup text for all 5 kinds', () => {
		expect(groupKindLabel(DeliveryGroupKind.PickupInStore)).toBe('รับทันที');
		expect(groupKindLabel(DeliveryGroupKind.PickupLater)).toBe('รับภายหลัง');
		expect(groupKindLabel(DeliveryGroupKind.Shipping)).toBe('จัดส่งจากร้าน');
		expect(groupKindLabel(DeliveryGroupKind.Digital)).toBe('จัดส่งเข้าระบบ (ดิจิทัล)');
		expect(groupKindLabel(DeliveryGroupKind.OnSite)).toBe('ให้บริการที่สถานที่ลูกค้า');
	});
});

// ---------------------------------------------------------------------------------------
// Pure unit tests — isMarketplaceChannel / lineFulfilmentOptions / resolveLineKind
// ---------------------------------------------------------------------------------------

describe('isMarketplaceChannel', () => {
	it('treats shopee, lazada and tiktok as marketplace sub-channels', () => {
		expect(isMarketplaceChannel('shopee')).toBe(true);
		expect(isMarketplaceChannel('lazada')).toBe(true);
		expect(isMarketplaceChannel('tiktok')).toBe(true);
	});

	it('treats everything else, including undefined, as not a marketplace', () => {
		expect(isMarketplaceChannel('line')).toBe(false);
		expect(isMarketplaceChannel(undefined)).toBe(false);
	});
});

describe('lineFulfilmentOptions', () => {
	it('gives a digital item exactly one option: Digital', () => {
		expect(
			lineFulfilmentOptions({ fulfilmentType: ItemFulfilmentType.Digital }, { channel: 'pos', marketplace: false })
		).toEqual([DeliveryGroupKind.Digital]);
	});

	it('gives a service item exactly one option: OnSite', () => {
		expect(
			lineFulfilmentOptions({ fulfilmentType: ItemFulfilmentType.Service }, { channel: 'online', marketplace: false })
		).toEqual([DeliveryGroupKind.OnSite]);
	});

	it('gives a marketplace physical line exactly one option: Shipping', () => {
		expect(
			lineFulfilmentOptions({ fulfilmentType: ItemFulfilmentType.Physical }, { channel: 'online', marketplace: true })
		).toEqual([DeliveryGroupKind.Shipping]);
	});

	it('gives an online/link-bill physical line Shipping or PickupLater — no counter to hand it over at', () => {
		expect(
			lineFulfilmentOptions({ fulfilmentType: ItemFulfilmentType.Physical }, { channel: 'online', marketplace: false })
		).toEqual([DeliveryGroupKind.Shipping, DeliveryGroupKind.PickupLater]);
		expect(
			lineFulfilmentOptions({ fulfilmentType: ItemFulfilmentType.Physical }, { channel: 'linkbill', marketplace: false })
		).toEqual([DeliveryGroupKind.Shipping, DeliveryGroupKind.PickupLater]);
	});

	it('gives a POS physical line the full 3-way choice', () => {
		expect(
			lineFulfilmentOptions({ fulfilmentType: ItemFulfilmentType.Physical }, { channel: 'pos', marketplace: false })
		).toEqual([DeliveryGroupKind.PickupInStore, DeliveryGroupKind.PickupLater, DeliveryGroupKind.Shipping]);
	});
});

describe('resolveLineKind', () => {
	const pos = { channel: 'pos' as const, marketplace: false };

	it('forces digital/service/marketplace kinds regardless of lineFulfilment or receiveMode', () => {
		expect(
			resolveLineKind(
				{ fulfilmentType: ItemFulfilmentType.Digital, lineFulfilment: DeliveryGroupKind.Shipping },
				DeliveryGroupKind.PickupInStore,
				pos
			)
		).toBe(DeliveryGroupKind.Digital);
		expect(
			resolveLineKind({ fulfilmentType: ItemFulfilmentType.Service }, DeliveryGroupKind.PickupInStore, pos)
		).toBe(DeliveryGroupKind.OnSite);
		expect(
			resolveLineKind(
				{ fulfilmentType: ItemFulfilmentType.Physical },
				DeliveryGroupKind.PickupLater,
				{ channel: 'online', marketplace: true }
			)
		).toBe(DeliveryGroupKind.Shipping);
	});

	it("honours the cashier's own explicit lineFulfilment pick when it is a legal option", () => {
		expect(
			resolveLineKind(
				{ fulfilmentType: ItemFulfilmentType.Physical, lineFulfilment: DeliveryGroupKind.Shipping },
				DeliveryGroupKind.PickupInStore,
				pos
			)
		).toBe(DeliveryGroupKind.Shipping);
	});

	it('ignores an illegal lineFulfilment pick and falls through to the next rule', () => {
		expect(
			resolveLineKind(
				// PickupInStore is not a legal option for an online physical line.
				{ fulfilmentType: ItemFulfilmentType.Physical, lineFulfilment: DeliveryGroupKind.PickupInStore },
				DeliveryGroupKind.Shipping,
				{ channel: 'online', marketplace: false }
			)
		).toBe(DeliveryGroupKind.Shipping);
	});

	it('honours legacy receiveMode "now" as PickupInStore on POS when lineFulfilment is unset', () => {
		expect(
			resolveLineKind(
				{ fulfilmentType: ItemFulfilmentType.Physical, receiveMode: ReceiveMode.Now },
				DeliveryGroupKind.Shipping,
				pos
			)
		).toBe(DeliveryGroupKind.PickupInStore);
	});

	it('ignores legacy receiveMode on a non-POS channel', () => {
		expect(
			resolveLineKind(
				{ fulfilmentType: ItemFulfilmentType.Physical, receiveMode: ReceiveMode.Now },
				DeliveryGroupKind.Shipping,
				{ channel: 'online', marketplace: false }
			)
		).toBe(DeliveryGroupKind.Shipping);
	});

	it('falls back to the sale default when it is a legal option', () => {
		expect(
			resolveLineKind({ fulfilmentType: ItemFulfilmentType.Physical }, DeliveryGroupKind.Shipping, pos)
		).toBe(DeliveryGroupKind.Shipping);
	});

	it('falls back to the first legal option when the sale default is not one', () => {
		expect(
			resolveLineKind(
				{ fulfilmentType: ItemFulfilmentType.Physical },
				DeliveryGroupKind.OnSite,
				{ channel: 'online', marketplace: false }
			)
		).toBe(DeliveryGroupKind.Shipping);
	});
});

// ---------------------------------------------------------------------------------------
// Basic mode scenarios B1–B8 — the default whenever groupOrderActive is false: split ONLY
// by fulfilment category, one shared destination per category.
// ---------------------------------------------------------------------------------------

describe('basic mode — fulfilment-grouping scenarios', () => {
	beforeEach(() => {
		resetDeliveryGroups();
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	it('B1 — POS walk-in, everything รับทันที: no groups at all, the zero-cost path', () => {
		syncDeliveryGroups(
			[physicalItem('coffee-1'), physicalItem('coffee-2'), physicalItem('beans')],
			{ fulfilmentType: FullfilmentType.PickupImmediate, isDelivery: false, channel: 'pos' }
		);

		expect(get(deliveryGroups)).toEqual([]);
	});

	it('B2 — online: physical + on-site service + e-voucher split into Shipping / OnSite / Digital, Shipping and OnSite sharing the customer address', () => {
		syncDeliveryGroups(
			[physicalItem('grinder'), serviceItem('install'), digitalItem('voucher')],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				channel: 'online',
				recipientName: 'คุณลูกค้า',
				recipientAddress: '123 ถ.สุขุมวิท',
				recipientEmail: 'buyer@example.com'
			}
		);

		const groups = get(deliveryGroups);
		expect(groups.map((g) => g.kind).sort()).toEqual(
			[DeliveryGroupKind.Shipping, DeliveryGroupKind.OnSite, DeliveryGroupKind.Digital].sort()
		);

		const shipping = groups.find((g) => g.kind === DeliveryGroupKind.Shipping);
		const onSite = groups.find((g) => g.kind === DeliveryGroupKind.OnSite);
		expect(shipping?.recipientAddress).toBe('123 ถ.สุขุมวิท');
		expect(onSite?.recipientAddress).toBe('123 ถ.สุขุมวิท');
	});

	it('B3 — POS: coffee รับทันที + a machine line switched to Shipping → PickupInStore / Shipping', () => {
		syncDeliveryGroups(
			[physicalItem('coffee'), physicalItem('machine', { lineFulfilment: DeliveryGroupKind.Shipping })],
			{
				fulfilmentType: FullfilmentType.PickupImmediate,
				isDelivery: false,
				channel: 'pos',
				recipientName: 'คุณลูกค้า',
				recipientAddress: '123 ถ.สุขุมวิท'
			}
		);

		const groups = get(deliveryGroups);
		expect(groups.map((g) => g.kind).sort()).toEqual(
			[DeliveryGroupKind.PickupInStore, DeliveryGroupKind.Shipping].sort()
		);
		expect(groups.find((g) => g.kind === DeliveryGroupKind.PickupInStore)?.itemIds).toEqual(['coffee']);
		expect(groups.find((g) => g.kind === DeliveryGroupKind.Shipping)?.itemIds).toEqual(['machine']);
	});

	it('B4 — POS: coffee รับทันที + beans switched to PickupLater → PickupInStore / PickupLater, PickupLater carrying the sale pickupStoreId', () => {
		syncDeliveryGroups(
			[physicalItem('coffee'), physicalItem('beans', { lineFulfilment: DeliveryGroupKind.PickupLater })],
			{
				fulfilmentType: FullfilmentType.PickupImmediate,
				isDelivery: false,
				channel: 'pos',
				pickupStoreId: 'store-42'
			}
		);

		const groups = get(deliveryGroups);
		expect(groups.map((g) => g.kind).sort()).toEqual(
			[DeliveryGroupKind.PickupInStore, DeliveryGroupKind.PickupLater].sort()
		);
		const pickupLater = groups.find((g) => g.kind === DeliveryGroupKind.PickupLater);
		expect(pickupLater?.itemIds).toEqual(['beans']);
		expect(pickupLater?.pickupStoreId).toBe('store-42');
	});

	it('B5 — Shipping item + e-voucher → Shipping (customer address) / Digital (email or phone)', () => {
		syncDeliveryGroups([physicalItem('item'), digitalItem('voucher')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			channel: 'online',
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท',
			recipientPhone: '0812345678'
		});

		const groups = get(deliveryGroups);
		expect(groups.map((g) => g.kind).sort()).toEqual(
			[DeliveryGroupKind.Shipping, DeliveryGroupKind.Digital].sort()
		);
		const digital = groups.find((g) => g.kind === DeliveryGroupKind.Digital);
		expect(digital?.recipientPhone).toBe('0812345678');
		expect(isDestinationReady(digital!)).toBe(true);
	});

	it('B6 — e-voucher only: one Digital group, ready once the buyer has an email OR a phone', () => {
		syncDeliveryGroups([digitalItem('voucher')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false,
			channel: 'online',
			recipientPhone: '0812345678'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.Digital);
		expect(groups[0].recipientAddress).toBeUndefined();
		expect(isDestinationReady(groups[0])).toBe(true);
	});

	it('B7 — POS: machine รับทันที + cleaning service → PickupInStore / OnSite, OnSite sharing the customer address', () => {
		syncDeliveryGroups([physicalItem('machine'), serviceItem('cleaning')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false,
			channel: 'pos',
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const groups = get(deliveryGroups);
		expect(groups.map((g) => g.kind).sort()).toEqual(
			[DeliveryGroupKind.PickupInStore, DeliveryGroupKind.OnSite].sort()
		);
		expect(groups.find((g) => g.kind === DeliveryGroupKind.OnSite)?.recipientAddress).toBe(
			'123 ถ.สุขุมวิท'
		);
	});

	it('B8 — online marketplace (shopee): single Shipping group, courier = platform, method "platform", shippingFee 0, every physical line forced to Shipping', () => {
		syncDeliveryGroups(
			[
				physicalItem('item-1', { lineFulfilment: DeliveryGroupKind.PickupLater }),
				physicalItem('item-2')
			],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				channel: 'online',
				subChannel: 'shopee',
				recipientName: 'คุณลูกค้า',
				recipientAddress: '123 ถ.สุขุมวิท'
			}
		);

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		const shipping = groups[0];
		expect(shipping.kind).toBe(DeliveryGroupKind.Shipping);
		expect(shipping.courier).toBe('shopee');
		expect(shipping.method).toBe('platform');
		expect(shipping.shippingFee).toBe(0);
		expect(shipping.itemIds.sort()).toEqual(['item-1', 'item-2']);

		const summary = get(deliverySummary);
		expect(summary.feeUnknown).toBe(false);
	});
});

// Entering advanced (group-order) mode from basic must keep whatever category buckets
// basic mode already built as the starting, cashier-reassignable (soft-split) groups —
// not discard them in favour of a single re-merged default. Digital stays a hard split
// even once the cashier is in group-order mode.
describe('enableGroupOrder — entering group order from basic', () => {
	beforeEach(() => {
		resetDeliveryGroups();
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	it('promotes basic mode buckets to User groups instead of re-merging them', () => {
		const items = [
			physicalItem('coffee'),
			physicalItem('machine', { lineFulfilment: DeliveryGroupKind.Shipping })
		];
		const ctx = {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false,
			channel: 'pos' as const,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		};

		syncDeliveryGroups(items, ctx);
		const basicGroups = get(deliveryGroups);
		expect(basicGroups).toHaveLength(2); // B3 shape — PickupInStore + Shipping, both locked

		expect(get(groupOrderMode)).toBe(false);
		const newGroupId = enableGroupOrder(items, ctx);
		expect(get(groupOrderMode)).toBe(true);

		const groups = get(deliveryGroups);
		// The two basic buckets survive as unlocked User groups, plus the new empty one.
		expect(groups).toHaveLength(3);
		const pickupInStore = groups.find((g) => g.kind === DeliveryGroupKind.PickupInStore);
		const shipping = groups.find((g) => g.kind === DeliveryGroupKind.Shipping && g.id !== newGroupId);
		expect(pickupInStore?.splitReason).toBe(SplitReason.User);
		expect(pickupInStore?.locked).toBe(false);
		expect(pickupInStore?.itemIds).toEqual(['coffee']);
		expect(shipping?.splitReason).toBe(SplitReason.User);
		expect(shipping?.locked).toBe(false);
		expect(shipping?.itemIds).toEqual(['machine']);
	});

	it('leaves a Digital bucket as its own hard split rather than promoting it to User', () => {
		const items = [physicalItem('p1'), digitalItem('d1')];
		const ctx = {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false,
			channel: 'pos' as const,
			recipientEmail: 'buyer@example.com'
		};

		syncDeliveryGroups(items, ctx);
		enableGroupOrder(items, ctx);

		const digital = get(deliveryGroups).find((g) => g.kind === DeliveryGroupKind.Digital);
		expect(digital?.locked).toBe(true);
		expect(digital?.splitReason).toBe(SplitReason.Product);
	});
});
