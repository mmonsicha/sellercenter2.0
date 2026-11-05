import type { ShippingType } from './order';

// Item-level fulfilment — what KIND of thing a line is, not how it moves. Comes from
// PIS `product.type` (see pis-adapter.ts) and rides on TCartItem.fulfilmentType. Kept
// separate from order-level FullfilmentType (pickupImmediate/pickupLater/shopDelivery
// in order.ts), which is about how the WHOLE sale is collected, not each item.
export enum ItemFulfilmentType {
	Physical = 'physical',
	Digital = 'digital',
	Service = 'service'
}

// "รับบางส่วน" (partial receive) — a property of the LINE, not of the order. The
// order-level FullfilmentType (pickupImmediate/pickupLater/shopDelivery) only seeds the
// default a line starts with; the cashier can still flip any individual line to Now on a
// จัดส่งให้ลูกค้า sale, at which point it rides in the handover group instead of shipping.
export enum ReceiveMode {
	Now = 'now',
	Ship = 'ship'
}

// Ship is the safe default because a ship line declares a destination requirement the pay
// gate can check, while a wrongly-defaulted "now" line would let a customer walk out
// without goods that were never actually handed over.
export const receiveModeOf = (raw?: string): ReceiveMode =>
	raw === ReceiveMode.Now ? ReceiveMode.Now : ReceiveMode.Ship;

// What a พัสดุ (parcel/delivery group) card actually is, for icon + label purposes.
export enum DeliveryGroupKind {
	Shipping = 'shipping',
	Digital = 'digital',
	PickupLater = 'pickupLater',
	// A walk-in (รับสินค้าเลย) sale's physical parcel is none of the above — it never
	// ships and the customer isn't coming back for it later, they're standing at the
	// counter. Forced into existence only when a digital item splits the cart (see
	// syncDeliveryGroups); an ordinary pickup sale never builds groups at all.
	PickupInStore = 'pickupInStore',
	// A service item (ติดตั้ง/ซ่อม, ...) performed AT the customer's site — staff travels
	// there, so unlike Digital this kind needs a real address, and unlike Shipping it has
	// no courier, only a flat travel fee (see kindNeedsTravelFee). Forced the same way
	// Digital is, in syncDeliveryGroups step 1.
	OnSite = 'onSite'
}

// Why a group exists at all. `undefined` on a DeliveryGroup means "this is just the
// default bucket" — see `newDeliveryGroup`. A hard split (Product/Origin/Stock/Receive) is
// system-decided and the group is `locked`; `User` is a soft split the cashier chose
// and can undo by re-picking the line's own fulfilment kind (see resolveLineKind).
// Receive is a hard split too, but derived a different way than the others: Product/
// Origin/Stock come from a property of the ITEM the cashier doesn't control at the parcel
// level at all, while Receive comes from a property of the line (its own receiveMode)
// that the cashier DOES control — just never by dragging the parcel around. They flip the
// line in the cart, syncDeliveryGroups reacts, and the group stays locked because editing
// its membership through the drawer would be a second control for the same one fact.
export enum SplitReason {
	Product = 'product',
	Origin = 'origin',
	Stock = 'stock',
	Receive = 'receive',
	User = 'user',
	// Basic mode's own hard split — a category bucket (Shipping/OnSite/PickupLater) that
	// exists purely because another category is also present in the same sale, not because
	// of origin/stock/a cashier choice. See syncBasicGroups.
	Fulfilment = 'fulfilment'
}

export interface DeliveryGroup {
	id: string;
	kind: DeliveryGroupKind;
	/** undefined on the default group. Set = this group exists for a reason. */
	splitReason?: SplitReason;
	/** hard split: items cannot be moved out and the group cannot be merged away. */
	locked: boolean;
	/** TCartItem.lineId values in this group — a LINE's membership, not a product's, so
	 *  the same product_id can sit in several groups at once as separate lines. */
	itemIds: string[];
	recipientName?: string;
	recipientAddress?: string; // display string
	recipientAddressId?: string;
	recipientEmail?: string; // digital delivery destination
	/** digital delivery destination, alternative to email — an e-voucher only needs one. */
	recipientPhone?: string;
	originId?: string;
	originName?: string;
	courier?: string;
	method?: string;
	shippingType?: ShippingType;
	/** Same Day only — which vehicle the courier dispatches (motorcycle/car/pickup/small
	 *  truck). Frontend-only for now: no matching field exists on the order payload yet
	 *  (see commitDeliveryGroupsToOrder), so this never leaves the cart's own state. */
	vehicleType?: string;
	/** undefined = not calculated. NEVER default to 0 — §6 forbids ฿0 leaking into totals. */
	shippingFee?: number;
	/** OnSite only — where the service itself happens. undefined = not chosen yet (a
	 *  cashier must pick one explicitly, there is no default — see isDestinationReady).
	 *  'customer' means staff travels to the buyer's own address; 'store' means the
	 *  customer comes in instead, to whichever branch onSiteStoreId names. */
	onSiteLocation?: 'store' | 'customer';
	/** OnSite + onSiteLocation 'store' only — which of the company's own branches the
	 *  customer comes in to. Any branch is a legal choice (every branch can offer the
	 *  service), unlike PickupLater's branch which only ever means the one selling it. */
	onSiteStoreId?: string;
	note?: string;
	/** PickupLater only — a per-group override of which branch the customer collects
	 *  from. The sale itself still carries its own pickupStoreId (Cart.svelte) as the
	 *  DEFAULT every new PickupLater group seeds from, but different PickupLater groups
	 *  in the same sale may need picking up from different branches, so the choice must
	 *  live on the group, not just once for the whole sale. */
	pickupStoreId?: string;
	/** PickupLater only — ISO date string (e.g. '2026-11-10') the customer said they'd come
	 *  collect on. Optional: a cashier may not know yet, and nothing downstream requires it. */
	pickupDate?: string;
	/** PickupLater only — the collection time, 'HH:MM' with minutes on a quarter-hour step
	 *  (00/15/30/45), e.g. '10:15'. Picked via a 24-hour hour+minute TimePicker, not a free
	 *  time input. */
	pickupTimeSlot?: string;
	/** Shipping only — which "เพิ่มตัวเลือกรับสินค้า" Shipping pile/address this group is.
	 *  1 = the sale's own default address (ctx.recipientAddress); 2+ = an additional
	 *  Shipping pile the cashier opened with its own, distinct address (see
	 *  TCartItem.lineAddressId / OpenFulfilmentPile.addressId). Always 1 on every
	 *  non-Shipping group, so nothing else needs to special-case its absence. */
	addressGroupSeq: number;
}

// `crypto.randomUUID` only exists in a secure context, and the dev server is reached
// over plain http on a LAN host (vite.config.js: host 0.0.0.0 + seller.sellsuki.local),
// where it is undefined — calling it bare throws the moment an order first splits.
// Same guard + fallback the payment path already uses (utils/idempotency.ts); these ids
// never leave the browser, so uniqueness within the session is all they need.
export const newGroupId = (): string => {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}

	return `parcel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const newDeliveryGroup = (patch?: Partial<DeliveryGroup>): DeliveryGroup => ({
	id: newGroupId(),
	kind: DeliveryGroupKind.Shipping,
	locked: false,
	itemIds: [],
	addressGroupSeq: 1,
	...patch
});

// A group is ready to ship the moment it knows where things go. Digital has no address
// at all — email IS the destination. A pickup group (in-store or later) has no
// destination to know at all — the customer collects it in person, and which branch
// that is gets decided elsewhere in the cart (pickupStoreId / the selling store), not
// on the parcel itself — so it is always ready.
//
// The customer collects a pickup parcel in person, so it has no recipient and no
// address of its own — which branch it is collected at is an order-level choice made in
// the cart (pickupStoreId / the selling store), never something to edit per parcel.
// OnSite is deliberately excluded — staff travels to the customer, so it needs a real
// address same as Shipping, unlike a pickup kind which has no destination to fill at all.
export const isPickupKind = (kind: DeliveryGroupKind): boolean =>
	kind === DeliveryGroupKind.PickupInStore || kind === DeliveryGroupKind.PickupLater;

const PICKUP_SHORT_THAI_MONTHS = [
	'ม.ค.',
	'ก.พ.',
	'มี.ค.',
	'เม.ย.',
	'พ.ค.',
	'มิ.ย.',
	'ก.ค.',
	'ส.ค.',
	'ก.ย.',
	'ต.ค.',
	'พ.ย.',
	'ธ.ค.'
];

// Compact "10 พ.ย." for the cashier-facing pickup-date suffix. Parses the ISO date's own
// y-m-d components directly instead of `new Date(iso)` — the latter reads an ISO date as
// UTC midnight, which rolls back a day in any browser west of UTC even though every
// cashier here is in Asia/Bangkok picking a plain calendar date, not a timestamp.
export const shortThaiDate = (iso?: string): string | undefined => {
	if (!iso) return undefined;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	if (!match) return undefined;
	const month = PICKUP_SHORT_THAI_MONTHS[Number(match[2]) - 1];
	if (!month) return undefined;
	return `${Number(match[3])} ${month}`;
};

// 24-hour TimePicker options — hour 00-23, minute quarter-steps only (the cashier picks a
// specific collection time, not a window; a courier/customer-facing time never needs
// minute-level precision finer than a quarter hour here).
export const PICKUP_TIME_HOURS: string[] = Array.from({ length: 24 }, (_, h) =>
	String(h).padStart(2, '0')
);
export const PICKUP_TIME_MINUTES: string[] = ['00', '15', '30', '45'];

// A point-in-time's plain "10:15" display label — passthrough, kept as a named export so
// call sites don't care whether the value ever grows formatting beyond the raw "HH:MM".
export const pickupTimeSlotLabel = (slot?: string): string | undefined => slot || undefined;

// PickupLater's compact "date time" suffix for cashier-facing summaries (the merged
// "สาขาที่รับสินค้า" row, the multi-kind pile card) — undefined whenever neither is set,
// since both fields are optional and never show a placeholder/warning for being unset.
export const pickupDateTimeText = (group?: DeliveryGroup): string | undefined => {
	const date = shortThaiDate(group?.pickupDate);
	const time = pickupTimeSlotLabel(group?.pickupTimeSlot);
	if (!date && !time) return undefined;
	return [date, time].filter(Boolean).join(' ');
};

// The 4 kinds a cashier-made (soft-split, SplitReason.User) group may be assigned to
// directly — Digital stays excluded: a digital parcel is a hard split the sync engine
// owns, never a manual pick.
// OnSite stays INCLUDED here even though a service item also force-builds its own
// locked OnSite group: a cashier can still manually pick OnSite for a non-service item
// (e.g. an on-site consultation sold as a plain physical line) and that group is a soft
// split like any other. canChangeGroupKind's `!group.locked` already keeps the
// service-forced OnSite group's picker hidden — the two never collide.
export const userSelectableKinds: DeliveryGroupKind[] = [
	DeliveryGroupKind.PickupInStore,
	DeliveryGroupKind.PickupLater,
	DeliveryGroupKind.Shipping,
	DeliveryGroupKind.OnSite
];

// Mirrors the activation rule already in DeliveryGroupCards.svelte — only a cashier's
// own soft split is theirs to reassign; a hard split (digital, origin, handover) is the
// engine's decision, never something a dropdown here should offer to change.
export const canChangeGroupKind = (group: DeliveryGroup): boolean =>
	!group.locked && group.splitReason === SplitReason.User;

export const isDestinationReady = (g: DeliveryGroup): boolean => {
	if (g.kind === DeliveryGroupKind.Digital) {
		// Either destination gets the voucher there — a phone-only buyer is not "missing"
		// a destination just because they have no email on file.
		return !!g.recipientEmail || !!g.recipientPhone;
	}
	if (isPickupKind(g.kind)) {
		return true;
	}
	// OnSite has no default location any more — a cashier must explicitly pick one before
	// it counts as ready. 'store' needs a branch (onSiteStoreId), same as a pickup kind
	// needing nothing further once it has ITS destination; 'customer' needs a real address,
	// same as Shipping below. Neither choice made yet is simply not ready.
	if (g.kind === DeliveryGroupKind.OnSite) {
		if (g.onSiteLocation === 'store') return !!g.onSiteStoreId;
		if (g.onSiteLocation === 'customer') return !!g.recipientAddress;
		return false;
	}
	return !!g.recipientAddress;
};

// Wording matches the user's own mockup exactly — the mockup is the source of truth,
// not whatever text existed here before (รับที่ร้าน/รับทีหลัง/จัดส่ง/ดิจิทัล).
// OnSite's label used to read "ให้บริการที่สถานที่ลูกค้า" (service AT the customer's
// place) while its own groupKindHint below read "ให้บริการนอกสถานที่ลูกค้า" (service
// OUTSIDE the customer's place) — two contradictory framings of the same kind, and
// neither one covered onSiteLocation's other branch ('store': the customer comes in
// instead of staff travelling out). "ให้บริการ" + a hint naming both locations is the
// one phrasing that stays true regardless of which onSiteLocation the cashier picks.
export const groupKindLabel = (kind: DeliveryGroupKind): string => {
	switch (kind) {
		case DeliveryGroupKind.Digital:
			return 'จัดส่งเข้าระบบ (ดิจิทัล)';
		case DeliveryGroupKind.PickupLater:
			return 'รับภายหลัง';
		case DeliveryGroupKind.PickupInStore:
			return 'รับทันที';
		case DeliveryGroupKind.OnSite:
			return 'ให้บริการ';
		case DeliveryGroupKind.Shipping:
		default:
			return 'จัดส่งจากร้าน';
	}
};

export const groupKindIcon = (kind: DeliveryGroupKind): string => {
	switch (kind) {
		case DeliveryGroupKind.Digital:
			return 'outline-bolt';
		case DeliveryGroupKind.PickupLater:
			return 'outline-clock';
		case DeliveryGroupKind.PickupInStore:
			// Same icon Cart.svelte's own fullfilmentMeta uses for PickupImmediate — one
			// visual vocabulary for "hand it over the counter" everywhere it shows up.
			return 'outline-shopping-bag';
		case DeliveryGroupKind.OnSite:
			// Best-guess wrench/tool icon — confirm this name against the DS icon set.
			return 'outline-wrench-screwdriver';
		case DeliveryGroupKind.Shipping:
		default:
			return 'outline-truck';
	}
};

// Byte-identical to Cart.svelte's own local `fullfilmentMeta` hints — that selector picks
// the sale's overall fulfilment, this one picks a single group's, but the user wants them
// to read as "the same dropdown," so the copy must never drift between the two call sites.
export const groupKindHint = (kind: DeliveryGroupKind): string => {
	switch (kind) {
		case DeliveryGroupKind.Digital:
			return 'ส่งสินค้าดิจิทัลเข้าระบบลูกค้า';
		case DeliveryGroupKind.PickupLater:
			return 'ลูกค้ามารับภายหลัง';
		case DeliveryGroupKind.PickupInStore:
			return 'รับสินค้าไปเลย';
		case DeliveryGroupKind.OnSite:
			return 'เลือกได้ทั้งที่ร้านและนอกสถานที่';
		case DeliveryGroupKind.Shipping:
		default:
			return 'ร้านจัดส่งให้ลูกค้า';
	}
};

// Only a Shipping parcel has a courier to pick and a fee to set — a pickup parcel is
// handed over the counter and a digital one is emailed, neither has a "วิธีส่ง" at all.
export const kindNeedsShippingMethod = (kind: DeliveryGroupKind): boolean =>
	kind === DeliveryGroupKind.Shipping;

// Only OnSite has a flat travel fee to set — reuses the group's own `shippingFee`
// field rather than a new one, same as Digital already stores 0 there.
export const kindNeedsTravelFee = (kind: DeliveryGroupKind): boolean =>
	kind === DeliveryGroupKind.OnSite;

// Everything a cashier must still fill in before this group can be paid for — a real
// destination (isDestinationReady) alone isn't enough: Shipping also needs a courier FIELD
// answered, and PickupLater still needs which branch. "ไม่ระบุ" (the 'unknown' sentinel) is
// a real, selectable row in standardDeliveries/sameDayDeliveries/paymentMethods, not a
// placeholder — once the cashier has actually opened the settings drawer and picked it, that
// counts as the field being answered, same as picking any real courier would. Only an
// untouched group (g.method still undefined — syncDeliveryGroups never stamps a default
// here) is genuinely missing. A Shipping/OnSite fee left blank is NOT missing information
// either — it's simply ฿0 (see every `shippingFee ?? 0` read elsewhere), so it's never
// checked here. Kept separate from isDestinationReady itself (whose exact "has a
// destination" semantics the existing test suite pins) rather than folded into it — this is
// the broader "ready to pay" question deliverySummary.missing actually needs.
export const isGroupFulfilmentComplete = (g: DeliveryGroup): boolean => {
	if (!isDestinationReady(g)) return false;
	if (g.kind === DeliveryGroupKind.PickupLater) return !!g.pickupStoreId;
	if (kindNeedsShippingMethod(g.kind)) return !!g.method;
	return true;
};

export const splitReasonText = (reason?: SplitReason): string => {
	switch (reason) {
		case SplitReason.Product:
			return 'สินค้าดิจิทัลรวมกับพัสดุอื่นไม่ได้';
		case SplitReason.Origin:
			return 'สินค้ามาจากคนละคลัง';
		case SplitReason.Stock:
			return 'สินค้ายังไม่พร้อมส่ง';
		case SplitReason.Receive:
			return 'คุณเลือกรับสินค้ารายการนี้ที่เคาน์เตอร์';
		case SplitReason.User:
			return 'คุณเลือกแยกพัสดุนี้เอง';
		case SplitReason.Fulfilment:
			return 'แยกตามรูปแบบการรับสินค้า';
		default:
			return '';
	}
};

// Unknown/empty product type falls back to Physical — the safest guess, because a
// physical badge means "must have an address" and silently treating an unknown item
// as digital/service could let it ship with no destination at all. See IA wireframe
// §4 S1 "error" state.
export const itemFulfilmentOf = (raw?: string): ItemFulfilmentType => {
	switch (raw) {
		case ItemFulfilmentType.Digital:
			return ItemFulfilmentType.Digital;
		case ItemFulfilmentType.Service:
			return ItemFulfilmentType.Service;
		default:
			return ItemFulfilmentType.Physical;
	}
};

// A service item (บริการห่อของขวัญ, ...) is performed AT the customer's site, same
// footing as Digital's own locked group — on-site visit is necessarily its own
// destination, so it is always hard-split into its own locked OnSite group (see
// syncDeliveryGroups' service hard-split step). One predicate so the store and every
// component that needs to identify these items compare against the same rule instead of
// re-deriving it from itemFulfilmentOf themselves.
export const isServiceItem = (fulfilmentType?: string): boolean =>
	itemFulfilmentOf(fulfilmentType) === ItemFulfilmentType.Service;

// The one group `syncDeliveryGroups` builds for "รับบางส่วน" — the pile of lines the
// cashier handed over at the counter instead of shipping. Same reason `isServiceItem`
// exists as its own predicate: every caller compares against this rule, never
// `g.splitReason === SplitReason.Receive` re-typed by hand at each call site.
export const isHandoverGroup = (g: DeliveryGroup): boolean =>
	g.splitReason === SplitReason.Receive;

export interface ReceiveNowContext {
	/** origin the sale is being rung up from; undefined disables the origin check. */
	sellingOriginId?: string;
}

// The prototype also blocks out-of-stock and pre-order lines from being received now, but
// this repo has no inventory signal to check that against: SaleProduct (src/lib/entities/
// sale/sale.ts) carries only `type`, and originId/originName exist on TCartItem but
// nothing populates them yet. This is the one place to add those blocks once PIS provides
// the data — every caller asks this function, never re-derives the rule itself.
export function receiveNowBlockReason(
	item: { fulfilmentType?: string; originId?: string; originName?: string },
	ctx: ReceiveNowContext = {}
): string | undefined {
	if (itemFulfilmentOf(item.fulfilmentType) === ItemFulfilmentType.Digital) {
		return 'สินค้าดิจิทัลส่งทางอีเมลเท่านั้น';
	}
	if (item.originId && ctx.sellingOriginId && item.originId !== ctx.sellingOriginId) {
		return `สินค้ามาจาก${item.originName ?? 'คลังอื่น'} — รับที่สาขานี้ไม่ได้`;
	}
	return undefined;
}

export const canReceiveNow = (
	item: { fulfilmentType?: string; originId?: string; originName?: string },
	ctx: ReceiveNowContext = {}
): boolean => !receiveNowBlockReason(item, ctx);

// qty lives on the cart line, not on the group, so anywhere that needs "N ชิ้น" must pass
// the cart in — `deliverySummary` deliberately stays a pure function of `deliveryGroups`
// and must not grow a dependency on the cart store.
export const handoverItemQty = (
	group: DeliveryGroup,
	items: { lineId?: string; qty: number }[]
): number =>
	items
		.filter((i) => !!i.lineId && group.itemIds.includes(i.lineId))
		.reduce((sum, i) => sum + i.qty, 0);

// ---------------------------------------------------------------------------------------
// Basic mode — splits ONLY by fulfilment category (one shared destination per category),
// as opposed to the "advanced" group-order mode where the cashier makes multiple named
// parcels with their own per-parcel addresses. See src/stores/order/delivery-group.ts
// syncBasicGroups for the engine that actually builds these groups.
// ---------------------------------------------------------------------------------------

// A digital item picked up "now" is the same handover as any other รับทันที line — it
// never gets its own pile/card, only its own contact-info validation once merged into
// one. Shared by CartFulfilmentPiles (the cart list) and Cart.svelte (the fulfilment-info
// cards) so the two never disagree about which kind a digital line display as.
// Digital used to display-merge into PickupInStore ("รับทันที") here — a digital line had
// no FullfilmentType or bucket of its own, so it folded into the counter pickup card rather
// than showing as an empty section somewhere. Now that Digital has its own selectable
// FullfilmentType (DigitalDelivery, "จัดส่งเข้าระบบ (ดิจิทัล)") it needs its own bucket too,
// so this is a plain identity mapping. Kept (not deleted, with every call site touched)
// as the one place a future kind's display-vs-storage split would go again.
export const displayKindOf = (kind: DeliveryGroupKind): DeliveryGroupKind => kind;

// Basic mode's own category copy — deliberately separate from groupKindLabel (the
// per-parcel card label used in advanced mode); the two are allowed to read differently
// since a basic category chip and an advanced parcel card are different UI, not the same
// dropdown that groupKindLabel/groupKindHint promise to stay byte-identical with.
export const basicCategoryLabel = (kind: DeliveryGroupKind): string => {
	switch (kind) {
		case DeliveryGroupKind.PickupLater:
			return 'รับภายหลัง';
		case DeliveryGroupKind.Shipping:
			return 'จัดส่ง';
		case DeliveryGroupKind.OnSite:
			return 'บริการ';
		case DeliveryGroupKind.Digital:
			return 'ดิจิทัล';
		case DeliveryGroupKind.PickupInStore:
		default:
			return 'รับทันที';
	}
};

// One shared colour-per-kind mapping for basic mode's own UI (the pile section badges in
// CartFulfilmentPiles and the per-line picker pill in CartItem) — both must read as the
// same visual vocabulary, so neither re-derives this switch on its own.
export const fulfilmentTone = (
	kind: DeliveryGroupKind
): 'success' | 'warning' | 'info' | 'violet' | 'primary' => {
	switch (kind) {
		case DeliveryGroupKind.PickupLater:
			return 'warning';
		case DeliveryGroupKind.Shipping:
			return 'info';
		case DeliveryGroupKind.OnSite:
			return 'violet';
		case DeliveryGroupKind.Digital:
			return 'primary';
		case DeliveryGroupKind.PickupInStore:
		default:
			return 'success';
	}
};

// The fixed display/bucket order basic mode lays its category groups out in — never the
// order items happen to appear in the cart.
export const BASIC_CATEGORY_ORDER: DeliveryGroupKind[] = [
	DeliveryGroupKind.PickupInStore,
	DeliveryGroupKind.PickupLater,
	DeliveryGroupKind.Shipping,
	DeliveryGroupKind.OnSite,
	DeliveryGroupKind.Digital
];

// Marketplace channels ship through the platform's own logistics (Shopee/Lazada/TikTok
// Shop) — a physical line sold through one of these can never be handed over the counter
// or picked up later, it is always a single Shipping group billed to the platform, never
// the merchant's own courier. Matches the `value`s already listed in order.ts's
// `salesChannels`/`standardDeliveries` so this never drifts from what the rest of the
// cart calls these channels.
const MARKETPLACE_SUB_CHANNELS = new Set(['shopee', 'lazada', 'tiktok', 'lineShopping']);

export const isMarketplaceChannel = (subChannel?: string): boolean =>
	!!subChannel && MARKETPLACE_SUB_CHANNELS.has(subChannel);

export interface LineFulfilmentCtx {
	channel: 'pos' | 'online' | 'linkbill';
	marketplace: boolean;
}

// Which DeliveryGroupKind(s) a single LINE may legally sit in, given what it is (digital/
// service/physical) and how the sale is being sold. A digital or service item has exactly
// one legal destination — it is never a choice. A marketplace physical line has exactly
// one too (the platform's own logistics). Everything else gets a real menu: an online/
// link-bill physical line may ship now or be picked up later (no counter — nobody is
// standing at one), while a POS physical line gets the full three-way choice a cashier
// actually has in front of them. OnSite is deliberately never one of these options for a
// PHYSICAL line on ANY channel — it exists purely so a service item's own hard-split group
// (and the sale-level "ให้บริการ" pick that activates its pile/contact card) has somewhere
// to live; a plain physical line dropped there would be rejected the same way, see
// CartFulfilmentPiles' own onDropOnPile.
export function lineFulfilmentOptions(
	item: { fulfilmentType?: string },
	ctx: LineFulfilmentCtx
): DeliveryGroupKind[] {
	const kind = itemFulfilmentOf(item.fulfilmentType);
	if (kind === ItemFulfilmentType.Digital) return [DeliveryGroupKind.Digital];
	if (kind === ItemFulfilmentType.Service) return [DeliveryGroupKind.OnSite];
	if (ctx.marketplace) return [DeliveryGroupKind.Shipping];
	// Online now gets the same "ship now or pick up later" choice Link Bill already had
	// (PO brief: online's own "รูปแบบการรับสินค้า" dropdown adds รับภายหลัง/ให้บริการ beside
	// its existing จัดส่ง default) — a physical line still never goes to OnSite itself, only
	// a service item does, via the early return above.
	if (ctx.channel === 'online' || ctx.channel === 'linkbill') {
		return [DeliveryGroupKind.Shipping, DeliveryGroupKind.PickupLater];
	}
	return [DeliveryGroupKind.PickupInStore, DeliveryGroupKind.PickupLater, DeliveryGroupKind.Shipping];
}

// The line's actual, effective kind in basic mode — one line, one category, with a clear
// priority order: (1) a digital/service/marketplace item has no choice at all; (2) the
// cashier's own explicit per-line pick (lineFulfilment) wins, as long as it is still a
// legal option for this line; (3) the OLD per-line toggle (receiveMode === 'now', POS
// only) is honoured for a line nobody has re-picked yet, so an already-flipped "รับเลยที่
// เคาน์เตอร์" line keeps meaning the same thing it always did; (4) otherwise the line
// just follows however the whole sale is being collected; (5) and failing even that,
// whatever the first legal option is.
export function resolveLineKind(
	item: { fulfilmentType?: string; lineFulfilment?: string; receiveMode?: string },
	saleDefaultKind: DeliveryGroupKind,
	ctx: LineFulfilmentCtx
): DeliveryGroupKind {
	const options = lineFulfilmentOptions(item, ctx);
	if (options.length === 1) return options[0];

	if (item.lineFulfilment && options.includes(item.lineFulfilment as DeliveryGroupKind)) {
		return item.lineFulfilment as DeliveryGroupKind;
	}

	if (!item.lineFulfilment && ctx.channel === 'pos' && item.receiveMode === ReceiveMode.Now) {
		return DeliveryGroupKind.PickupInStore;
	}

	if (options.includes(saleDefaultKind)) return saleDefaultKind;
	return options[0];
}

/**
 * Buckets a flat set of lines into kind → lineIds, each line resolved through
 * `resolveLineKind`. Pure — no store reads — so both basic mode's single-destination
 * split (`syncBasicGroups`) and "จัดส่งหลายที่อยู่"'s per-destination split
 * (`syncAddressGroups`) can run the exact same categorisation, just over a different
 * item subset each time. `honourReceiveMode` mirrors syncBasicGroups' own gate — only a
 * POS จัดส่งให้ลูกค้า destination still means anything by a line's legacy receiveMode.
 */
export function computeKindBuckets(
	items: { lineId?: string; fulfilmentType?: string; lineFulfilment?: string; receiveMode?: string }[],
	saleDefaultKind: DeliveryGroupKind,
	ctx: LineFulfilmentCtx,
	honourReceiveMode: boolean
): Map<DeliveryGroupKind, string[]> {
	const buckets = new Map<DeliveryGroupKind, string[]>();
	items.forEach((item) => {
		if (!item.lineId) return;
		const effectiveItem = honourReceiveMode ? item : { ...item, receiveMode: undefined };
		const kind = resolveLineKind(effectiveItem, saleDefaultKind, ctx);
		const bucket = buckets.get(kind) ?? [];
		bucket.push(item.lineId);
		buckets.set(kind, bucket);
	});
	return buckets;
}
