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
	updateDeliveryGroup
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

	// Basic mode (the default — no multi-address mode) now locks EVERY present category
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
	// Basic mode locks both category groups the moment more than one is present — a
	// cashier can still move a line between kinds via its own lineFulfilment pick
	// (resolveLineKind), never by dragging a parcel card around.
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

// A pickup/pickup-later sale with no digital item builds no groups at all by default
// (the zero-cost path, see "leaves the group list empty..." above).
describe('syncDeliveryGroups — pickup sale without a digital item', () => {
	beforeEach(() => {
		resetDeliveryGroups();
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	// A PickupLater sale still needs its own single plain group so the branch the
	// customer collects from (pickupStoreId) has somewhere to live — unlike PickupInStore
	// (รับทันที — nothing to track), which stays the zero-cost path.
	it('a PickupLater sale with no digital item still builds its own single plain group', () => {
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

	// Regression — a sale split into a pickup-now line, a pickup-later line, and ONE real
	// Shipping line used to read as "ค่าจัดส่ง (3 พัสดุ) ยังไม่ครบ" even when that one real
	// parcel already had its courier/fee fully set: feeUnknown checked EVERY group's
	// shippingFee for undefined, and a pickup group's is always undefined (never asked
	// for one), not actually missing anything.
	it('feeUnknown only looks at groups that actually need a fee, not pickup groups sitting beside them', () => {
		syncDeliveryGroups(
			[
				physicalItem('p1', { lineFulfilment: DeliveryGroupKind.PickupInStore }),
				physicalItem('p2', { lineFulfilment: DeliveryGroupKind.PickupLater }),
				physicalItem('p3')
			],
			{
				fulfilmentType: FullfilmentType.ShopDelivery,
				isDelivery: true,
				channel: 'pos',
				recipientName: 'คุณลูกค้า',
				recipientAddress: '123 ถ.สุขุมวิท'
			}
		);
		const shippingGroup = get(deliveryGroups).find((g) => g.kind === DeliveryGroupKind.Shipping)!;
		updateDeliveryGroup(shippingGroup.id, { method: 'kex', shippingFee: 100 });

		const summary = get(deliverySummary);
		expect(summary.shippingCount).toBe(1);
		expect(summary.feeUnknown).toBe(false);
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
	it('treats shopee, lazada, tiktok and lineShopping as marketplace sub-channels', () => {
		expect(isMarketplaceChannel('shopee')).toBe(true);
		expect(isMarketplaceChannel('lazada')).toBe(true);
		expect(isMarketplaceChannel('tiktok')).toBe(true);
		expect(isMarketplaceChannel('lineShopping')).toBe(true);
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

	it('gives an online physical line exactly one option: Shipping — online is shipping-only, no per-line picker', () => {
		expect(
			lineFulfilmentOptions({ fulfilmentType: ItemFulfilmentType.Physical }, { channel: 'online', marketplace: false })
		).toEqual([DeliveryGroupKind.Shipping]);
	});

	it('gives a link-bill physical line Shipping or PickupLater — no counter to hand it over at', () => {
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

	it('B8 — online marketplace (shopee): single Shipping group, courier = platform, method "platform", fee left for the merchant to set, every physical line forced to Shipping', () => {
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
		// Courier/method are locked to the platform, but the fee is still the merchant's own
		// to set (same field as any other shipping group) — it starts unset, not a stamped 0
		// that would silently overwrite whatever the merchant types in on every re-sync.
		expect(shipping.shippingFee).toBeUndefined();
		expect(shipping.itemIds.sort()).toEqual(['item-1', 'item-2']);

		// feeUnknown is deliberately always false now — a fee the merchant hasn't set yet is
		// ฿0 until they say otherwise, not a blocking "unknown" state (see
		// isGroupFulfilmentComplete's own comment); the unset shippingFee itself (asserted
		// above) is still the real, un-stamped value this test is actually about.
		const summary = get(deliverySummary);
		expect(summary.feeUnknown).toBe(false);
	});

	it('B8b — a merchant-set fee on a marketplace Shipping group survives a re-sync', () => {
		syncDeliveryGroups([physicalItem('item-1')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			channel: 'online',
			subChannel: 'shopee',
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const shippingId = get(deliveryGroups)[0].id;
		updateDeliveryGroup(shippingId, { shippingFee: 50 });

		// Any cart/context change re-runs the sync — a courier-locked marketplace group must
		// not have its merchant-entered fee clobbered back to a default on the next pass.
		syncDeliveryGroups([physicalItem('item-1'), physicalItem('item-2')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			channel: 'online',
			subChannel: 'shopee',
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const shipping = get(deliveryGroups).find((g) => g.kind === DeliveryGroupKind.Shipping);
		expect(shipping?.shippingFee).toBe(50);
	});

	it('B8c — switching an online sale off a marketplace sub-channel clears the stale platform courier/method/fee', () => {
		syncDeliveryGroups([physicalItem('item-1')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			channel: 'online',
			subChannel: 'shopee',
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const shippingId = get(deliveryGroups)[0].id;
		updateDeliveryGroup(shippingId, { shippingFee: 50 });

		// The cashier switches the sub-channel back to an ordinary one (not one of the 4
		// locked marketplaces) — the group must stop looking marketplace-locked: no stale
		// 'platform' method, no leftover 'shopee' courier, no leftover fee from a courier
		// the merchant never actually chose for this channel.
		syncDeliveryGroups([physicalItem('item-1')], {
			fulfilmentType: FullfilmentType.ShopDelivery,
			isDelivery: true,
			channel: 'online',
			subChannel: 'line',
			recipientName: 'คุณลูกค้า',
			recipientAddress: '123 ถ.สุขุมวิท'
		});

		const shipping = get(deliveryGroups).find((g) => g.kind === DeliveryGroupKind.Shipping);
		expect(shipping?.method).not.toBe('platform');
		expect(shipping?.courier).toBeUndefined();
		expect(shipping?.shippingFee).toBeUndefined();
	});
});

// "เพิ่มตัวเลือกรับสินค้า" → a SECOND "จัดส่งจากหน้าร้าน" pile, its own address — replaces
// the old "จัดส่งหลายที่อยู่" engine. A line's `lineAddressId` says which Shipping pile's
// address it belongs to (undefined = the sale's own default address), mirroring how
// `linePickupStoreId` already fans PickupLater out into one group per branch.
describe('basic mode — Shipping fans out by address, same shape as PickupLater by branch', () => {
	beforeEach(() => {
		resetDeliveryGroups();
		isMultiParcelEnabledMock.mockReturnValue(true);
	});

	const ctx = {
		fulfilmentType: FullfilmentType.ShopDelivery,
		isDelivery: true,
		channel: 'pos' as const,
		recipientName: 'คุณลูกค้า',
		recipientAddress: '123 ถ.สุขุมวิท',
		recipientAddressId: 'addr-default',
		shippingAddresses: [{ addressId: 'addr-2', recipientName: 'คุณลูกค้า2', recipientAddress: '456 ถ.พระราม 4' }]
	};

	it('a single Shipping address still reads as the plain, unsplit default (no "· address" suffix anywhere, locked stays false)', () => {
		syncDeliveryGroups([physicalItem('item-1')], ctx);

		const groups = get(deliveryGroups);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe(DeliveryGroupKind.Shipping);
		expect(groups[0].locked).toBe(false);
		expect(groups[0].splitReason).toBeUndefined();
		expect(groups[0].addressGroupSeq).toBe(1);
		expect(groups[0].recipientAddress).toBe('123 ถ.สุขุมวิท');
	});

	it('a second Shipping pile (lineAddressId set) becomes its own group with its own address, independent of the default', () => {
		syncDeliveryGroups(
			[physicalItem('item-1'), physicalItem('item-2', { lineAddressId: 'addr-2' })],
			ctx
		);

		const groups = get(deliveryGroups).filter((g) => g.kind === DeliveryGroupKind.Shipping);
		expect(groups).toHaveLength(2);
		const defaultGroup = groups.find((g) => g.itemIds.includes('item-1'));
		const extraGroup = groups.find((g) => g.itemIds.includes('item-2'));
		expect(defaultGroup?.recipientAddress).toBe('123 ถ.สุขุมวิท');
		expect(extraGroup?.recipientAddress).toBe('456 ถ.พระราม 4');
		expect(extraGroup?.recipientAddressId).toBe('addr-2');
		// Every Shipping group other than the default is a cashier-made pile — soft, never
		// a system-locked hard split.
		expect(extraGroup?.locked).toBe(false);
		expect(extraGroup?.splitReason).toBe(SplitReason.User);
	});

	it("a second pile's own courier/method/fee survive a re-sync (matched by recipientAddressId, not array position)", () => {
		syncDeliveryGroups(
			[physicalItem('item-1'), physicalItem('item-2', { lineAddressId: 'addr-2' })],
			ctx
		);
		const extraId = get(deliveryGroups).find((g) => g.recipientAddressId === 'addr-2')!.id;
		updateDeliveryGroup(extraId, { method: 'kerry', shippingFee: 40 });

		syncDeliveryGroups(
			[
				physicalItem('item-1'),
				physicalItem('item-2', { lineAddressId: 'addr-2' }),
				physicalItem('item-3', { lineAddressId: 'addr-2' })
			],
			ctx
		);

		const extraGroup = get(deliveryGroups).find((g) => g.recipientAddressId === 'addr-2');
		expect(extraGroup?.method).toBe('kerry');
		expect(extraGroup?.shippingFee).toBe(40);
		expect(extraGroup?.itemIds.sort()).toEqual(['item-2', 'item-3']);
	});
});
