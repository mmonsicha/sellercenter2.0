import { derived, get, writable } from 'svelte/store';
import type { TCartItem } from '$stores/cart';
import { orderData, setDelivery } from '$stores/order/order';
import { FullfilmentType, type Delivery } from '$lib/entities/order/order';
import {
	BASIC_CATEGORY_ORDER,
	DeliveryGroupKind,
	SplitReason,
	computeKindBuckets,
	isDestinationReady,
	isGroupFulfilmentComplete,
	isHandoverGroup,
	isMarketplaceChannel,
	newDeliveryGroup,
	type DeliveryGroup,
	type LineFulfilmentCtx
} from '$lib/entities/order/delivery-group';

export const deliveryGroups = writable<DeliveryGroup[]>([]);

/**
 * The non-digital group kind a sale collects its items through — shared by
 * syncDeliveryGroups' own default/origin groups, so a freshly-opened fulfilment pile
 * always matches how the rest of the sale is already being collected (pickup now/later/
 * ship) instead of defaulting to Shipping regardless.
 */
export function physicalKindFor(
	fulfilmentType: string,
	isDelivery: boolean
): DeliveryGroupKind {
	// Checked before isDelivery — an on-site visit needs an address and a travel fee just
	// like a courier parcel does, but it is never "isDelivery" (no courier, no shipping
	// type to pick), so it would otherwise fall through to a plain pickup kind and lose
	// both of those fields entirely.
	if (fulfilmentType === FullfilmentType.OnSite) return DeliveryGroupKind.OnSite;
	if (isDelivery) return DeliveryGroupKind.Shipping;
	return fulfilmentType === FullfilmentType.PickupLater
		? DeliveryGroupKind.PickupLater
		: DeliveryGroupKind.PickupInStore;
}

// The buyer address the last sync handed to the default parcel, so the next sync can
// tell a real buyer-side change apart from an unrelated re-run. See step 4 below.
let lastSyncedBuyerAddress: string | undefined;

/**
 * count > 1 — a real split. Still exported for copy that reads the count itself (the
 * drawer's "พัสดุ N/M"); UI that decides whether to show anything at all must use
 * `showDeliveryDetail` instead — see its own comment for why the two differ.
 */
export const hasSplitDelivery = derived(deliveryGroups, ($g) => $g.length > 1);

/**
 * Whether the cart's delivery detail is worth showing at all. A digital parcel always
 * is — an e-voucher needs an email whether or not anything else is in the basket — and
 * so is any real split. A plain physical sale (one parcel, pickup or delivery) shows
 * nothing: its address already lives in the customer block, and this is the 80-90%
 * path that must stay free of extra rows (§1 C4).
 */
export const showDeliveryDetail = derived(deliveryGroups, ($g) =>
	$g.length > 1 ||
	$g.some((g) => g.kind === DeliveryGroupKind.Digital || g.kind === DeliveryGroupKind.OnSite)
);

export const deliverySummary = derived(deliveryGroups, ($g) => {
	// An empty parcel has nothing to send anywhere, so it is not "missing a
	// destination" — it is simply waiting for items. Counting it would let
	// "+ แยกพัสดุเพิ่ม" disable the pay button the instant it is clicked, before the
	// cashier has had the chance to move anything into the parcel they just made.
	// isGroupFulfilmentComplete (not the narrower isDestinationReady) is what decides
	// "missing" here — a destination alone isn't enough to let a Shipping/OnSite group
	// through with no fee set, or a PickupLater group through with no branch.
	const missing = $g.filter((group) => group.itemIds.length > 0 && !isGroupFulfilmentComplete(group));
	// A blank Shipping/OnSite fee is not "unknown" any more — it's ฿0 until the cashier
	// says otherwise (see isGroupFulfilmentComplete's own comment), so there is nothing
	// left for this to flag. Kept as a field (always false) rather than removed outright,
	// so CartFooter's own $deliverySummary.feeUnknown reads don't need touching.
	const feeUnknown = false;
	// Every group's shippingFee defaults to 0 in the sum — a pickup/digital/handover
	// group's is always undefined anyway (never asked for one), contributing 0 either way.
	const totalFee = $g.reduce((sum, group) => sum + (group.shippingFee ?? 0), 0);

	return {
		// Deliberately stays the total group count, handover pile included — the drawer's
		// "พัสดุ N/M" titles, firstMissingSeq and the mini-nav chips all number by raw
		// position and must keep agreeing with each other; splitting this into "real
		// parcels only" here would desync every one of them from what the drawer renders.
		count: $g.length,
		totalFee,
		feeUnknown,
		missing,
		firstMissingSeq: missing.length > 0 ? $g.indexOf(missing[0]) + 1 : 0,
		handoverGroup: $g.find(isHandoverGroup),
		/** parcels that actually travel — the handover pile is not a พัสดุ. */
		parcelCount: $g.filter((g) => !isHandoverGroup(g)).length,
		/** real courier parcels — CartFooter's fee row prices these as "พัสดุ". */
		shippingCount: $g.filter((g) => g.kind === DeliveryGroupKind.Shipping).length,
		/** on-site service groups — priced as "ค่าเดินทาง", never a "พัสดุ". */
		onSiteCount: $g.filter((g) => g.kind === DeliveryGroupKind.OnSite).length
	};
});

interface KindGroupOpts {
	addressGroupSeq: number;
	locked: boolean;
	splitReason: SplitReason | undefined;
	marketplace?: boolean;
	subChannel?: string;
	recipientName?: string;
	recipientAddress?: string;
	recipientAddressId?: string;
	recipientEmail?: string;
	recipientPhone?: string;
	pickupStoreId?: string;
}

// Builds one kind-bucket's full field set — courier/method/fee for Shipping, travel
// address for OnSite, branch for PickupLater, email/phone for Digital, nothing-to-ship
// for PickupInStore. Called once per Shipping address / PickupLater branch bucket by
// syncBasicGroups, so every bucket of a kind is built through the exact same rules.
function buildKindGroup(
	kind: DeliveryGroupKind,
	itemIds: string[],
	existing: DeliveryGroup | undefined,
	opts: KindGroupOpts
): DeliveryGroup {
	const base: DeliveryGroup = {
		...(existing ?? newDeliveryGroup({ addressGroupSeq: opts.addressGroupSeq })),
		kind,
		itemIds,
		locked: opts.locked,
		splitReason: opts.splitReason,
		addressGroupSeq: opts.addressGroupSeq
	};

	switch (kind) {
		case DeliveryGroupKind.Shipping:
			// Marketplace locks courier/method to the platform (the merchant never picks a
			// courier here), but NOT the fee — base already carries over any shippingFee
			// the merchant set on this group, via the ...existing spread above, so this
			// must not stamp it back to 0 on every sync or a saved fee would vanish the
			// next time the cart changes.
			return opts.marketplace
				? {
						...base,
						courier: opts.subChannel,
						method: 'platform',
						recipientName: opts.recipientName,
						recipientAddress: opts.recipientAddress,
						recipientAddressId: opts.recipientAddressId
					}
				: {
						...base,
						// A group that was marketplace-locked before (e.g. the cashier switched
						// the sub-channel away from Shopee/Lazada/TikTok Shop/LINE SHOPPING back
						// to an ordinary one) must not keep carrying the 'platform' sentinel and
						// that platform's courier/fee forward via the ...base spread above — the
						// merchant now needs to pick a real courier and fee for this group.
						...(base.method === 'platform'
							? { courier: undefined, method: 'unknown', shippingFee: undefined }
							: {}),
						recipientName: opts.recipientName,
						recipientAddress: opts.recipientAddress,
						recipientAddressId: opts.recipientAddressId
					};
		case DeliveryGroupKind.OnSite:
			return {
				...base,
				recipientName: opts.recipientName,
				recipientAddress: opts.recipientAddress,
				recipientAddressId: opts.recipientAddressId
			};
		case DeliveryGroupKind.PickupLater:
			return { ...base, pickupStoreId: opts.pickupStoreId };
		case DeliveryGroupKind.Digital:
			return {
				...base,
				shippingFee: 0,
				recipientEmail: opts.recipientEmail,
				recipientPhone: opts.recipientPhone
			};
		case DeliveryGroupKind.PickupInStore:
		default:
			return {
				...base,
				shippingFee: 0,
				recipientAddress: undefined,
				recipientAddressId: undefined
			};
	}
}

/**
 * Basic mode's engine — the only engine, now that "จัดส่งหลายที่อยู่" is gone. Splits by
 * fulfilment category (PickupInStore/PickupLater/Shipping/OnSite/Digital), never by
 * origin, stock, or a cashier-made parcel — one group per category actually present in
 * the cart, sharing ONE destination for that whole category (the sale's own customer
 * address / pickup branch / email+phone), never a per-item override — EXCEPT PickupLater
 * (one group per distinct branch in play, see pickupLaterBuckets below) and Shipping (one
 * group per distinct address in play, see shippingBuckets below), each of which a cashier
 * can fan out into several independently-configurable piles via "เพิ่มตัวเลือกรับสินค้า".
 * See FULFILMENT spec B1–B8.
 */
function syncBasicGroups(items: TCartItem[], ctx: Parameters<typeof syncDeliveryGroups>[1]): void {
	if (items.length === 0) {
		deliveryGroups.set([]);
		lastSyncedBuyerAddress = undefined;
		return;
	}

	const channel: LineFulfilmentCtx['channel'] = ctx.channel ?? 'pos';
	const marketplace = ctx.marketplace ?? isMarketplaceChannel(ctx.subChannel);
	// A marketplace sale picks รูปแบบการรับสินค้า like any other online sale (PO) — the
	// platform only decides how a Shipping group ships (courier "ตามแพลตฟอร์ม", below),
	// never which kinds a line may sit in.
	const lineCtx: LineFulfilmentCtx = { channel, marketplace: false };
	// The category the sale is collected through by default — also what resolveLineKind
	// falls back to for a line that has no explicit pick of its own.
	const saleDefaultKind = physicalKindFor(ctx.fulfilmentType, ctx.isDelivery);

	const previous = get(deliveryGroups);
	// The legacy "รับเลยที่เคาน์เตอร์" per-line toggle only ever meant something on a
	// POS จัดส่งให้ลูกค้า sale (see the old step 1.5's own gate) — carrying it into
	// resolveLineKind unconditionally would make an unrelated flag on a stale cart
	// line start acting like a line-level pick it never actually was.
	const honourReceiveMode = !!ctx.allowPartialReceive && !!ctx.isDelivery;
	const buckets = computeKindBuckets(items, saleDefaultKind, lineCtx, honourReceiveMode);

	const presentKinds = BASIC_CATEGORY_ORDER.filter((kind) => (buckets.get(kind)?.length ?? 0) > 0);

	// The zero-cost path: a sale sold as pickup-now with nothing to split it (no
	// override, no digital/service/marketplace line) builds no groups at all, exactly
	// like today. Only collapses when PickupInStore is BOTH the only bucket present AND
	// the sale's own default — an all-"now" override on an otherwise-shipped sale (every
	// line flipped at the counter) is a real handover pile, not this zero-cost case, and
	// must still show as its own group below.
	if (
		presentKinds.length === 0 ||
		(presentKinds.length === 1 &&
			presentKinds[0] === DeliveryGroupKind.PickupInStore &&
			saleDefaultKind === DeliveryGroupKind.PickupInStore)
	) {
		deliveryGroups.set([]);
		lastSyncedBuyerAddress = undefined;
		return;
	}

	// The one case that stays a plain, unlocked, reason-less default group — a single
	// Shipping/OnSite/PickupLater bucket is exactly the same "no reason to be split yet"
	// bucket the advanced engine's own default group is, so showDeliveryDetail/
	// isHandoverGroup/the footer all keep reading it the same way. PickupInStore and
	// Digital are deliberately excluded even when alone: a lone override-driven
	// PickupInStore bucket is still a handover pile (SplitReason.Receive), and Digital is
	// always a hard split (SplitReason.Product) with its own locked group regardless.
	// CartFulfilmentPiles already visually splits a รับภายหลัง bucket into one pile PER
	// BRANCH (keyed by linePickupStoreId ?? '', see its own `buckets` computation) — a
	// cashier can open a second branch's pile via "เพิ่มตัวเลือกรับสินค้า" and move lines
	// into it. But this function used to build just ONE PickupLater DeliveryGroup for the
	// whole sale regardless of how many branch-piles existed, so there was nowhere to
	// persist a specific branch's own pickupDate/pickupTimeSlot — a second
	// branch's settings would collide with (or simply never reach) the first branch's
	// group. Fan PickupLater out into one group PER DISTINCT BRANCH key instead, using the
	// exact same key convention (`linePickupStoreId ?? ''`) CartFulfilmentPiles already uses,
	// so each pile has its own real group to read from and save into.
	const pickupLaterBuckets = new Map<string, string[]>();
	const pickupLaterLineIds = new Set(buckets.get(DeliveryGroupKind.PickupLater) ?? []);
	items.forEach((item) => {
		if (!item.lineId || !pickupLaterLineIds.has(item.lineId)) return;
		const branchKey = item.linePickupStoreId ?? '';
		const bucket = pickupLaterBuckets.get(branchKey) ?? [];
		bucket.push(item.lineId);
		pickupLaterBuckets.set(branchKey, bucket);
	});

	// Same fan-out as PickupLater's own branch buckets above, keyed by each line's
	// `lineAddressId` instead — a cashier can open a second (third, ...) "จัดส่งจากหน้าร้าน"
	// pile via "เพิ่มตัวเลือกรับสินค้า", each shipping to its OWN, distinct address (see
	// $stores/cart/cart's OpenFulfilmentPile.addressId). '' (no override) is the sale's own
	// default address — ctx.recipientAddress — exactly like basic mode's old single
	// Shipping group.
	const shippingBuckets = new Map<string, string[]>();
	const shippingLineIds = new Set(buckets.get(DeliveryGroupKind.Shipping) ?? []);
	items.forEach((item) => {
		if (!item.lineId || !shippingLineIds.has(item.lineId)) return;
		const addressKey = item.lineAddressId ?? '';
		const bucket = shippingBuckets.get(addressKey) ?? [];
		bucket.push(item.lineId);
		shippingBuckets.set(addressKey, bucket);
	});

	const soloKind = presentKinds.length === 1 ? presentKinds[0] : undefined;
	// A lone PickupLater/Shipping bucket only still reads as the plain, unsplit default
	// when there is also exactly one branch/address in play — 2+ is itself a real split
	// (SplitReason.Fulfilment/User, locked/unlocked) even though only one KIND is present,
	// since each pile now needs its own identifiable settings.
	const isPlainDefault =
		(soloKind === DeliveryGroupKind.Shipping && shippingBuckets.size === 1) ||
		soloKind === DeliveryGroupKind.OnSite ||
		(soloKind === DeliveryGroupKind.PickupLater && pickupLaterBuckets.size === 1);

	const plainGroups: DeliveryGroup[] = presentKinds
		.filter(
			(kind) => kind !== DeliveryGroupKind.PickupLater && kind !== DeliveryGroupKind.Shipping
		)
		.map((kind) => {
			const existing = previous.find((g) => g.kind === kind);
			const itemIds = buckets.get(kind) ?? [];
			const splitReason = isPlainDefault
				? undefined
				: kind === DeliveryGroupKind.PickupInStore
					? SplitReason.Receive
					: kind === DeliveryGroupKind.Digital
						? SplitReason.Product
						: SplitReason.Fulfilment;

			return buildKindGroup(kind, itemIds, existing, {
				addressGroupSeq: 1,
				locked: !isPlainDefault,
				splitReason,
				marketplace,
				subChannel: ctx.subChannel,
				recipientName: ctx.recipientName,
				recipientAddress: ctx.recipientAddress,
				recipientAddressId: ctx.recipientAddressId,
				recipientEmail: ctx.recipientEmail,
				recipientPhone: ctx.recipientPhone,
				pickupStoreId: ctx.pickupStoreId
			});
		});

	const pickupLaterGroups: DeliveryGroup[] = Array.from(pickupLaterBuckets.entries()).map(
		([branchKey, itemIds]) => {
			const resolvedPickupStoreId = branchKey || ctx.pickupStoreId;
			// Match by resolved pickupStoreId (not raw branchKey) so each branch's group keeps
			// its own identity — and its own drafted pickupDate/pickupTimeSlot —
			// stably across re-syncs, instead of being torn down and rebuilt every time the
			// cart changes.
			const existing = previous.find(
				(g) =>
					g.kind === DeliveryGroupKind.PickupLater &&
					(g.pickupStoreId ?? ctx.pickupStoreId) === resolvedPickupStoreId
			);
			const splitReason = isPlainDefault ? undefined : SplitReason.Fulfilment;

			return buildKindGroup(DeliveryGroupKind.PickupLater, itemIds, existing, {
				addressGroupSeq: 1,
				locked: !isPlainDefault,
				splitReason,
				marketplace,
				subChannel: ctx.subChannel,
				recipientName: ctx.recipientName,
				recipientAddress: ctx.recipientAddress,
				recipientAddressId: ctx.recipientAddressId,
				recipientEmail: ctx.recipientEmail,
				recipientPhone: ctx.recipientPhone,
				pickupStoreId: resolvedPickupStoreId
			});
		}
	);

	// Sorted so the default ('') address always lands first/seq 1 — every other bucket's
	// `addressGroupSeq` only matters for display ordering, never identity (that's
	// `recipientAddressId`, matched below the same way pickupStoreId is matched above).
	const sortedShippingKeys = Array.from(shippingBuckets.keys()).sort((a, b) =>
		a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)
	);
	const shippingGroups: DeliveryGroup[] = sortedShippingKeys.map((addressKey, index) => {
		const itemIds = shippingBuckets.get(addressKey) ?? [];
		const isDefault = addressKey === '';
		// Match by resolved recipientAddressId (not the raw key) so an additional pile's
		// own courier/method/shippingFee drafts survive a re-sync, exactly like a
		// PickupLater branch's pickupDate/pickupTimeSlot above.
		const existing = previous.find(
			(g) =>
				g.kind === DeliveryGroupKind.Shipping &&
				(isDefault ? !g.recipientAddressId || g.addressGroupSeq === 1 : g.recipientAddressId === addressKey)
		);
		const destination = isDefault
			? {
					recipientName: ctx.recipientName,
					recipientAddress: ctx.recipientAddress,
					recipientAddressId: ctx.recipientAddressId
				}
			: {
					recipientName: ctx.shippingAddresses?.find((a) => a.addressId === addressKey)?.recipientName,
					recipientAddress: ctx.shippingAddresses?.find((a) => a.addressId === addressKey)
						?.recipientAddress,
					recipientAddressId: addressKey
				};
		const splitReason = isDefault ? (isPlainDefault ? undefined : SplitReason.Fulfilment) : SplitReason.User;

		return buildKindGroup(DeliveryGroupKind.Shipping, itemIds, existing, {
			addressGroupSeq: index + 1,
			locked: !isDefault ? false : !isPlainDefault,
			splitReason,
			marketplace,
			subChannel: ctx.subChannel,
			recipientEmail: ctx.recipientEmail,
			recipientPhone: ctx.recipientPhone,
			pickupStoreId: ctx.pickupStoreId,
			...destination
		});
	});

	const groups: DeliveryGroup[] = BASIC_CATEGORY_ORDER.flatMap((kind) => {
		if (kind === DeliveryGroupKind.PickupLater) return pickupLaterGroups;
		if (kind === DeliveryGroupKind.Shipping) return shippingGroups;
		return plainGroups.filter((g) => g.kind === kind);
	});

	lastSyncedBuyerAddress = ctx.recipientAddress;
	deliveryGroups.set(groups);
}

/**
 * Auto hard-split engine — runs on every cart change. Digital items and service items
 * are each split into their own locked group first (an email and an on-site visit are
 * each necessarily their own destination), then off-majority origins are split into
 * locked groups the cashier cannot merge away (they're not a choice); everything else
 * falls into one default group so the 80-90% no-split sale costs zero extra rows
 * (`hasSplitDelivery` stays false whenever this leaves one group; see
 * `showDeliveryDetail` for the digital/on-site exception).
 */
export function syncDeliveryGroups(
	items: TCartItem[],
	ctx: {
		fulfilmentType: string;
		isDelivery: boolean;
		recipientName?: string;
		recipientAddress?: string;
		recipientAddressId?: string;
		recipientEmail?: string;
		/** POS จัดส่งให้ลูกค้า only — every other sale ignores each line's receiveMode. */
		allowPartialReceive?: boolean;
		sellingOriginId?: string;
		/** Basic mode only (see syncBasicGroups) — which checkout surface is selling this.
		 *  Defaults to 'pos' when omitted, matching every existing caller. */
		channel?: LineFulfilmentCtx['channel'];
		/** Basic mode only — explicit override for isMarketplaceChannel(subChannel). */
		marketplace?: boolean;
		/** Basic mode only — the sale's sub-channel (shopee/lazada/tiktok/...), used both to
		 *  derive `marketplace` when it isn't passed explicitly and as the courier on a
		 *  marketplace Shipping group. */
		subChannel?: string;
		/** Basic mode only — the Digital group's alternative destination to email. */
		recipientPhone?: string;
		/** Basic mode only — the branch the whole sale's PickupLater group collects from. */
		pickupStoreId?: string;
		/** Basic mode only — the display name/address of every additional "เพิ่มตัวเลือก
		 *  รับสินค้า" Shipping pile's own address (seq 2+), keyed by its addressId (see
		 *  TCartItem.lineAddressId / OpenFulfilmentPile.addressId). The sale's own default
		 *  address (seq 1) still comes from recipientAddress/recipientName above. */
		shippingAddresses?: { addressId: string; recipientName?: string; recipientAddress?: string }[];
	}
): void {
	// VITE_DISABLE_MULTI_PARCEL only ever meant "no backend support for emailing a digital
	// parcel yet" — it was never meant to collapse the cart down to a single fulfilment
	// kind. CartFulfilmentPiles already draws one bucket per kind present in the cart
	// (resolveLineKind/computeKindBuckets) and lets the cashier open extra piles via
	// "+เพิ่มตัวเลือกรับสินค้า" regardless of this flag, so the groups syncBasicGroups builds
	// must always match those buckets 1:1 — a flag-specific group set here just means the
	// drawer save lookups (shippingGroupFor/pickupLaterGroupFor/onSiteGroup/digitalGroup in
	// Cart.svelte) find no group to write into, and the pile stays "ข้อมูลไม่ครบ" forever.
	// Build the real per-kind groups unconditionally; the flag now only decides whether
	// Cart.svelte's customerRequired insists on a customer for these groups.
	syncBasicGroups(items, ctx);
}

export function updateDeliveryGroup(id: string, patch: Partial<DeliveryGroup>): void {
	deliveryGroups.update((groups) => groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
}

export function resetDeliveryGroups(): void {
	deliveryGroups.set([]);
	lastSyncedBuyerAddress = undefined;
}

/**
 * Backend has no per-group Delivery yet — `Delivery` has no id/address/items[], so a
 * single order can carry only one set of shipping fields (see
 * MULTI-DESTINATION-REWORK.md §1.2, OQ 9). Until `Delivery.id` lands, this is the one
 * place that folds the groups' combined shipping fee back into the order's existing
 * single Delivery object; the payload shape does not change, only the money is made
 * to agree with what the drawer shows. Rewrite THIS function (not its callers) once a
 * real per-group Delivery is available.
 */
export function commitDeliveryGroupsToOrder(): void {
	const groups = get(deliveryGroups);
	if (groups.length === 0) return;

	const summary = get(deliverySummary);
	const current = get(orderData).deliveries?.[0];
	// courier/method/type describe HOW it ships — take them as one bundle from the
	// first group that actually has them set, rather than mixing fields from
	// different groups into a delivery description no group actually matches.
	const withMethod = groups.find((g) => g.courier || g.method || g.shippingType);

	const delivery: Delivery = {
		courier: withMethod?.courier ?? current?.courier,
		method: withMethod?.method ?? current?.method,
		type: withMethod?.shippingType ?? current?.type,
		remark: current?.remark,
		// A fee the cashier never set is ฿0, same as everywhere else this is read — no
		// longer special-cased to stay unset (see isGroupFulfilmentComplete's own comment).
		shippingFee: summary.totalFee
	};

	setDelivery(delivery);
}
