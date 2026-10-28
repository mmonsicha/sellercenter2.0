import { derived, get, writable } from 'svelte/store';
import type { TCartItem } from '$stores/cart';
import { orderData, setDelivery } from '$stores/order/order';
import { FullfilmentType, type Delivery } from '$lib/entities/order/order';
import { isMultiParcelEnabled } from '$lib/feature-flags';
import {
	DeliveryGroupKind,
	ItemFulfilmentType,
	ReceiveMode,
	SplitReason,
	canReceiveNow,
	isDestinationReady,
	isHandoverGroup,
	isServiceItem,
	itemFulfilmentOf,
	kindNeedsShippingMethod,
	kindNeedsTravelFee,
	newDeliveryGroup,
	receiveModeOf,
	type DeliveryGroup
} from '$lib/entities/order/delivery-group';

export const deliveryGroups = writable<DeliveryGroup[]>([]);

/**
 * The non-digital group kind a sale collects its items through — shared by
 * syncDeliveryGroups' own default/origin groups and by enableGroupOrder below, so a
 * manually-started group order always matches how the rest of the sale is already being
 * collected (pickup now/later/ship) instead of defaulting to Shipping regardless.
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

/**
 * "Shop into this parcel" focus — the cashier picks one cashier-made parcel and every
 * product tapped afterwards lands in it instead of the default parcel (the prototype's
 * `activeGroupId`). undefined = the ordinary behaviour: new lines go to the default
 * parcel. Only a user (soft-split) parcel can be active — a hard split is never a place
 * the cashier chose to put things — and it clears itself the moment that parcel stops
 * existing, so it can never point at a ghost.
 */
export const activeDeliveryGroupId = writable<string | undefined>(undefined);

export function setActiveDeliveryGroup(id: string | undefined): void {
	if (id === undefined) {
		activeDeliveryGroupId.set(undefined);
		return;
	}
	const target = get(deliveryGroups).find((g) => g.id === id);
	if (target && !target.locked && target.splitReason === SplitReason.User) {
		activeDeliveryGroupId.set(id);
	}
}

// The buyer address the last sync handed to the default parcel, so the next sync can
// tell a real buyer-side change apart from an unrelated re-run. See step 4 below.
let lastSyncedBuyerAddress: string | undefined;

// Whether the cashier has manually opted into a group order on a sale that otherwise
// builds no groups at all (a pickup/pickup-later sale with no digital item — see the
// early-return guard in syncDeliveryGroups). Plain module state, same as
// lastSyncedBuyerAddress above: nothing needs to bind to this reactively, it only
// steers one branch of one function. Reset wherever groups collapse back to "nothing
// split" so a later, unrelated sale never inherits a stale "stay split" flag.
let groupOrderActive = false;

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
	const missing = $g.filter((group) => group.itemIds.length > 0 && !isDestinationReady(group));
	// Only a Shipping/OnSite group ever HAS a fee to speak of — a pickup/digital/handover
	// group's shippingFee is undefined simply because it was never asked for one, not
	// because something is missing. Checking every group here (the old bug) meant an
	// ordinary pickup-now sale always read as "ค่าจัดส่ง ยังไม่ครบ", regardless of whether
	// a single real parcel was actually unresolved.
	const feeBearingGroups = $g.filter(
		(group) => kindNeedsShippingMethod(group.kind) || kindNeedsTravelFee(group.kind)
	);
	const feeUnknown = feeBearingGroups.some((group) => group.shippingFee === undefined);
	// Fees that ARE known still get summed even when others aren't — the row shows
	// "—" only through feeUnknown, never a partial total pretending to be the whole.
	// Summed across every group regardless (a pickup/digital group's shippingFee is
	// always undefined anyway, contributing 0 either way), kept as-is to avoid touching
	// commitDeliveryGroupsToOrder's existing total.
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
	}
): void {
	// No backend actually emails a digital parcel yet — the cart's own promise
	// ("ส่งทางอีเมลทันทีหลังชำระเงิน") and the pay gate it builds are premature until one
	// does. Disabled behaves exactly like the empty-cart case below: no groups means no
	// badges, no การจัดส่ง row, no drawer, no fee row and no gate, and
	// commitDeliveryGroupsToOrder is already a no-op on an empty list. See feature-flags.ts.
	if (!isMultiParcelEnabled()) {
		deliveryGroups.set([]);
		activeDeliveryGroupId.set(undefined);
		lastSyncedBuyerAddress = undefined;
		return;
	}

	// A service item (บริการห่อของขวัญ, ...) now rides in `shippableItems` same as
	// everything else — it is no longer dropped from grouping entirely, it is hard-split
	// into its own locked OnSite group below (step 1.5), same footing as Digital. It
	// must still be excluded from every OTHER step (origin-grouping, handover, default
	// group) — that exclusion runs through `assignedItemIds`, claimed by the service
	// hard-split step before any of those steps run, same mechanism Digital already uses.
	const shippableItems = items;

	// A digital item can never be handed over a counter — an email is its only
	// destination — so its presence forces a split at ANY fulfilment type, not only a
	// delivery. Computed before the early return so a walk-in sale carrying one digital
	// item still builds groups instead of being waved through by `!ctx.isDelivery`.
	const digitalItems = shippableItems.filter(
		(i) => itemFulfilmentOf(i.fulfilmentType) === ItemFulfilmentType.Digital
	);

	// A service item is performed at the customer's site — a new one is still suggested
	// into its own OnSite group at any fulfilment type (step 1.25 below), even though
	// that group is no longer locked.
	const serviceItems = shippableItems.filter((i) => isServiceItem(i.fulfilmentType));

	// An OnSite SALE needs its own destination+fee the same way a Shipping one does, even
	// when nothing in the cart is literally flagged "service" — the cashier picked this
	// fulfilment type for the whole sale, not per item. Without this carve-out, an OnSite
	// sale of ordinary physical items would fall through this guard and build no groups
	// at all (ctx.isDelivery is false for OnSite — no courier — and no item is "service").
	const isOnSiteSale = ctx.fulfilmentType === FullfilmentType.OnSite;

	// `shippableItems`, not `items` — only relevant now when the cart is genuinely empty,
	// since service items no longer drop out of shippableItems above. Checking
	// `items.length` here would let a lone gift-wrap sale build an empty parcel that then
	// has to be specially ignored everywhere else instead.
	if (
		shippableItems.length === 0 ||
		(!ctx.isDelivery &&
			!isOnSiteSale &&
			digitalItems.length === 0 &&
			serviceItems.length === 0 &&
			!groupOrderActive)
	) {
		deliveryGroups.set([]);
		activeDeliveryGroupId.set(undefined);
		lastSyncedBuyerAddress = undefined;
		groupOrderActive = false;
		return;
	}

	const previous = get(deliveryGroups);
	// Lines that sat in no parcel on the previous sync are the ones just added to the
	// cart. Grouping now keys by lineId, not product_id: a genuinely new LINE (its own
	// lineId, however familiar the product) always follows the active parcel, even when
	// another line of the same product already sits elsewhere — that's the whole point
	// of forceNewLine in AddCartItem. Only a qty bump on an EXISTING line (same lineId)
	// stays put.
	const previouslyGrouped = new Set(previous.flatMap((g) => g.itemIds));
	const activeId = get(activeDeliveryGroupId);
	const cartItemIds = new Set(shippableItems.map((i) => i.lineId).filter((id): id is string => !!id));
	const assignedItemIds = new Set<string>();
	const groups: DeliveryGroup[] = [];

	// The kind every non-digital (physical) group in this sale takes — the default
	// group and every per-origin locked group alike. An item from a minority origin is
	// still collected the same way the rest of the sale is (counter or courier), never
	// its own courier trip just because it came from another branch.
	const physicalKind = physicalKindFor(ctx.fulfilmentType, ctx.isDelivery);
	const isShippingKind = physicalKind === DeliveryGroupKind.Shipping;
	// Shipping and OnSite both need a real address — only the two pickup kinds don't.
	// Kept separate from isShippingKind (which still means "has a courier/shipping type
	// to pick", OnSite has neither) so clearing logic below can ask the right question.
	const needsAddressKind = isShippingKind || physicalKind === DeliveryGroupKind.OnSite;

	// 1) Digital items can never ride with a parcel — always their own locked group.
	if (digitalItems.length > 0) {
		const existing = previous.find((g) => g.kind === DeliveryGroupKind.Digital);
		groups.push({
			...(existing ?? newDeliveryGroup()),
			kind: DeliveryGroupKind.Digital,
			locked: true,
			splitReason: SplitReason.Product,
			shippingFee: 0,
			itemIds: digitalItems.map((i) => i.lineId!),
			recipientEmail: ctx.recipientEmail
		});
		digitalItems.forEach((i) => assignedItemIds.add(i.lineId!));
	}

	// 1.25) Service items are performed AT the customer's site — a GENUINELY NEW one is
	// suggested into its own OnSite group the moment it's added, same instinct as Digital's
	// hard split, EXCEPT it is never locked: a regular product and a service line can be
	// split apart or combined freely by drag-and-drop, same as any two physical items
	// (FULFILLMENT_LOGIC.md §2.4 — a service item forces its HOST group toward on-site, it
	// does not forever own a group of its own). `previouslyGrouped` is the signal that
	// tells the two cases apart: a service item seen in some group on the LAST sync —
	// whether that's this OnSite bucket or one the cashier dragged it into — is left
	// exactly where it already is; only a line that has never been placed anywhere before
	// gets the initial nudge. Falling through unclaimed here is deliberate: steps 2/4 below
	// already know how to preserve an unclaimed item in its current group like any
	// ordinary product, once it's no longer "new."
	const onSiteExisting = previous.find(
		(g) => g.kind === DeliveryGroupKind.OnSite && g.splitReason === SplitReason.Product
	);
	const onSiteSurvivingItemIds = (onSiteExisting?.itemIds ?? []).filter(
		(id) => cartItemIds.has(id) && !assignedItemIds.has(id)
	);
	const newServiceItemIds = serviceItems
		.map((i) => i.lineId!)
		.filter((id) => !previouslyGrouped.has(id) && !assignedItemIds.has(id));
	const onSiteItemIds = [...onSiteSurvivingItemIds, ...newServiceItemIds];
	if (onSiteItemIds.length > 0) {
		groups.push({
			...(onSiteExisting ?? newDeliveryGroup()),
			kind: DeliveryGroupKind.OnSite,
			locked: false,
			splitReason: SplitReason.Product,
			itemIds: onSiteItemIds,
			recipientName: ctx.recipientName,
			recipientAddress: ctx.recipientAddress,
			recipientAddressId: ctx.recipientAddressId
		});
		onSiteItemIds.forEach((id) => assignedItemIds.add(id));
	}

	// 1.5) "รับบางส่วน" — lines the cashier has already flipped to "รับเลยที่เคาน์เตอร์"
	// leave the shipment before origin ever gets a say: a line that's physically being
	// handed across the counter needs no origin parcel of its own, no matter which
	// warehouse it happens to have come from. Gated on isDelivery/allowPartialReceive
	// because pickup and pickup-later sales have no "shipped" side for a line to opt out
	// of in the first place — every line there is already collected in person.
	if (ctx.allowPartialReceive && ctx.isDelivery) {
		const handoverItems = shippableItems.filter(
			(i) =>
				!assignedItemIds.has(i.lineId!) &&
				receiveModeOf(i.receiveMode) === ReceiveMode.Now &&
				canReceiveNow(i, { sellingOriginId: ctx.sellingOriginId })
		);
		// A line that fails canReceiveNow (foreign origin, digital slipped through, ...)
		// falls through to shipping instead of erroring — the cart UI already disables
		// its ▲ toggle for exactly these lines, so reaching here with receiveMode 'now'
		// means stale state, not a real cashier choice, and shipping is the safe side to
		// default to (see receiveModeOf).
		if (handoverItems.length > 0) {
			const existing = previous.find((g) => g.splitReason === SplitReason.Receive);
			groups.push({
				...(existing ?? newDeliveryGroup()),
				kind: DeliveryGroupKind.PickupInStore,
				locked: true,
				splitReason: SplitReason.Receive,
				shippingFee: 0,
				itemIds: handoverItems.map((i) => i.lineId!),
				// This group may have been a Shipping default/origin parcel on an earlier
				// sync (before these lines were marked "now") — it must not keep an address
				// it no longer has any use for, same reasoning the origin and default steps
				// below already apply to their own groups.
				recipientAddress: undefined,
				recipientAddressId: undefined
			});
			handoverItems.forEach((i) => assignedItemIds.add(i.lineId!));
		}
	}

	// 2) Everything not digital (and not service — already dropped above) is grouped by
	// origin. The majority origin rides in the default group below; every minority
	// origin gets its own locked group — the cashier never chose this split, the
	// warehouse layout did.
	const nonDigitalItems = shippableItems.filter((i) => !assignedItemIds.has(i.lineId!));
	const originCounts = new Map<string, number>();
	nonDigitalItems.forEach((i) => {
		if (i.originId) originCounts.set(i.originId, (originCounts.get(i.originId) ?? 0) + 1);
	});
	let majorityOriginId: string | undefined;
	let majorityCount = -1;
	originCounts.forEach((count, originId) => {
		if (count > majorityCount) {
			majorityCount = count;
			majorityOriginId = originId;
		}
	});

	[...originCounts.keys()]
		.filter((originId) => originId !== majorityOriginId)
		.forEach((originId) => {
			const originItems = nonDigitalItems.filter((i) => i.originId === originId);
			const existing = previous.find(
				(g) => g.splitReason === SplitReason.Origin && g.originId === originId
			);
			groups.push({
				...(existing ?? newDeliveryGroup()),
				kind: physicalKind,
				locked: true,
				splitReason: SplitReason.Origin,
				originId,
				originName: originItems[0]?.originName,
				itemIds: originItems.map((i) => i.lineId!),
				// A pickup parcel has no shipping destination — clear whatever an earlier
				// sync (back when this group was still Shipping/OnSite) may have left behind.
				...(needsAddressKind ? {} : { recipientAddress: undefined, recipientAddressId: undefined })
			});
			originItems.forEach((i) => assignedItemIds.add(i.lineId!));
		});

	// 3) User-made (soft split) groups keep their identity and whichever of their
	// items are still in the cart. Never re-populated automatically — a soft split
	// only holds what the cashier explicitly moved into it. Hard splits above take
	// priority: an item claimed by a locked group above no longer counts here even if
	// it used to sit in this user group (see §3 "hard split ขึ้นก่อน").
	previous
		.filter((g) => g.splitReason === SplitReason.User)
		.forEach((g) => {
			const survivingItemIds = g.itemIds.filter(
				(id) => cartItemIds.has(id) && !assignedItemIds.has(id)
			);
			// An empty soft split used to auto-collapse right here (§4 S4 "กลุ่มว่างต้องยุบ
			// เอง"), which is exactly what made "+ แยกพัสดุเพิ่ม" look broken: the cashier
			// adds a parcel, this sync runs on the very next cart tick, and it disappears
			// before they can move anything into it. The group is the cashier's to keep or
			// delete now (see removeUserDeliveryGroup below) — sync no longer decides that
			// for them just because it happens to be empty at this instant.
			// A product tapped while this parcel is the active one joins it. The hard splits
			// above already claimed whatever they own (digital, handover, minority origin), so
			// those never reach here and the no-mixing rules still hold.
			const arrivingItemIds =
				g.id === activeId
					? shippableItems
							.map((i) => i.lineId!)
							.filter((id) => !previouslyGrouped.has(id) && !assignedItemIds.has(id))
					: [];
			const memberIds = [...survivingItemIds, ...arrivingItemIds];
			groups.push({ ...g, itemIds: memberIds });
			memberIds.forEach((id) => assignedItemIds.add(id));
		});

	// 4) Whatever is left — the common case with zero splits — lands in the one
	// default group, carrying the recipient the cashier already picked for the sale.
	const defaultItemIds = shippableItems
		.map((i) => i.lineId!)
		.filter((id) => !assignedItemIds.has(id));
	if (defaultItemIds.length > 0) {
		const existing = previous.find((g) => !g.locked && g.splitReason === undefined);
		// The default parcel follows the sale's buyer address — but only when that
		// address itself changed. Re-stamping it on every sync would silently undo an
		// address the cashier set on this parcel in the drawer the next time anything
		// else moved (a qty edit is enough), which is the one kind of data loss this
		// feature cannot afford: they would pay for a parcel going somewhere else.
		const buyerAddressChanged = ctx.recipientAddress !== lastSyncedBuyerAddress;
		const keepChosenRecipient = !!existing && !buyerAddressChanged;

		groups.push({
			...(existing ?? newDeliveryGroup()),
			kind: physicalKind,
			locked: false,
			splitReason: undefined,
			itemIds: defaultItemIds,
			...(keepChosenRecipient
				? {}
				: {
						recipientName: ctx.recipientName,
						recipientAddress: ctx.recipientAddress,
						recipientAddressId: ctx.recipientAddressId
					}),
			// A pickup parcel is collected in person, not shipped to the buyer's address —
			// stamped last so it wins over both the spread above and keepChosenRecipient,
			// otherwise a sale that flips from ShopDelivery to PickupImmediate would keep
			// showing the address it shipped to a moment ago. OnSite keeps its address too
			// (needsAddressKind), same reasoning as Shipping — only the two pickup kinds
			// genuinely have no destination to fill.
			...(needsAddressKind ? {} : { recipientAddress: undefined, recipientAddressId: undefined })
		});
	}

	lastSyncedBuyerAddress = ctx.recipientAddress;

	if (activeId && !groups.some((g) => g.id === activeId)) {
		activeDeliveryGroupId.set(undefined);
	}
	deliveryGroups.set(groups);
}

export function addUserDeliveryGroup(kind: DeliveryGroupKind = DeliveryGroupKind.Shipping): string {
	// A digital parcel is a hard split the sync engine owns (step 1 of syncDeliveryGroups)
	// — it exists because an item forces it, never because the cashier chose to make one.
	// Falling back to Shipping keeps that invariant even if a caller passes Digital here.
	const resolvedKind = kind === DeliveryGroupKind.Digital ? DeliveryGroupKind.Shipping : kind;
	const group = newDeliveryGroup({
		kind: resolvedKind,
		splitReason: SplitReason.User,
		locked: false
	});
	deliveryGroups.update((groups) => [...groups, group]);
	return group.id;
}

/**
 * The cashier's own entry point into a group order. Three things happen together, in
 * this order, because each depends on the one before it:
 *
 * 1. groupOrderActive flips true FIRST — syncDeliveryGroups' early-return guard checks
 *    it, so a pickup/pickup-later sale with no digital item (which otherwise builds no
 *    groups at all, see that guard) must already be past it before the next step can
 *    build anything.
 * 2. syncDeliveryGroups runs right here, synchronously, with the sale's current
 *    items/ctx — this is what actually materializes whatever is ALREADY in the cart
 *    into its own group. Without this, that cart content would stay invisible (zero
 *    delivery groups) until some unrelated cart edit happened to trigger Cart.svelte's
 *    own reactive sync on its own, leaving the cashier looking at an empty group-order
 *    screen right after asking for one.
 * 3. The group that sync just built for those items — the sale's own "no reason to be
 *    split yet" bucket (locked: false, splitReason: undefined) — is promoted to
 *    SplitReason.User. The cashier is choosing, right now, to treat their existing
 *    items as one of several named groups ("กลุ่ม 1"), not leave them in an anonymous,
 *    non-removable, kind-locked leftover bucket beside the new group being added.
 *
 * A plain hard-split (digital item, mixed origin) never needs any of this: it already
 * forces its own locked group regardless of fulfilment, with nothing to promote.
 */
export function enableGroupOrder(
	items: TCartItem[],
	ctx: Parameters<typeof syncDeliveryGroups>[1],
	kind?: DeliveryGroupKind
): string {
	groupOrderActive = true;
	syncDeliveryGroups(items, ctx);
	deliveryGroups.update((groups) =>
		groups.map((g) =>
			!g.locked && g.splitReason === undefined ? { ...g, splitReason: SplitReason.User } : g
		)
	);
	return addUserDeliveryGroup(kind);
}

export function moveItemToGroup(itemId: string, targetGroupId: string): void {
	deliveryGroups.update((groups) => {
		const source = groups.find((g) => g.itemIds.includes(itemId));
		const target = groups.find((g) => g.id === targetGroupId);
		// Locked groups are not a cashier decision on either end: you cannot pull an
		// item out of one (it would break why the split exists) and you cannot drop
		// one into another (the wireframe shows locked destinations disabled, §4 S4).
		if (!source || !target || source.locked || target.locked || source.id === target.id) {
			return groups;
		}

		return groups
			.map((g) => {
				if (g.id === source.id) {
					return { ...g, itemIds: g.itemIds.filter((id) => id !== itemId) };
				}
				if (g.id === target.id) {
					return { ...g, itemIds: [...g.itemIds, itemId] };
				}
				return g;
			})
			// A user split survives even when this move empties it out — same reasoning as
			// step 3 of syncDeliveryGroups: it is the cashier's parcel to delete explicitly
			// (removeUserDeliveryGroup), not something this move silently erases the moment
			// its last item leaves. Only the (hypothetical, never actually built today) case
			// of an unnamed, non-locked, non-user group collapses when emptied.
			.filter((g) => g.locked || g.splitReason === SplitReason.User || g.itemIds.length > 0);
	});
}

// A removed user group's items must land somewhere — prefer the default parcel (the
// sale's "no reason to be split" bucket, since that is where they would have sat had the
// cashier never split them out) and fall back to any other non-locked group otherwise.
// Returns undefined only when every other group is locked, i.e. the cart is 100%
// hard-split and there is nowhere for these items to go without breaking a hard split.
const findReceiverGroup = (
	groups: DeliveryGroup[],
	group: DeliveryGroup
): DeliveryGroup | undefined => {
	const byDefault = groups.find(
		(g) => g.id !== group.id && !g.locked && g.splitReason === undefined
	);
	if (byDefault) return byDefault;
	return groups.find((g) => g.id !== group.id && !g.locked);
};

export interface RemovedDeliveryGroup {
	group: DeliveryGroup;
	/** position in the store array, so an undo can put it back where it was. */
	index: number;
	/** the parcel its items were merged into; undefined when it was empty. */
	targetGroupId?: string;
}

/** Pure predicate — the UI disables its ลบ button with exactly this rule. */
export function canRemoveDeliveryGroup(groups: DeliveryGroup[], id: string): boolean {
	const group = groups.find((g) => g.id === id);
	// Only a cashier-made soft split is theirs to delete — a hard split exists for a
	// reason the cashier did not choose, and the default parcel is not "a split" at all.
	if (!group || group.locked || group.splitReason !== SplitReason.User) return false;
	// Nothing to relocate, so nothing can block the removal.
	if (group.itemIds.length === 0) return true;
	// A group holding items can only go if somewhere else can take them — the items must
	// end up living in SOME parcel, never vanish along with the group that held them.
	return !!findReceiverGroup(groups, group);
}

/**
 * Deletes a cashier-made parcel. Its items (if any) are folded into the group
 * `findReceiverGroup` picks, so nothing the cashier already put in the cart disappears
 * along with the parcel it was sitting in. Refuses (returns undefined, no state change)
 * exactly where `canRemoveDeliveryGroup` says no — a locked/default group, or a group
 * with items and no receiver to take them.
 */
export function removeUserDeliveryGroup(id: string): RemovedDeliveryGroup | undefined {
	const groups = get(deliveryGroups);
	if (!canRemoveDeliveryGroup(groups, id)) return undefined;

	const index = groups.findIndex((g) => g.id === id);
	const group = groups[index];
	if (get(activeDeliveryGroupId) === id) activeDeliveryGroupId.set(undefined);
	const receiver =group.itemIds.length > 0 ? findReceiverGroup(groups, group) : undefined;

	const nextGroups = groups
		.filter((g) => g.id !== id)
		.map((g) =>
			receiver && g.id === receiver.id ? { ...g, itemIds: [...g.itemIds, ...group.itemIds] } : g
		);
	deliveryGroups.set(nextGroups);
	// Mirrors the reference pattern's "dropping back to 1 group exits group mode
	// automatically" — without this, a pickup sale that soft-split down to just its
	// default group again would stay (wrongly) exempt from the early-return guard in
	// syncDeliveryGroups forever, via a stale groupOrderActive from earlier in this sale.
	if (nextGroups.length <= 1) groupOrderActive = false;

	return { group, index, targetGroupId: receiver?.id };
}

/**
 * Undoes `removeUserDeliveryGroup` — puts the group back where it was and pulls its
 * items back out of whichever group they got merged into. A no-op if a group with this
 * id already exists (e.g. a stale undo fired after the cashier already recreated it by
 * hand), so callers can invoke it freely from a toast action without re-checking state.
 */
export function restoreDeliveryGroup(removed: RemovedDeliveryGroup): void {
	deliveryGroups.update((groups) => {
		if (groups.some((g) => g.id === removed.group.id)) return groups;

		const removedItemIds = new Set(removed.group.itemIds);
		// Strip the restored items back out of the receiver — they belong to the parcel
		// being restored again, not to both places at once.
		const withoutMergedItems = groups.map((g) =>
			g.id === removed.targetGroupId
				? { ...g, itemIds: g.itemIds.filter((itemId) => !removedItemIds.has(itemId)) }
				: g
		);

		const insertAt = Math.min(removed.index, withoutMergedItems.length);
		const restored = [
			...withoutMergedItems.slice(0, insertAt),
			removed.group,
			...withoutMergedItems.slice(insertAt)
		];

		// If pulling those items back out left the receiver empty, drop it under the same
		// rule moveItemToGroup and syncDeliveryGroups use: only a locked or user-split
		// group is allowed to stay empty, so this undo doesn't strand a bare default group.
		const result = restored.filter(
			(g) => g.locked || g.splitReason === SplitReason.User || g.itemIds.length > 0
		);
		// Undoing a removal that brought the sale back above 1 group must re-arm the same
		// flag removeUserDeliveryGroup clears on the way down — otherwise a pickup sale's
		// next unrelated cart edit (syncDeliveryGroups runs on every cart change) would wipe
		// the just-restored split right back out.
		groupOrderActive = result.length > 1;
		return result;
	});
}

export function updateDeliveryGroup(id: string, patch: Partial<DeliveryGroup>): void {
	deliveryGroups.update((groups) => groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
}

export function resetDeliveryGroups(): void {
	deliveryGroups.set([]);
	activeDeliveryGroupId.set(undefined);
	lastSyncedBuyerAddress = undefined;
	groupOrderActive = false;
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
		// Never let an unresolved fee collapse to ฿0 in the order total (§6).
		...(summary.feeUnknown ? {} : { shippingFee: summary.totalFee })
	};

	setDelivery(delivery);
}
