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
	groupKindLabel
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
	moveItemToGroup
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

	it('splits a physical + digital walk-in sale into a PickupInStore parcel and a locked Digital parcel', () => {
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
		expect(pickup?.locked).toBe(false);
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
	it('splits service + physical on a pickup sale into an unlocked OnSite group and a PickupInStore group', () => {
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
		expect(onSite?.locked).toBe(false);
		expect(onSite?.itemIds).toEqual(['s1']);

		const pickup = groups.find((g) => g.kind === DeliveryGroupKind.PickupInStore);
		expect(pickup?.itemIds).toEqual(['p1']);
	});

	it('keeps a service item exactly where the cashier drags it across a re-sync, instead of re-claiming it back into OnSite', () => {
		syncDeliveryGroups([serviceItem('s1'), physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});

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
		syncDeliveryGroups([serviceItem('s1'), physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupImmediate,
			isDelivery: false
		});

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
	it('builds an OnSite default group for ordinary physical items when the SALE fulfilment is OnSite', () => {
		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], {
			fulfilmentType: FullfilmentType.OnSite,
			isDelivery: false,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.OnSite);
		expect(groups[0].locked).toBe(false);
		expect(groups[0].itemIds.sort()).toEqual(['p1', 'p2']);
		expect(groups[0].recipientAddress).toBe('123 ถ.สุขุมวิท');
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

	it('keeps an empty parcel the cashier just added after the next sync run', () => {
		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], {
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

	it('without enableGroupOrder, a pickup sale with no digital item still clears groups on sync — regression guard', () => {
		syncDeliveryGroups([physicalItem('p1')], {
			fulfilmentType: FullfilmentType.PickupLater,
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

	it('blocks a "now" item from a foreign origin — it ships instead of joining the handover group', () => {
		syncDeliveryGroups(
			[
				physicalItem('p1', {
					receiveMode: ReceiveMode.Now,
					originId: 'origin-b',
					originName: 'คลัง B'
				}),
				physicalItem('p2')
			],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				allowPartialReceive: true,
				sellingOriginId: 'origin-a',
				recipientName: 'คุณลูกค้า',
				recipientAddress: '123 ถ.สุขุมวิท'
			}
		);

		const groups = get(deliveryGroups);
		expect(groups.some((g) => g.splitReason === SplitReason.Receive)).toBe(false);
		// p1 falls through to the ordinary Shipping group instead — the ▲ toggle would
		// already have been disabled for it, so this is stale state, and shipping is safe.
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.Shipping);
		expect([...groups[0].itemIds].sort()).toEqual(['p1', 'p2']);
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
		syncDeliveryGroups([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup();
		setActiveDeliveryGroup(userId);

		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], ctx);

		expect(groupOf('p2')?.id).toBe(userId);
		expect(groupOf('p1')?.id).not.toBe(userId);
	});

	it('leaves a line that already had a parcel where it is (qty bump is not a new line)', () => {
		syncDeliveryGroups([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup();
		setActiveDeliveryGroup(userId);

		syncDeliveryGroups([physicalItem('p1', { qty: 3 })], ctx);

		expect(groupOf('p1')?.id).not.toBe(userId);
	});

	it('with nothing active, new lines keep going to the default parcel', () => {
		syncDeliveryGroups([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup();

		syncDeliveryGroups([physicalItem('p1'), physicalItem('p2')], ctx);

		expect(groupOf('p2')?.id).not.toBe(userId);
	});

	it('never lets a digital line into the active parcel — the hard split still wins', () => {
		syncDeliveryGroups([physicalItem('p1')], ctx);
		const userId = addUserDeliveryGroup();
		setActiveDeliveryGroup(userId);

		syncDeliveryGroups([physicalItem('p1'), digitalItem('d1')], ctx);

		expect(groupOf('d1')?.kind).toBe(DeliveryGroupKind.Digital);
		expect(groupOf('d1')?.id).not.toBe(userId);
	});

	it('refuses to activate a locked or default parcel', () => {
		syncDeliveryGroups([physicalItem('p1'), digitalItem('d1')], ctx);
		const digital = get(deliveryGroups).find((g) => g.kind === DeliveryGroupKind.Digital)!;
		const normal = get(deliveryGroups).find((g) => !g.locked)!;

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

	it('keeps a user group on the kind it was switched to across the next sync', () => {
		const ctx = {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		};
		syncDeliveryGroups([physicalItem('p1')], ctx);
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
