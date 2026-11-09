<script lang="ts">
	import {
		calculateSummary,
		calculateTotalPrice,
		cartListInfo,
		GetExistingCart
	} from '$stores/cart/cart';
	import { afterUpdate, onDestroy, onMount, getContext } from 'svelte';
	import { get } from 'svelte/store';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import CartItem from './CartItem.svelte';
	import FulfilmentMenu from './FulfilmentMenu.svelte';
	import CartFulfilmentPiles from './CartFulfilmentPiles.svelte';
	import EmptyCart from './EmptyCart.svelte';
	import CartFooter from './CartFooter.svelte';
	import type { TCartItem } from '$stores/cart';
	import { currentLanguage } from '$stores/i18n';
	import {
		customerAddressToString,
		type Address,
		type Customer
	} from '$lib/entities/customer/customer';
	import {
		FullfilmentType,
		newPartyInfo,
		type PartyInfo,
		PaymentType,
		SaleChannelType,
		SaleChannelUI,
		saleChannelToPayload,
		paymentMethods,
		salesChannels,
		sameDayDeliveries,
		standardDeliveries,
		vehicleTypes,
		ShippingType,
		type DeliveryOption
	} from '$lib/entities/order/order';
	import CustomFancyRadioGroup from '$components/CustomFancyRadioGroup.svelte';
	import IconLabel from '$components/IconLabel.svelte';
	import {
		clearOrderMeta,
		orderData,
		setPartyInfoToOrder,
		setPaymentType,
		setSalesChannel
	} from '$stores/order/order';
	import { orderDeliveryI18nKey } from '$utils/i18n-keys';
	import { countriesList } from '$stores/country';
	import DrawerCustomerAddress from './section/DrawerCustomerAddress.svelte';
	import ModalPickupBranch from './section/ModalPickupBranch.svelte';
	import ModalAddPileAddress from './section/ModalAddPileAddress.svelte';
	import InlineContactEdit from './section/InlineContactEdit.svelte';
	import PickList from './section/PickList.svelte';
	import PickCard from './section/PickCard.svelte';
	import { currentCompany } from '$stores/company/current-company';
	import { currentStore } from '$stores/store/current-store';
	import { addressToDisplay } from '$utils/format-address';
	import { maskPhoneMiddle } from '$utils/format-phone';
	import { formatPriceWithBath } from '$utils/format-number';
	import type { Store } from '$lib/entities/store/store';
	import {
		deliveryGroups,
		deliverySummary,
		physicalKindFor,
		resetDeliveryGroups,
		syncDeliveryGroups,
		updateDeliveryGroup
	} from '$stores/order/delivery-group';
	import {
		DeliveryGroupKind,
		ItemFulfilmentType,
		displayKindOf,
		handoverItemQty,
		isMarketplaceChannel,
		itemFulfilmentOf,
		basicCategoryLabel,
		type DeliveryGroup
	} from '$lib/entities/order/delivery-group';
	import { isMultiParcelEnabled } from '$lib/feature-flags';
	import {
		ResetPhysicalLineFulfilment,
		SetCartItemPickupStore,
		SetCartItemAddressId,
		addOpenFulfilmentPile,
		activeFulfilmentPile,
		openFulfilmentPiles,
		removeOpenFulfilmentPile,
		setActiveFulfilmentPile
	} from '$stores/cart/cart';

	export let buyer: PartyInfo | undefined;
	export let fullfilmentType: string;

	const toastStore = getContext<ToastStore>('toast');

	var total: number = 0;
	var discount: number = 0;
	var summary: number = 0;
	var cartList: TCartItem[];
	// One drawer holds customer + address; this only decides which half it lands on.
	let showDrawerCustomer: boolean = false;
	let customerDrawerOpenOn: 'customer' | 'address' = 'customer';
	let showPickupModal: boolean = false;
	// Where the customer will collect a pick-up-later order. The company's branches are
	// already in memory from the company load, so the picker needs no extra request.
	let pickupStoreId: string = '';
	// DigitalDelivery as the sale's own DEFAULT only makes sense when every line in the cart
	// is a digital product (see the auto-follow reactive block below) — offering it as the
	// default otherwise would promise an email-only sale for items that still need a
	// physical destination. OnSite has no such gate; any POS sale can dispatch staff out.
	$: isAllDigitalCart =
		cartList?.length > 0 &&
		cartList.every((i) => itemFulfilmentOf(i.fulfilmentType) === ItemFulfilmentType.Digital);
	// The LIST itself is unconditional — "จัดส่งเข้าระบบ (ดิจิทัล)" is a row here always,
	// same as every other kind (none of PickupImmediate/PickupLater/ShopDelivery/OnSite
	// wait for a matching item before they show up either), not only once a digital item
	// happens to already be in the cart. Matches "+เพิ่มตัวเลือกรับสินค้า"'s own pileTypeOptions,
	// which has always listed Digital unconditionally (just disabled once a digital bucket
	// already exists) — the two dropdowns offer the same set of kinds.
	//
	// Online gets this same dropdown now too (PO brief), minus รับทันที (no counter to hand
	// anything over at for an online sale). ShopDelivery ("จัดส่ง") is still the list's
	// first non-pickup-later entry, matching online's own pre-existing default.
	$: fullfilmentOptions = isOnline
		? [
				FullfilmentType.PickupLater,
				FullfilmentType.ShopDelivery,
				FullfilmentType.OnSite,
				FullfilmentType.DigitalDelivery
			]
		: [
				FullfilmentType.PickupImmediate,
				FullfilmentType.PickupLater,
				FullfilmentType.ShopDelivery,
				FullfilmentType.OnSite,
				FullfilmentType.DigitalDelivery
			];
	// The cashier never has to find "จัดส่งเข้าระบบ (ดิจิทัล)" by hand — the moment the cart
	// goes all-digital, the sale's own fulfilment type follows automatically, same as every
	// digital LINE already force-resolves into its own Digital group regardless of what's
	// picked here (see resolveLineKind). Deliberately skips handleSelectOption's own
	// ResetPhysicalLineFulfilment — there's no physical line left to reset while this is
	// true, and switching back out (a physical item added back in) must not wipe any open
	// piles the cashier already set up for OTHER physical lines sitting beside it. Only POS
	// shows this dropdown at all — online/ลิงก์ already resolve a digital line into its own
	// group the same way regardless of fullfilmentType, so this would be a no-op write there
	// anyway, best left undone.
	//
	// Used to also auto-revert back to PickupImmediate the instant the cart stopped being
	// all-digital, on the premise that DigitalDelivery was only ever a legal choice then.
	// Now that fullfilmentOptions lists it unconditionally (every other kind here is always
	// selectable too, cart contents or not), a cashier picking it by hand on a mixed cart is
	// a real choice, not a stale leftover value — auto-reverting it the next tick undid that
	// choice before it ever painted, so this branch is gone.
	$: if (isPos && cartList?.length > 0 && isAllDigitalCart && fullfilmentType !== FullfilmentType.DigitalDelivery) {
		fullfilmentType = FullfilmentType.DigitalDelivery;
		setSalesChannel({
			...$orderData.saleChannel,
			saleOrigin: FullfilmentType.DigitalDelivery,
			type: SaleChannelType.Offline
		});
	}
	// The channel / fulfilment / customer block collapses to a one-line summary so the
	// list gets the space back. A view toggle, not a data change: nothing selected is
	// cleared, and the collapsed strip states what it is holding, so the cashier can
	// still read the sale's context — and click it to open the block again.
	let topCollapsed = false;
	// "ไม่ระบุ" (unknown) is the default sub-channel for an online sale — the cashier picks
	// a real one explicitly rather than it defaulting to a specific platform.
	const DEFAULT_SUB_CHANNEL = 'unknown';
	// OMS 2.0 names the three channels POS / ONLINE / LINK_BILL and puts them on the top
	// row of the cart; the old two-value index could not express the third one.
	let channel: SaleChannelUI = SaleChannelUI.Pos;
	// Sub-channel (LINE / Shopee / …) is a cart field now, not something buried in the
	// online drawer. It writes the same order field the drawer always wrote.
	let subChannel: string = DEFAULT_SUB_CHANNEL;

	// Card copy for the fulfilment selector: the title is the DS-translated label, the
	// second line says what it means in the shop, so the card explains itself without
	// spending a row on a field label.
	const fullfilmentMeta: Record<string, { icon: string; hint: string; label: string }> = {
		[FullfilmentType.PickupImmediate]: {
			icon: 'outline-shopping-bag',
			hint: 'รับสินค้าไปเลย',
			label: 'รับทันที'
		},
		[FullfilmentType.PickupLater]: {
			icon: 'outline-clock',
			hint: 'ลูกค้ามารับภายหลัง',
			label: 'รับภายหลัง'
		},
		[FullfilmentType.ShopDelivery]: {
			icon: 'outline-truck',
			hint: 'ร้านจัดส่งให้ลูกค้า',
			label: 'จัดส่งจากร้าน'
		},
		[FullfilmentType.OnSite]: {
			icon: 'outline-wrench-screwdriver',
			// "ให้บริการ" + a hint naming both locations — matches groupKindLabel/groupKindHint
			// in delivery-group.ts, which used to contradict each other (ที่สถานที่ลูกค้า vs
			// นอกสถานที่ลูกค้า) and neither covered onSiteLocation's 'store' branch.
			hint: 'เลือกได้ทั้งที่ร้านและนอกสถานที่',
			label: 'ให้บริการ'
		},
		[FullfilmentType.DigitalDelivery]: {
			icon: 'outline-bolt',
			hint: 'ส่งสินค้าดิจิทัลเข้าระบบลูกค้า',
			label: 'จัดส่งเข้าระบบ (ดิจิทัล)'
		}
	};

	$: isPos = channel === SaleChannelUI.Pos;
	$: isOnline = channel === SaleChannelUI.Online;
	$: isLinkBill = channel === SaleChannelUI.LinkBill;
	$: subChannelOption = salesChannels.find((c) => c.value === subChannel);
	// The online drawer commits saleOrigin straight into the order on ตกลง, so this row has
	// to read that field back: without it the panel keeps showing the sub-channel the
	// cashier replaced (LINE on screen while the order carries Shopee), and the panel is
	// the control that stays on screen. Only known sub-channels are accepted — POS and
	// link-bill park a fulfilment value in the same field.
	$: if (isOnline) {
		const origin = $orderData.saleChannel?.saleOrigin;
		if (origin && origin !== subChannel && salesChannels.some((c) => c.value === origin)) {
			subChannel = origin;
		}
	}

	$: branches = ($currentCompany?.stores ?? []) as Store[];
	// The branch ringing up the sale is the sane default: most customers come back to
	// the shop they bought from.
	$: if (!pickupStoreId && $currentStore?.id) pickupStoreId = $currentStore.id;
	// A digital line never gets its own fulfilment-info card — it displays as "รับทันที"
	// (same rule CartFulfilmentPiles uses for the cart list itself), its contact-info
	// validation riding along on that merged card instead. displayKinds is presentKinds
	// (the real, group-backed kinds everything else below still reasons about) collapsed
	// through that same rule, deduped.
	$: displayKinds = Array.from(new Set(presentKinds.map(displayKindOf)));
	// A single present kind needs its one relevant field shown inline, not the generic
	// multi-kind settings drawer (opened per-pile now, via CartFulfilmentPiles' own
	// settings button — see onEditPile/openEditingKind). presentKinds already falls back to
	// a one-element array for an unsplit sale, so this also covers the ordinary,
	// non-group-order cart.
	$: singleKind = displayKinds.length === 1 ? displayKinds[0] : undefined;
	// Mirrors CartFulfilmentPiles' own `buckets.length` exactly (same branch/address-key
	// sets) — computed independently here off the same stores/items rather than threaded through as
	// a prop, since Cart.svelte already reads every input that computation needs. "รูปแบบ
	// การรับสินค้า" above already states the sale's one kind whenever there's truly only one
	// bucket, so that ONE bucket needs no badge of its own repeating it — its settings move
	// to the inline rows below instead. The moment a SECOND bucket exists for ANY reason
	// (another kind, or a second instance of the SAME kind via "เพิ่มตัวเลือกรับสินค้า"),
	// CartFulfilmentPiles shows every bucket as a badge pile instead, so these inline rows
	// must also stop showing then — gating on the TOTAL count (not per-kind) is what keeps
	// the two components' decisions from ever disagreeing, unlike a per-kind version tried
	// and reverted earlier.
	$: pickupLaterBucketCount = new Set([
		...itemsOfKind(DeliveryGroupKind.PickupLater).map((i) => i.linePickupStoreId ?? ''),
		...$openFulfilmentPiles
			.filter((p) => p.kind === DeliveryGroupKind.PickupLater)
			.map((p) => p.pickupStoreId ?? '')
	]).size;
	$: shippingBucketCount = new Set([
		...itemsOfKind(DeliveryGroupKind.Shipping).map((i) => i.lineAddressId ?? ''),
		...$openFulfilmentPiles
			.filter((p) => p.kind === DeliveryGroupKind.Shipping)
			.map((p) => p.addressId ?? '')
	]).size;
	// PickupInStore and Digital are each their own bucket now (displayKindOf no longer
	// folds Digital into PickupInStore) — counted separately so a cart with both รับทันที
	// and a digital line correctly reads as 2 buckets, not 1.
	$: totalBucketCount =
		pickupLaterBucketCount +
		shippingBucketCount +
		(hasOnSite ? 1 : 0) +
		(hasPickupInStore ? 1 : 0) +
		(hasDigital ? 1 : 0);
	// Filled by CartFulfilmentPiles (bind:) — the buckets it actually draws. Only rendered
	// with items in the cart, so an empty cart still falls back to totalBucketCount.
	let pileBucketCount = 0;
	let pileSoleKind: DeliveryGroupKind | undefined;
	$: isSingleBucket = cartList?.length > 0 ? pileBucketCount <= 1 : totalBucketCount <= 1;
	// The one kind the single-bucket inline rows belong to (undefined once 2+ buckets).
	$: soleKind = !isSingleBucket
		? undefined
		: cartList?.length > 0
			? pileSoleKind
			: presentKinds[0];
	// The collapsed "รูปแบบการรับสินค้า" trigger must say what's actually IN the cart, not
	// the sale's raw default — a line added through "เพิ่มตัวเลือกรับสินค้า" carries its own
	// override, so whenever every line in the cart agrees on one kind, that kind is what
	// this header shows, even if it differs from the sale's own default (fullfilmentType).
	// Equal to fullfilmentType's own kind whenever nothing is overridden, so this is a
	// pure display fix with no behaviour change in the common case. The dropdown's own
	// `value`/option-highlighting below stays on the real fullfilmentType — only the
	// collapsed summary borrows singleKind.
	function fullfilmentTypeForKind(kind: DeliveryGroupKind): string {
		switch (kind) {
			case DeliveryGroupKind.PickupLater:
				return FullfilmentType.PickupLater;
			case DeliveryGroupKind.Shipping:
				return FullfilmentType.ShopDelivery;
			case DeliveryGroupKind.OnSite:
				return FullfilmentType.OnSite;
			case DeliveryGroupKind.Digital:
				return FullfilmentType.DigitalDelivery;
			case DeliveryGroupKind.PickupInStore:
			default:
				return FullfilmentType.PickupImmediate;
		}
	}
	$: displayFullfilmentType = singleKind ? fullfilmentTypeForKind(singleKind) : fullfilmentType;
	// Which rows in "รูปแบบการรับสินค้า"'s own option list already have a bucket in the cart
	// right now — a multi-fulfilment sale (isMultiFulfilment) can have several categories
	// live at once, so a plain single aria-selected (one radio-style pick) can't say that;
	// this is what lets the dropdown show a ✓ on every category actually present, not just
	// the one `fullfilmentType` itself still points at. displayKinds alone only covers a
	// kind with an actual GROUP-backed item in it — an open-but-still-empty pile (see
	// handleSelectOption's own Digital branch, and "เพิ่มตัวเลือกรับสินค้า" for every other
	// kind) has no group yet, so it would otherwise show no ✓ at all the moment the cashier
	// opens it, before anything has actually landed inside.
	$: presentFullfilmentTypes = new Set([
		...displayKinds.map(fullfilmentTypeForKind),
		...$openFulfilmentPiles.map((p) => fullfilmentTypeForKind(p.kind as DeliveryGroupKind))
	]);
	// Shipping/OnSite both need a destination + a fee, same as their own per-group card
	// already does inside the drawer — shown even for the ordinary, unsplit sale (today's
	// showDeliveryDetail/zero-cost path hides ALL delivery UI until a real split or a
	// digital item exists, which left these two fulfilment types with nowhere to confirm
	// an address/fee at all until the cashier happened to open the drawer some other way).
	// Keyed off the resolved kind (not raw fullfilmentType) so this also covers an online
	// sale, which always resolves to a Shipping-kind group via isDelivery/physicalKindFor
	// regardless of what fullfilmentType happens to hold.
	// Digital can never have more than one bucket (it's never split by branch/address the
	// way รับภายหลัง/จัดส่ง can be) — combined with isSingleBucket where this is actually
	// used, its own inline row only shows while Digital is the sale's ONLY bucket; the
	// moment a second bucket exists for any reason, CartFulfilmentPiles' own Digital badge
	// (see hasSettings) becomes the one place to manage it instead.
	// hasDigital alone only turns true once a real digital LINE is already in the cart (it
	// reads actual delivery groups) — but handleSelectOption now opens an empty Digital
	// pile the instant the cashier picks "จัดส่งเข้าระบบ (ดิจิทัล)" by hand on an EMPTY cart
	// (see presentKinds' own fallback below), so this also checks displayFullfilmentType —
	// NOT raw fullfilmentType, which goes stale the moment real, non-digital cart content
	// resolves to something else and nothing ever resets it back. Reading the raw field
	// here used to leave this card stuck showing forever: pick Digital, then add an ordinary
	// physical or service item instead, and "ส่งสินค้าดิจิทัลไปที่" kept appearing underneath
	// a cart that had moved on to something else entirely.
	$: needsDigitalContact = hasDigital || (isPos && displayFullfilmentType === FullfilmentType.DigitalDelivery);
	// The one-and-only group a plain, unsplit sale already has (syncDeliveryGroups' own
	// "default group" step) — reused here instead of duplicating its address/fee fields.
	$: singleDeliveryGroup = liveGroups[0];

	function methodLabel(method?: string): string {
		// Marketplace groups carry the literal 'platform' sentinel (see syncBasicGroups) —
		// never a real courier value, so it needs its own label rather than falling through
		// to the raw string.
		if (method === 'platform') return `ตามแพลตฟอร์ม (${subChannelOption?.label ?? subChannel})`;
		const found = [...standardDeliveries, ...sameDayDeliveries].find((o) => o.value === method);
		return found?.label.replace(/<br\s*\/?>/gi, ' ') ?? method ?? '';
	}

	const onSelectPickupBranch = (branch: Store) => {
		if (editingKind === DeliveryGroupKind.PickupLater && editingPickupStoreId) {
			// A specific branch's pile is open (editingPickupStoreId is that branch's id) — only
			// the lines actually sitting in THAT pile move to the newly picked branch; a
			// different branch's own รับภายหลัง pile must not be touched by editing this one.
			itemsOfKind(DeliveryGroupKind.PickupLater).forEach((item) => {
				if (item.lineId && item.linePickupStoreId === editingPickupStoreId) {
					SetCartItemPickupStore(item.lineId, branch.id);
				}
			});
			editingPickupStoreId = branch.id;
			return;
		}
		// No specific pile is being edited (the single-kind "สาขาที่รับสินค้า" inline row, or
		// the sale-default pile with no branch override of its own) — updating the sale's own
		// default branch is enough: a line with no override already falls back to it (see
		// pickupLaterBranchIds above), and a line carrying its OWN explicit branch is untouched.
		pickupStoreId = branch.id ?? pickupStoreId;
	};

	// Picking a branch or an address is the same job — one choice out of a short list,
	// each option several lines long — so both use the same modal + card list instead
	// of a dropdown whose menu is narrower than its own field.
	$: selectedAddress = addresses.find((a) => String(a.id) === idAddress);
	$: if (!idAddress && addresses.length > 0) {
		const fallback = addresses.find((a) => a.isDefault) ?? addresses[0];
		if (fallback?.id) {
			idAddress = String(fallback.id);
			// Writing only the id left buyer.address empty when the customer has no default
			// address: the panel read as complete while ชำระเงิน stayed disabled.
			onClickSelectAddress(fallback);
		}
	}
	// A customer is mandatory unless the buyer walks out with the goods immediately.
	// A customer is mandatory for every ONLINE / LINK_BILL sale, and for POS unless the
	// buyer walks out with the goods immediately — and always once a digital or service
	// item is in the cart, pickup-immediate or not. Those last two clauses are
	// multi-parcel's own rule (an item needs an email/address to send itself to), so they
	// drop out with the flag — a production cashier must not be gated on a requirement
	// nothing on screen explains.
	// displayFullfilmentType, not the raw fullfilmentType — once real cart content resolves
	// to its own single kind (singleKind), THAT is what's actually true now, same as the
	// dropdown's own trigger label already shows. Reading raw fullfilmentType here let it
	// go stale: pick "จัดส่งเข้าระบบ (ดิจิทัล)" on an empty cart, then add only plain physical
	// pickup-now items (no split, so nothing ever resets fullfilmentType itself) — the sale
	// kept demanding a customer forever after, for what had become an ordinary walk-in sale.
	$: customerRequired =
		!isPos ||
		(isMultiParcelEnabled() && (hasShip || hasOnSite || hasPickupLater || hasDigital)) ||
		displayFullfilmentType !== FullfilmentType.PickupImmediate;
	$: customerContact =
		[maskPhoneMiddle(buyer?.phone), buyer?.email].filter(Boolean).join(' · ') || 'ผูกลูกค้าแล้ว';
	$: customerTooltip = buyer?.name
		? [buyer.name, buyer.phone, buyer.email].filter(Boolean).join(' · ')
		: 'เลือกลูกค้า';

	// Computed standalone (not read off deliveryCtx.marketplace below) so isDelivery can use
	// it without a circular dependency — deliveryCtx itself depends on isDelivery.
	$: isMarketplaceOnline = isOnline && isMarketplaceChannel(subChannel);
	// Delivery groups mirror the cart + fulfilment + buyer on every change, so the S2
	// row and the drawer always reflect the current split (see delivery-group.ts). A
	// shop sale that never becomes a delivery (pickup, POS pickup-later) keeps isDelivery
	// false, which is what makes syncDeliveryGroups leave the group list empty and the
	// row below not render at all — the 80-90% case pays for none of this.
	// Online used to be isDelivery UNCONDITIONALLY — every online physical line only ever
	// had one legal destination (Shipping, see lineFulfilmentOptions). Now that online gets
	// its own "รูปแบบการรับสินค้า" dropdown (รับภายหลัง/จัดส่ง/ให้บริการ, PO brief), it follows
	// fullfilmentType the same way POS already does — EXCEPT a marketplace sub-channel
	// (Shopee/Lazada/...) still forces Shipping regardless, since those physical lines have
	// no other legal destination either way (lineFulfilmentOptions' own marketplace branch).
	$: isDelivery =
		(isPos && fullfilmentType === FullfilmentType.ShopDelivery) ||
		(isOnline && fullfilmentType === FullfilmentType.ShopDelivery);
	// "รับบางส่วน" (Option B) only ever applies to a POS จัดส่งให้ลูกค้า sale — no fourth
	// FullfilmentType is added for it. order-flow.ts already maps ShopDelivery to the
	// deliver-from-store flow, which is the correct order-level flow for a sale that part-
	// ships; a new enum value would ride into saleChannel.saleOrigin with no backend
	// behaviour behind it at all.
	$: allowPartialReceive = isPos && fullfilmentType === FullfilmentType.ShopDelivery;
	$: deliveryCtx = {
		// The store's ctx field is spelled with one "l" (fulfilmentType); this component's
		// own prop keeps the codebase's existing two-"l" spelling (fullfilmentType) — see
		// delivery-group.ts's own comment on why the two are deliberately kept apart.
		fulfilmentType: fullfilmentType,
		isDelivery,
		allowPartialReceive,
		// sellingOriginId deliberately NOT passed: TCartItem.originId is a warehouse/origin
		// id nothing in this repo populates yet, and $currentStore.id is a store id from a
		// different id space entirely — wiring the two together would invent a false
		// "รับที่สาขานี้ไม่ได้" the day origins actually start arriving. The check
		// (receiveNowBlockReason) stays dormant until both sides come from the same id
		// space; same reasoning applies to the sellingOriginId omitted below on
		// CartReceivePiles.
		recipientName: buyer?.name,
		recipientAddress: buyer?.address,
		recipientAddressId: idAddress,
		recipientEmail: buyer?.email,
		// Basic mode fields — see LineFulfilmentCtx / syncBasicGroups.
		channel: (isOnline ? 'online' : isLinkBill ? 'linkbill' : 'pos') as 'pos' | 'online' | 'linkbill',
		subChannel,
		// Only decides how a Shipping group ships (courier "ตามแพลตฟอร์ม") — a marketplace
		// sale still picks รูปแบบการรับสินค้า freely (see syncBasicGroups' lineCtx).
		marketplace: isMarketplaceOnline,
		recipientPhone: buyer?.phone,
		pickupStoreId,
		// "เพิ่มตัวเลือกรับสินค้า" Shipping piles (addressGroupSeq 2+) — their own
		// recipientName/recipientAddress resolved from the customer's address book, since
		// syncBasicGroups only ever receives ids/strings via ctx, never the Address list
		// itself.
		shippingAddresses: addresses
			.filter((a) => !!a.id)
			.map((a) => ({
				addressId: String(a.id),
				recipientName: a.contactName,
				recipientAddress: addressToDisplay(a)
			}))
	};
	let syncTick = 0;
	$: {
		syncDeliveryGroups(cartList ?? [], deliveryCtx);
		syncTick += 1;
	}
	// Svelte may run `$deliveryGroups` readers before the sync above in the same tick, leaving
	// them one cart change stale; depending on syncTick forces ordering, get() reads the fresh value.
	const freshGroups = (_tick: number, _groups: DeliveryGroup[]): DeliveryGroup[] =>
		get(deliveryGroups);
	$: liveGroups = freshGroups(syncTick, $deliveryGroups);

	// [] (zero-cost walk-in) reads as "only the sale default", same as syncBasicGroups — but
	// that ALSO covers an ordinary cart that already has real, unsplit PHYSICAL items in it
	// (a plain pickup-now sale never builds groups at all, see syncDeliveryGroups), not just
	// a genuinely empty one. physicalKindFor is deliberately "non-digital" (see its own doc
	// comment) — it only ever needs to resolve a PHYSICAL line's default bucket, since a
	// digital line never consults it at all (resolveLineKind returns Digital immediately, no
	// fallback asked). But this particular fallback is for DISPLAY — it's what the dropdown
	// trigger label, singleKind etc. fall back to before any real group exists — and a
	// cashier who just picked "จัดส่งเข้าระบบ (ดิจิทัล)" by hand on a genuinely EMPTY cart (see
	// handleSelectOption's own open-Digital-pile branch) expects the trigger to keep showing
	// Digital, not silently relabel itself "รับทันที" the instant physicalKindFor's
	// non-digital contract kicks in. The `cartList?.length === 0` guard is what keeps this
	// scoped to that one case: add 2 plain physical items to a cart still carrying a stale
	// fullfilmentType='digitalDelivery' (nothing else in the cart ever resets it back) and
	// this must resolve to PickupInStore like any other walk-in sale, not keep claiming
	// Digital for a cart that plainly isn't any more. Checked first, ahead of physicalKindFor,
	// so this one display fallback alone knows about Digital without loosening
	// physicalKindFor's own real contract.
	$: presentKinds = liveGroups.length > 0
		? Array.from(new Set(liveGroups.map((g) => g.kind)))
		: [
				isPos && cartList?.length === 0 && fullfilmentType === FullfilmentType.DigitalDelivery
					? DeliveryGroupKind.Digital
					: physicalKindFor(fullfilmentType, isDelivery)
			];
	let editingKind: DeliveryGroupKind | undefined;
	// รับภายหลัง only — which branch's own pile is open in the settings drawer, so the
	// drawer, pickupLaterGroupFor and onSelectPickupBranch all stay scoped to the same one
	// pile instead of the sale-wide (possibly ambiguous) pickupLaterGroup.
	let editingPickupStoreId: string | undefined;
	// Shipping only — which "เพิ่มตัวเลือกรับสินค้า" pile's own address is open in the
	// settings drawer, same role editingPickupStoreId plays for รับภายหลัง. undefined means
	// the sale's own default (seq 1) pile.
	let editingAddressId: string | undefined;
	const runFromSettings = (action: () => void) => {
		editingKind = undefined;
		editingPickupStoreId = undefined;
		editingAddressId = undefined;
		action();
	};
	// The settings drawer a customer/address pick was started from — reopened the moment
	// the customer drawer closes, so picking an address mid-setup lands the cashier back
	// where they were instead of making them reopen the pile's settings by hand. Drafts
	// (courier, fee, branch...) are untouched while it's closed, so they survive the trip.
	let settingsReturn:
		| { kind: DeliveryGroupKind; pickupStoreId?: string; addressId?: string }
		| undefined;
	const openCustomerFromSettings = (half: 'customer' | 'address') => {
		if (editingKind) {
			settingsReturn = {
				kind: editingKind,
				pickupStoreId: editingPickupStoreId,
				addressId: editingAddressId
			};
		}
		runFromSettings(() => openCustomerDrawer(half));
	};
	$: isSavableKind =
		editingKind === DeliveryGroupKind.Shipping ||
		editingKind === DeliveryGroupKind.OnSite ||
		editingKind === DeliveryGroupKind.PickupLater;

	// Basic mode's own inline shipping/travel-fee drafts — never touches DrawerDelivery
	// (the group-order drawer), per the rule that basic mode has nothing to do with it.
	// Draft+save so a cashier backing out with "ยกเลิก" doesn't half-write the group.
	let draftShippingType: ShippingType = ShippingType.Standard;
	let draftMethod: string = 'unknown';
	// Same Day only — which vehicle the courier dispatches. Lives beside draftMethod
	// rather than its own editingKind branch since it is just one more field of the same
	// Shipping settings, shown only while draftShippingType is SameDay.
	let draftVehicleType: string = 'unknown';
	let draftFee: string = '';
	let draftTravelFee: string = '';
	// OnSite only — where the service happens (see DeliveryGroup.onSiteLocation's own
	// comment). No default: starts unset so neither tab reads as already chosen, forcing
	// an explicit pick same as every group's own onSiteLocation starts unset.
	let draftOnSiteLocation: 'store' | 'customer' | undefined = undefined;
	// OnSite + draftOnSiteLocation 'store' only — which branch (see DeliveryGroup.onSiteStoreId).
	let draftOnSiteStoreId: string = '';
	// รับภายหลัง's own drawer drafts — date/time window, same draft+save pattern as
	// shipping/on-site. Branch stays on the pre-existing immediate-commit modal flow
	// (onSelectPickupBranch) rather than becoming a third draft field here: it already has
	// to re-stamp every existing PickupLater line's own linePickupStoreId the moment it's
	// picked (see onSelectPickupBranch's own comment), a side effect "ยกเลิก" can't sanely
	// undo, so it is left exactly as it already behaves everywhere else it's used.
	let draftPickupDate: string = '';
	let draftPickupTimeSlot: string = '';
	// <ssk-date-picker>'s own value prop is a JS Date, draftPickupDate/draftPickupTimeSlot are
	// plain 'YYYY-MM-DD'/'HH:MM' strings — same conversion idiom BankTransferFields.svelte
	// already uses for its own ssk-date-picker: parse/format through y/m/d(/h/m) components
	// directly (never `new Date(iso)`/`date.toISOString()`), since both of those read/write
	// UTC midnight and roll the date back a day in any browser west of UTC — every cashier
	// here is in Asia/Bangkok picking a plain calendar date and wall-clock time, not a
	// timestamp.
	function buildPickupDateTime(dateIso: string, timeSlot: string): Date | undefined {
		if (!dateIso) return undefined;
		const [year, month, day] = dateIso.split('-').map(Number);
		const [hour, minute] = timeSlot ? timeSlot.split(':').map(Number) : [0, 0];
		const d = new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
		return isNaN(d.getTime()) ? undefined : d;
	}
	function formatDateToIsoLocal(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
	function formatTimeSlotLocal(date: Date): string {
		const hour = String(date.getHours()).padStart(2, '0');
		const minute = String(date.getMinutes()).padStart(2, '0');
		return `${hour}:${minute}`;
	}
	$: draftPickupDateValue = buildPickupDateTime(draftPickupDate, draftPickupTimeSlot);
	function onDraftPickupDateChange(e: CustomEvent<{ value?: Date }>) {
		// <ssk-date-picker>'s own `change` event carries `detail.value` — NOT `valueFrom`
		// (that key belongs to <ssk-range-date-picker> only). Reading the wrong key silently
		// dropped every pick here (always undefined), which is why nothing ever saved.
		const picked = e.detail?.value;
		draftPickupDate = picked ? formatDateToIsoLocal(picked) : '';
		draftPickupTimeSlot = picked ? formatTimeSlotLocal(picked) : '';
	}
	// Online's ONE payment choice for the whole order — a dropdown styled like
	// ช่องทางการขาย. No ไม่ระบุ: an online order must always say how it is paid.
	// `hidden` options are planned but not offered yet (QR code — no backend flow).
	const ONLINE_PAYMENT_OPTIONS: { value: string; label: string; icon: string; hidden?: boolean }[] = [
		{ value: PaymentType.BankTransfer, label: 'โอนผ่านธนาคาร', icon: 'outline-building-library' },
		{ value: PaymentType.Cod, label: 'เก็บเงินปลายทาง (COD)', icon: 'outline-truck' },
		{ value: 'qrCode', label: 'QR Code', icon: 'outline-qr-code', hidden: true }
	];
	// COD is collected by the courier on delivery, so it needs a parcel going out AND no
	// รับภายหลัง group — goods the customer collects at a branch can't be paid on delivery.
	$: codAllowed = hasShip && !hasPickupLater;
	$: onlinePaymentOptions = ONLINE_PAYMENT_OPTIONS.filter(
		(o) => !o.hidden && (codAllowed || o.value !== PaymentType.Cod)
	);
	$: onlinePaymentOption = ONLINE_PAYMENT_OPTIONS.find((o) => o.value === $orderData.paymentType);
	$: if (isOnline && !codAllowed && $orderData.paymentType === PaymentType.Cod) setPaymentType('unknown');
	const paymentLabel = (value?: string): string =>
		ONLINE_PAYMENT_OPTIONS.find((o) => o.value === value)?.label ??
		getLabelFromValue(value ?? '', 'paymentMethods');
	$: paymentMissing =
		isOnline && !isMarketplaceOnline && (!$orderData.paymentType?.trim() || $orderData.paymentType === 'unknown');

	// Resolves the specific รับภายหลัง group a pile's settings button means — an undefined
	// target (the single-kind inline row, where there is no ambiguity to begin with) must
	// resolve to the "no branch override" group the same way pickupLaterBranchIds and
	// CartFulfilmentPiles' own bucket keying already treat a line with no linePickupStoreId
	// of its own: as belonging to the sale's own default branch. A branch group built by
	// syncBasicGroups always carries a real, resolved pickupStoreId (never literally
	// undefined), so comparing through `?? pickupStoreId` on both sides is what makes an
	// undefined target match that one plain group instead of matching nothing.
	function pickupLaterGroupFor(targetPickupStoreId: string | undefined): DeliveryGroup | undefined {
		// liveGroups is itself computed by a `$:` statement (line ~384); Svelte's dependency
		// tracker only sees identifiers referenced directly inside a `$:` expression, not ones
		// read through a called function like this one — so a `$:` that calls
		// pickupLaterGroupFor isn't reliably ordered after liveGroups' own assignment, and can
		// run while it is still undefined (seen as "Cannot read properties of undefined
		// (reading 'find')" during the very first component init / after an HMR remount).
		return (liveGroups ?? []).find(
			(g) =>
				g.kind === DeliveryGroupKind.PickupLater &&
				(g.pickupStoreId ?? pickupStoreId) === (targetPickupStoreId ?? pickupStoreId)
		);
	}
	// Only meaningful (and only ever rendered) while isSingleBucket is true — there is then
	// exactly one รับภายหลัง group in the whole cart, so the sale's own default target
	// unambiguously IS that one group.
	$: singlePickupLaterGroup = pickupLaterGroupFor(undefined);
	// Single-bucket "วันที่และเวลารับสินค้า" row commits straight to the group on change —
	// unlike the multi-pile drawer's draft+save+ยกเลิก flow, there's only one รับภายหลัง group
	// to begin with here, so there is nothing a cashier backing out could leave half-written.
	$: quickPickupDateTimeValue = buildPickupDateTime(
		singlePickupLaterGroup?.pickupDate ?? '',
		singlePickupLaterGroup?.pickupTimeSlot ?? ''
	);
	function onQuickPickupDateTimeChange(e: CustomEvent<{ value?: Date }>) {
		// Same `detail.value` (not `valueFrom`) key as onDraftPickupDateChange above.
		const picked = e.detail?.value;
		const group = singlePickupLaterGroup;
		if (!group) return;
		updateDeliveryGroup(group.id, {
			pickupDate: picked ? formatDateToIsoLocal(picked) : undefined,
			pickupTimeSlot: picked ? formatTimeSlotLocal(picked) : undefined
		});
	}

	// pickupStoreId/addressId default to undefined so every existing caller (basic mode's own
	// inline cards, all of which only ever have the sale's own default pile) is unaffected —
	// only a "เพิ่มตัวเลือกรับสินค้า" pile's own settings button passes a specific one.
	function openEditingKind(kind: DeliveryGroupKind, pickupStoreId?: string, addressId?: string) {
		// A still-open "เพิ่มตัวเลือกรับสินค้า" menu floats right above this same field block —
		// left open, its own absolute-positioned list renders over whatever opens next (the
		// settings drawer below, or the pile list beneath it), stacking two unrelated floating
		// panels on screen at once. Every surface that can open from here closes it first so
		// at most one floating panel is ever showing.
		showPileMenu = false;
		if (kind === DeliveryGroupKind.Shipping) {
			editingAddressId = addressId;
			const group = shippingGroupFor(addressId);
			draftShippingType = group?.shippingType ?? ShippingType.Standard;
			draftMethod = group?.method ?? 'unknown';
			draftVehicleType = group?.vehicleType ?? 'unknown';
			draftFee = group?.shippingFee !== undefined ? String(group.shippingFee) : '';
		} else if (kind === DeliveryGroupKind.OnSite) {
			draftTravelFee = onSiteGroup?.shippingFee !== undefined ? String(onSiteGroup.shippingFee) : '';
			draftOnSiteLocation = onSiteGroup?.onSiteLocation;
			draftOnSiteStoreId = onSiteGroup?.onSiteStoreId ?? '';
		} else if (kind === DeliveryGroupKind.PickupLater) {
			editingPickupStoreId = pickupStoreId;
			const group = pickupLaterGroupFor(pickupStoreId);
			draftPickupDate = group?.pickupDate ?? '';
			draftPickupTimeSlot = group?.pickupTimeSlot ?? '';
		}
		editingKind = kind;
	}

	function onSelectDraftShippingType(type: ShippingType) {
		draftShippingType = type;
		draftMethod = 'unknown';
		draftVehicleType = 'unknown';
	}

	function onDraftFeeInput(e: Event) {
		draftFee = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
		(e.target as HTMLInputElement).value = draftFee;
	}

	function onDraftTravelFeeInput(e: Event) {
		draftTravelFee = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
		(e.target as HTMLInputElement).value = draftTravelFee;
	}

	// Mirrors DrawerDelivery.svelte's own renderOptions — CustomFancyRadioGroup renders
	// each option through IconLabel so the courier logo sits beside its label.
	const renderDeliveryOptions = (items: DeliveryOption[]) =>
		items.map(({ value, label, icon }) => ({
			value,
			label: IconLabel,
			labelProps: { label, icon }
		}));

	function saveFulfilmentSettings() {
		if (editingKind === DeliveryGroupKind.Shipping) {
			const group = shippingGroupFor(editingAddressId);
			if (group) {
				updateDeliveryGroup(group.id, {
					courier: 'Seller Owned Fleet',
					method: draftMethod,
					shippingType: draftShippingType,
					// Frontend-only field (see DeliveryGroup.vehicleType) — only meaningful for
					// Same Day, dropped back to undefined otherwise so a stale pick from a
					// previous Same Day selection can't silently survive a switch to Standard.
					vehicleType:
						draftShippingType === ShippingType.SameDay && draftVehicleType !== 'unknown'
							? draftVehicleType
							: undefined,
					shippingFee: draftFee === '' ? undefined : Number(draftFee) || 0
				});
			}
		} else if (editingKind === DeliveryGroupKind.OnSite && onSiteGroup) {
			updateDeliveryGroup(onSiteGroup.id, {
				shippingFee: draftTravelFee === '' ? undefined : Number(draftTravelFee) || 0,
				onSiteLocation: draftOnSiteLocation,
				onSiteStoreId: draftOnSiteLocation === 'store' ? draftOnSiteStoreId || undefined : undefined
			});
		} else if (editingKind === DeliveryGroupKind.PickupLater) {
			const group = pickupLaterGroupFor(editingPickupStoreId);
			if (group) {
				updateDeliveryGroup(group.id, {
					pickupDate: draftPickupDate || undefined,
					pickupTimeSlot: draftPickupTimeSlot || undefined
				});
			}
		}
		editingKind = undefined;
		editingPickupStoreId = undefined;
		editingAddressId = undefined;
	}
	$: itemsOfKind = (kind: DeliveryGroupKind): TCartItem[] => {
		const ids = new Set(liveGroups.filter((g) => g.kind === kind).flatMap((g) => g.itemIds));
		return liveGroups.length > 0 ? (cartList ?? []).filter((i) => !!i.lineId && ids.has(i.lineId)) : cartList ?? [];
	};
	// Labels only ("หลายรูปแบบ (N หมวด)"): a pile the cashier just opened via
	// "+เพิ่มตัวเลือกรับสินค้า" counts the moment it exists, before any item is moved in.
	$: labelKinds = Array.from(
		new Set([...displayKinds, ...(isOnline ? onlineOpenPiles : $openFulfilmentPiles).map((p) => p.kind)])
	);
	$: isMultiFulfilment = labelKinds.length > 1;
	$: hasShip = presentKinds.includes(DeliveryGroupKind.Shipping);
	$: hasOnSite = presentKinds.includes(DeliveryGroupKind.OnSite);
	$: hasPickupLater = presentKinds.includes(DeliveryGroupKind.PickupLater);
	$: hasPickupInStore = presentKinds.includes(DeliveryGroupKind.PickupInStore);
	$: hasDigital = presentKinds.includes(DeliveryGroupKind.Digital);
	// Online now legally opens the same 3 piles POS does minus รับทันที (รับภายหลัง/จัดส่ง/
	// ให้บริการ — PO brief), not Shipping-only any more — but switching channel deliberately
	// preserves $openFulfilmentPiles/$activeFulfilmentPile across tabs (see onSelectChannel's
	// own comment), so a POS รับทันที/digital pile left open before switching to ออนไลน์ must
	// never resurface here just because CartFulfilmentPiles is handed the same raw stores.
	// Same exclusion pileTypeOptions' own online filter uses, for the same reason.
	$: onlineOpenPiles = $openFulfilmentPiles.filter(
		(p) => p.kind !== DeliveryGroupKind.PickupInStore && p.kind !== DeliveryGroupKind.Digital
	);
	$: onlineActivePile =
		$activeFulfilmentPile &&
		$activeFulfilmentPile.kind !== DeliveryGroupKind.PickupInStore &&
		$activeFulfilmentPile.kind !== DeliveryGroupKind.Digital
			? $activeFulfilmentPile
			: undefined;
	// True the moment 2+ Shipping piles exist, regardless of channel — POS's own
	// "เพิ่มตัวเลือกรับสินค้า" → "จัดส่งจากหน้าร้าน" reaches this exactly the same way online's
	// "จัดส่งหลายที่อยู่" button does (same shippingBucketCount, same openAddShippingPile).
	// A single buyer.address field can't speak for N per-pile addresses any more once this
	// is true, so the inline address row under ลูกค้า hides for BOTH channels then (see
	// needsAddress's own use of this below) — only the online-only payment-drawer
	// relocation further below stays gated on `isOnline &&` as well, since POS never shows
	// a payment picker here regardless.
	$: hasMultiAddressShipping = shippingBucketCount > 1;
	// Whoever needs a delivery destination — POS ShopDelivery/OnSite, any online sale
	// (always ships), or a Link Bill (sent to a customer who isn't in the shop) — picks
	// it in the same ลูกค้าและที่อยู่จัดส่ง drawer, named once here so the trigger prop and
	// the inline address row below never drift apart.
	$: needsAddress = hasShip || hasOnSite || isLinkBill;
	// The sale's own DEFAULT Shipping group (addressGroupSeq 1) — used by the single-kind
	// inline card, which only ever shows when exactly one Shipping bucket exists (so it IS
	// this one). A second (third, ...) "เพิ่มตัวเลือกรับสินค้า" pile's own group is resolved
	// per-pile via shippingGroupFor instead (see onEditPile/openEditingKind).
	$: shippingGroup = liveGroups.find(
		(g) => g.kind === DeliveryGroupKind.Shipping && g.addressGroupSeq === 1
	);
	$: onSiteGroup = liveGroups.find((g) => g.kind === DeliveryGroupKind.OnSite);
	$: digitalGroup = liveGroups.find((g) => g.kind === DeliveryGroupKind.Digital);
	// Resolves the specific Shipping pile's own group — mirrors pickupLaterGroupFor exactly.
	// undefined targetAddressId means the sale's own default (seq 1) pile; a real address id
	// means a "เพิ่มตัวเลือกรับสินค้า" pile's own group, matched by its own recipientAddressId
	// (see syncBasicGroups' shippingBuckets).
	function shippingGroupFor(targetAddressId: string | undefined): DeliveryGroup | undefined {
		// Same liveGroups-ordering hazard as pickupLaterGroupFor above — guard it the same way.
		return (liveGroups ?? []).find(
			(g) =>
				g.kind === DeliveryGroupKind.Shipping &&
				(targetAddressId ? g.recipientAddressId === targetAddressId : g.addressGroupSeq === 1)
		);
	}
	// The settings drawer always edits ONE concrete branch's own รับภายหลัง group — see
	// pickupLaterGroupFor.
	$: editingPickupLaterGroup = pickupLaterGroupFor(editingPickupStoreId);
	$: editingPickupBranch = branches.find(
		(b) => b.id === (editingPickupLaterGroup?.pickupStoreId ?? pickupStoreId)
	);
	$: isBasicMarketplaceShip = !!shippingGroup?.method && shippingGroup.method === 'platform';
	// Shopee/Lazada/LINE SHOPPING/TikTok Shop own both delivery AND payment for an order
	// placed through them — the cashier never picks either, same as the shipping method
	// already auto-resolving to 'platform' for these channels (see syncBasicGroups).
	// paymentMethods carries one entry per marketplace whose value matches the channel.
	$: if (isOnline && isMarketplaceChannel(subChannel) && $orderData.paymentType !== subChannel) {
		setPaymentType(subChannel);
	} else if (
		isOnline &&
		!isMarketplaceChannel(subChannel) &&
		isMarketplaceChannel($orderData.paymentType)
	) {
		// Switched away from a marketplace sub-channel — a payment type left over from it
		// (e.g. 'shopee') no longer describes anything on THIS channel, so it must not
		// stick around looking like a real, cashier-picked choice.
		setPaymentType('unknown');
	}

	// CartFooter's pay gate. presentKinds already falls back to [physicalKindFor(...)]
	// when $deliveryGroups is empty (multi-parcel flag off, or a walk-in zero-cost
	// sale), so hasShip/hasOnSite/hasPickupLater below already equal today's plain
	// fullfilmentType-based rule in that case — no separate fallback branch needed.
	// Named for the buyer check it started as, but doubles as this sale's whole
	// "fulfilment info complete enough to pay" gate now — the single-bucket counterpart
	// of isGroupFulfilmentComplete below, since isSingleBucket means showDeliveryDetail is
	// false and CartFooter's own $deliverySummary.missing check never runs at all. A
	// Shipping/OnSite fee left blank is NOT required — it's just ฿0 — so it's never checked
	// here, same as isGroupFulfilmentComplete itself.
	// OnSite has no default location any more (see DeliveryGroup.onSiteLocation's own
	// comment) — ready only once the cashier has explicitly picked 'store' (with a branch)
	// or 'customer' (with a real address); undefined is simply not ready yet.
	$: onSiteReady =
		onSiteGroup?.onSiteLocation === 'store'
			? !!onSiteGroup?.onSiteStoreId
			: onSiteGroup?.onSiteLocation === 'customer'
				? !!buyer?.address
				: false;
	// "ไม่ระบุ" is a real row in standardDeliveries/sameDayDeliveries (value 'unknown'), not
	// a placeholder — once the cashier has opened ข้อมูลการจัดส่ง and picked it, the field is
	// answered same as any real courier would be. Only a group nobody has touched yet
	// (shippingGroup?.method still undefined) counts as missing — matches
	// isGroupFulfilmentComplete's own rule for the multi-bucket case.
	$: footerIsBuyerValid =
		hasShip || hasOnSite
			? !!buyer?.name &&
				(!hasShip || (!!buyer?.address && !!shippingGroup?.method)) &&
				(!hasOnSite || onSiteReady)
			: customerRequired
				? !!buyer?.name
				: true;
	$: footerIsDeliveryLater = hasShip || hasOnSite || hasPickupLater;
	// Single-bucket required-field flags — drive the red asterisk + error-styled trigger on
	// ข้อมูลการจัดส่ง/ข้อมูลการจัดส่ง(OnSite) below, the visual half of the same gate
	// footerIsBuyerValid enforces.
	$: shipInfoMissing = hasShip && !shippingGroup?.method;
	$: onSiteInfoMissing = hasOnSite && !onSiteReady;
	$: footerPickupStoreId = hasPickupLater ? pickupStoreId : '';

	// A thing handed across the counter has no address, no fee and no tracking — calling
	// it a พัสดุ would be a lie, so the handover pile is reported as pieces instead.
	$: handoverQty = $deliverySummary.handoverGroup
		? handoverItemQty($deliverySummary.handoverGroup, cartList ?? [])
		: 0;
	// The phrase from the approved prototype's fulfilment selector, shown as a derived
	// state rather than as a fourth fulfilment option a cashier would have to choose
	// before knowing which lines even ended up in stock.
	$: isMixedReceive = allowPartialReceive && handoverQty > 0 && $deliverySummary.parcelCount > 0;

	// The sale channel is a field of the order (saleChannel.type), not navigation
	// between views, so it is presented as a two-option segmented choice.
	// Short labels on purpose: three segments share 358px, so each has ~115px and the
	// label has to fit beside its icon at 13px.
	const channels = [
		{ value: SaleChannelUI.Pos, label: 'POS', icon: 'outline-building-storefront' },
		{ value: SaleChannelUI.Online, label: 'ออนไลน์', icon: 'outline-globe-alt' },
		{ value: SaleChannelUI.LinkBill, label: 'ลิงก์', icon: 'outline-link' }
	];
	let addresses: Address[] = [];
	let idAddress: string = '';

	function getLabelFromValue(
		value?: string,
		group:
			| 'salesChannels'
			| 'paymentMethods'
			| 'standardDeliveries'
			| 'sameDayDeliveries'
			| 'all' = 'all'
	): string {
		if (!value) return 'ไม่ระบุ';

		const groupsMap = {
			salesChannels,
			paymentMethods,
			standardDeliveries,
			sameDayDeliveries,
			all: [...salesChannels, ...paymentMethods, ...standardDeliveries, ...sameDayDeliveries]
		};

		const options = groupsMap[group] || groupsMap.all;

		const found = options.find((opt) => opt.value === value);
		return found?.label?.replace(/<br\s*\/?>/gi, ' ') ?? value;
	}

	const setAddress = (ad: Address[]) => {
		addresses = ad;
	};

	// Changing the fulfilment method is a field edit and nothing more. It used to
	// also switch tab and wipe the draft order, because the dropdown sat inside the
	// offline tab button and every option click bubbled into the tab's handler.
	const handleSelectOption = (option: string) => {
		// Same reasoning as openEditingKind — this field's own "เพิ่มตัวเลือกรับสินค้า" menu
		// floats right beside it, so picking from THIS dropdown must close that one too.
		showPileMenu = false;
		fullfilmentType = option;
		// saleOrigin carries the fulfilment type for offline sales and the sales
		// channel (line/facebook/…) for online ones, so pin the type when writing a
		// fulfilment value into it.
		setSalesChannel({
			...$orderData.saleChannel,
			saleOrigin: option,
			type: SaleChannelType.Offline
		});
		// This dropdown is now the default for every PHYSICAL line, not just the sale as a
		// whole — any per-line pick the cashier made earlier (B3's "move the machine to
		// จัดส่ง") must follow the new default too, same as switching ShopDelivery back to
		// PickupImmediate already resets the old receiveMode-based override.
		ResetPhysicalLineFulfilment();
		// Digital is the one kind here with nothing of its own to show until a bucket
		// actually exists — PickupImmediate/PickupLater/ShopDelivery/OnSite all have an
		// inline settings row or a pile section the moment they're the sale's kind, but an
		// empty cart (or one with no digital item yet) has no Digital group for the cart to
		// render at all (syncDeliveryGroups only ever builds one FROM an actual digital
		// line). Picking this row is the cashier declaring "this sale is for a digital
		// product" ahead of adding one, so open the same empty, droppable Digital pile
		// "เพิ่มตัวเลือกรับสินค้า" would — same call onSelectPileType's own Digital branch
		// makes — so the cart reads as ready for one immediately, not just once a digital
		// product happens to land in it.
		if (
			option === FullfilmentType.DigitalDelivery &&
			!presentKinds.includes(DeliveryGroupKind.Digital) &&
			!hasOpenPile(DeliveryGroupKind.Digital)
		) {
			addOpenFulfilmentPile({ kind: DeliveryGroupKind.Digital });
			setActiveFulfilmentPile({ kind: DeliveryGroupKind.Digital });
		}
	};

	// Switching channel changes which customer flow applies, so the draft order is
	// reset — explicitly here, instead of through a reactive statement on
	// the channel that also fired on those bubbled dropdown clicks.
	const onSelectChannel = (next: SaleChannelUI) => {
		if (channel === next) return;
		channel = next;
		// Per spec: switching channel resets fulfilment, payment and sub-channel to that
		// channel's defaults — initializeOrderState() already clears payment + buyer, but
		// per the user's explicit request existing delivery groups/cart items now survive
		// a channel switch. Known tradeoff: resetBuyer() still clears the buyer, so a
		// preserved group's recipientName/recipientAddress may now point at a buyer that
		// no longer exists on the sale — not fixed here, out of scope.
		initializeOrderState(true);
		// Online's own default is "จัดส่ง" (ShopDelivery) — it never had a รับทันที option to
		// begin with (no counter to hand anything over at for an online sale), so falling
		// back to PickupImmediate here would pick a row that isn't even in online's own
		// fullfilmentOptions list.
		fullfilmentType =
			next === SaleChannelUI.Online ? FullfilmentType.ShopDelivery : FullfilmentType.PickupImmediate;
		subChannel = next === SaleChannelUI.Online ? DEFAULT_SUB_CHANNEL : '';
		setSalesChannel({
			...$orderData.saleChannel,
			saleOrigin: next === SaleChannelUI.Online ? subChannel : FullfilmentType.PickupImmediate,
			type: saleChannelToPayload(next)
		});
	};

	// A sale actually ENDING (order created, or the cashier hits "ล้างตะกร้า") — not just a
	// cart that happens to pass through zero items while mid-edit — is what resets the
	// system back to its own default for the NEXT sale: POS + รับทันที. clearOrderMeta
	// (called by CartFooter's own clearData) already resets $orderData.saleChannel itself;
	// this is the other half, for Cart.svelte's own local channel/fullfilmentType/subChannel
	// that nothing else was reading that reset back into.
	function resetSaleDefaults() {
		channel = SaleChannelUI.Pos;
		fullfilmentType = FullfilmentType.PickupImmediate;
		subChannel = '';
	}

	// saleOrigin carries the sub-channel for an online sale — the same field the online
	// drawer writes, so both controls stay in agreement.
	const onSelectSubChannel = (value: string) => {
		subChannel = value;
		setSalesChannel({
			...$orderData.saleChannel,
			saleOrigin: value,
			type: SaleChannelType.Online
		});
	};

	// ssk-tab-button renders a plain <div> with no role and no tabindex, so the
	// roving-tabindex behaviour a segmented control needs lives here: arrows wrap
	// around and select as they move, Enter/Space select the focused option. Shared
	// by both segmented controls.
	const rovingTarget = (
		event: KeyboardEvent,
		index: number,
		length: number
	): number | undefined => {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') return (index + 1) % length;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') return (index - 1 + length) % length;
		if (event.key === 'Enter' || event.key === ' ') return index;
		return undefined;
	};

	const focusOption = (from: HTMLElement, index: number) => {
		from.parentElement?.querySelectorAll<HTMLElement>('ssk-tab-button')[index]?.focus();
	};

	// Curried so the template can pass the index without annotating the event —
	// type annotations inside markup expressions do not parse.
	const onChannelKeydown = (index: number) => (event: KeyboardEvent) => {
		const next = rovingTarget(event, index, channels.length);
		if (next === undefined) return;

		event.preventDefault();
		const target = channels[next]?.value;
		if (target) onSelectChannel(target);
		focusOption(event.currentTarget as HTMLElement, next);
	};

	const onFullfilmentKeydown = (index: number) => (event: KeyboardEvent) => {
		const next = rovingTarget(event, index, fullfilmentOptions.length);
		if (next === undefined) return;

		event.preventDefault();
		handleSelectOption(fullfilmentOptions[next]);
		focusOption(event.currentTarget as HTMLElement, next);
	};

	cartListInfo.subscribe((c) => {
		cartList = c.data;
		total = c.totalPrice;
		discount = c.discount.value;
		summary = c.summaryPrice;
	});

	function toggleDrawerCustomer() {
		showPileMenu = false;
		showDrawerCustomer = !showDrawerCustomer;
		if (!showDrawerCustomer && settingsReturn) {
			editingKind = settingsReturn.kind;
			editingPickupStoreId = settingsReturn.pickupStoreId;
			editingAddressId = settingsReturn.addressId;
			settingsReturn = undefined;
		}
	}

	// Both panel rows lead to the same drawer; the row only says which half was asked for.
	function openCustomerDrawer(half: 'customer' | 'address') {
		showPileMenu = false;
		customerDrawerOpenOn = half;
		showDrawerCustomer = true;
	}

	// InlineContactEdit's own onSaved — the backend write already happened there (Customer
	// Book v2); this just keeps the order's local `buyer` (PartyInfo) copy in step with it.
	// A named function, not an inline arrow capturing `buyer` directly: TS doesn't narrow a
	// closure's capture of an outer `let` by the template's surrounding {#if buyer?.refId},
	// only a real guard inside the function body itself does.
	function saveBuyerEmail(email: string) {
		if (!buyer) return;
		buyer = { ...buyer, email };
	}

	const onClickSelectCustomer = async (c: Customer) => {
		if (!c.firstName || !c.lastName) return;

		const defaultAddress = c.addresses?.find((addr) => addr.isDefault);
		const countryCode = defaultAddress?.country?.iso;
		const countryName =
			countryCode && $countriesList.data
				? $countriesList.data.find((ct) => ct.iso === countryCode)?.name ?? countryCode
				: undefined;

		const addressString = defaultAddress
			? customerAddressToString(defaultAddress, countryName ?? '')
			: '';

		if (buyer) {
			buyer = setPartyInfoToOrder(c, addressString);
			setAddress(c.addresses ?? []);
			// A new customer invalidates the address picked for the previous one.
			idAddress = defaultAddress?.id ? String(defaultAddress.id) : '';
		}
	};

	// preserveDeliveryGroups = true (channel switch) keeps existing groups/cart items on
	// screen per the user's explicit request; false (remove-customer, onMount) keeps
	// today's behaviour — a removed customer genuinely invalidates recipient-bound groups.
	function initializeOrderState(preserveDeliveryGroups = false) {
		resetBuyer();
		clearOrderMeta();
		if (!preserveDeliveryGroups) {
			resetDeliveryGroups();
		}
	}

	// "เพิ่มตัวเลือกรับสินค้า" — the 4 piles a cashier can open beside whatever's already in
	// the cart. Opening one just adds an empty section to the list (openFulfilmentPiles in
	// $stores/cart/cart) — items land in it by dragging them there (see
	// CartFulfilmentPiles.svelte), not by tapping the catalog into an "active" pile.
	// รับทันที can only ever exist once (the counter needs no second copy of itself);
	// ให้บริการนอกสถานที่ is always offered here — the actual "service items only" rule is
	// enforced where a line's legal kinds are decided at all (lineFulfilmentOptions), the
	// same place the old per-line dropdown read it from.
	$: hasOpenPile = (kind: DeliveryGroupKind) => $openFulfilmentPiles.some((p) => p.kind === kind);
	// Online only offers 3 of these (PO brief): no rับทันที (no counter to hand anything
	// over at online) and no digital pile (a digital line already gets its own group
	// automatically regardless of what's opened here, same reasoning fullfilmentOptions'
	// own online gate above uses).
	$: pileTypeOptionsAll = [
		{
			kind: DeliveryGroupKind.PickupInStore,
			label: 'รับทันที',
			hint: 'รับสินค้าไปเลย',
			icon: 'outline-shopping-bag',
			disabled: presentKinds.includes(DeliveryGroupKind.PickupInStore) || hasOpenPile(DeliveryGroupKind.PickupInStore)
		},
		{
			kind: DeliveryGroupKind.PickupLater,
			label: 'รับภายหลัง',
			hint: 'ลูกค้ามารับภายหลัง',
			icon: 'outline-clock',
			disabled: pickupLaterBranchOptions.length === 0
		},
		{
			kind: DeliveryGroupKind.Shipping,
			label: 'จัดส่งจากหน้าร้าน',
			hint: hasShip
				? shippingAddressOptions.length === 0
					? 'ลูกค้าไม่มีที่อยู่อื่นให้เลือก'
					: 'จัดส่งไปอีกที่อยู่หนึ่ง'
				: 'ร้านจัดส่งให้ลูกค้า',
			icon: 'outline-truck',
			// Once a Shipping pile already exists, a second one is about PICKING a different
			// address, not about there being room for another plain pile — same reasoning
			// pickupLaterBranchOptions.length === 0 already uses for PickupLater below.
			disabled: hasShip ? shippingAddressOptions.length === 0 : hasOpenPile(DeliveryGroupKind.Shipping)
		},
		{
			kind: DeliveryGroupKind.OnSite,
			// Same "ให้บริการ" wording as fullfilmentMeta/groupKindLabel — this hint still names
			// the add-pile eligibility rule (service-type items only), not the location choice,
			// so it stays separate from groupKindHint's own "เลือกได้ทั้งที่ร้านและนอกสถานที่".
			label: 'ให้บริการ',
			hint: 'เฉพาะสินค้าประเภทบริการ',
			icon: 'outline-wrench-screwdriver',
			disabled: presentKinds.includes(DeliveryGroupKind.OnSite) || hasOpenPile(DeliveryGroupKind.OnSite)
		},
		{
			kind: DeliveryGroupKind.Digital,
			label: 'จัดส่งเข้าระบบ (ดิจิทัล)',
			hint: 'เฉพาะสินค้าประเภทดิจิทัล',
			icon: 'outline-bolt',
			// Same single-instance rule as รับทันที above — Digital can never have more than
			// one bucket (see needsDigitalContact's own comment), so a second pile would have
			// nothing of its own to collect that the first one doesn't already.
			disabled: presentKinds.includes(DeliveryGroupKind.Digital) || hasOpenPile(DeliveryGroupKind.Digital)
		}
	];
	$: pileTypeOptions = isOnline
		? pileTypeOptionsAll.filter(({ kind }) => kind !== DeliveryGroupKind.PickupInStore)
		: pileTypeOptionsAll;
	$: pileMenuOptions = pileTypeOptions.map((option) => ({ ...option, value: option.kind }));

	// Every branch a รับภายหลัง pile already open is using — a new one must pick a
	// DIFFERENT branch, never one already collecting for this sale. Checked against both
	// items actually in a รับภายหลัง pile AND piles opened but still empty (openFulfilmentPiles)
	// — otherwise two empty piles for the same branch could be opened back to back.
	$: usedPickupLaterBranchIds = new Set([
		...itemsOfKind(DeliveryGroupKind.PickupLater).map((i) => i.linePickupStoreId ?? pickupStoreId),
		...$openFulfilmentPiles
			.filter((p) => p.kind === DeliveryGroupKind.PickupLater)
			.map((p) => p.pickupStoreId ?? pickupStoreId)
	]);
	$: pickupLaterBranchOptions = branches.filter((b) => !!b.id && !usedPickupLaterBranchIds.has(b.id));
	let showAddPileBranchModal = false;

	// Every address a Shipping pile already open is using — a new one must pick a DIFFERENT
	// address, never one already shipping for this sale. Same shape as
	// usedPickupLaterBranchIds above: checked against both items actually in a Shipping pile
	// AND piles opened but still empty. idAddress (the sale's own default address, every
	// line with no override of its own falls back to it) also counts as "in use" — without
	// it here, the base pile's own address was still offered again as if it were free,
	// since no line in that pile ever carries lineAddressId as an explicit override.
	$: usedShippingAddressIds = new Set(
		[
			idAddress,
			...itemsOfKind(DeliveryGroupKind.Shipping).map((i) => i.lineAddressId),
			...$openFulfilmentPiles
				.filter((p) => p.kind === DeliveryGroupKind.Shipping)
				.map((p) => p.addressId)
		].filter((id): id is string => !!id)
	);
	// undefined while picking a brand NEW pile's address (every used address is excluded);
	// set to the pile's CURRENT address while re-picking an existing one from its own
	// settings drawer (that address stays selectable for itself).
	let pileAddressPickerTarget: string | undefined;
	$: shippingAddressOptions = addresses.filter(
		(a) =>
			!!a.id &&
			(!usedShippingAddressIds.has(String(a.id)) || String(a.id) === pileAddressPickerTarget)
	);
	let showPileAddressModal = false;

	function openAddShippingPile() {
		showPileMenu = false;
		pileAddressPickerTarget = undefined;
		if (shippingAddressOptions.length === 0) {
			toastStore.addToast({
				message: 'ลูกค้าไม่มีที่อยู่อื่นให้เลือก — เพิ่มที่อยู่ใหม่ในโปรไฟล์ลูกค้าก่อน',
				type: 'error',
				timeout: 5000,
				testId: 'sales.pile.address.none'
			});
			return;
		}
		showPileAddressModal = true;
	}

	function onSelectPileAddress(address: Address) {
		const addressId = String(address.id);
		const isNewPile = pileAddressPickerTarget === undefined;
		// Defensive — the picker's own list is already filtered to exclude every address in
		// use (see shippingAddressOptions), so this only ever fires if something outside this
		// flow changed the cart mid-pick.
		if (isNewPile && usedShippingAddressIds.has(addressId)) {
			toastStore.addToast({
				message: 'ที่อยู่นี้ถูกใช้โดยพัสดุอื่นอยู่แล้ว — เลือกที่อยู่อื่น',
				type: 'error',
				timeout: 5000,
				testId: 'sales.pile.address.duplicate'
			});
			return;
		}
		if (isNewPile) {
			addOpenFulfilmentPile({ kind: DeliveryGroupKind.Shipping, addressId });
			setActiveFulfilmentPile({ kind: DeliveryGroupKind.Shipping, addressId });
		} else {
			// Re-stamp every line currently in this pile onto the newly picked address — same
			// pattern onSelectPickupBranch uses for a รับภายหลัง pile's own branch.
			const previousAddressId = pileAddressPickerTarget;
			itemsOfKind(DeliveryGroupKind.Shipping).forEach((item) => {
				if (item.lineId && (item.lineAddressId ?? '') === (previousAddressId ?? '')) {
					SetCartItemAddressId(item.lineId, addressId);
				}
			});
			editingAddressId = addressId;
		}
		showPileAddressModal = false;
	}
	// A plain ghost button + floating menu (not ssk-dropdown), closed on an outside click,
	// same pattern CartItem.svelte's own per-line fulfilment menu uses.
	let showPileMenu = false;
	let pileMenuWrapEl: HTMLElement | undefined;

	function onWindowClickForPileMenu(e: MouseEvent) {
		if (!showPileMenu) return;
		if (pileMenuWrapEl && !pileMenuWrapEl.contains(e.target as Node)) showPileMenu = false;
	}

	// Opening a pile also makes it the active one — the cashier just asked for it, so the
	// next product they tap should land there without an extra drag (see
	// activeFulfilmentPile in $stores/cart/cart). The section itself shows which pile is
	// active; clicking any pile's header (including this new one, or back to the default)
	// switches it — see CartFulfilmentPiles' own onSetActivePile.
	function onSelectPileType(kind: DeliveryGroupKind) {
		if (kind === DeliveryGroupKind.PickupInStore) {
			if (presentKinds.includes(DeliveryGroupKind.PickupInStore)) return;
			addOpenFulfilmentPile({ kind });
			setActiveFulfilmentPile({ kind });
		} else if (kind === DeliveryGroupKind.Shipping) {
			// A second "จัดส่งจากหน้าร้าน" pile isn't a plain fulfilment pile at all — it's a
			// second ADDRESS, picked from the customer's own address book (see
			// openAddShippingPile), the same way a second รับภายหลัง pile picks its own branch.
			if (hasShip) {
				openAddShippingPile();
			} else {
				addOpenFulfilmentPile({ kind });
				setActiveFulfilmentPile({ kind });
			}
		} else if (kind === DeliveryGroupKind.PickupLater) {
			if (pickupLaterBranchOptions.length > 0) showAddPileBranchModal = true;
		} else {
			addOpenFulfilmentPile({ kind });
			setActiveFulfilmentPile({ kind });
		}
	}

	function onSelectAddPileBranch(branch: Store) {
		addOpenFulfilmentPile({ kind: DeliveryGroupKind.PickupLater, pickupStoreId: branch.id });
		setActiveFulfilmentPile({ kind: DeliveryGroupKind.PickupLater, pickupStoreId: branch.id });
		showAddPileBranchModal = false;
	}

	// Clicking a pile's own header switches the tap target to (or away from) it — the
	// cashier doesn't have to re-open "เพิ่มตัวเลือกรับสินค้า" just to go back to a pile
	// that already exists, or to return to the ordinary default line.
	function onSetActivePile(
		pile: { kind: string; pickupStoreId?: string; addressId?: string } | undefined
	) {
		const active = $activeFulfilmentPile;
		const isSamePile =
			!!pile &&
			!!active &&
			active.kind === pile.kind &&
			active.pickupStoreId === pile.pickupStoreId &&
			(active.addressId ?? '') === (pile.addressId ?? '');
		setActiveFulfilmentPile(isSamePile ? undefined : pile);
	}

	const onClickRemoveCustomer = () => {
		initializeOrderState();
		// clearOrderMeta() puts saleOrigin back to pickupImmediate; fullfilmentType is a
		// separate binding, so without this the panel keeps asking for a delivery address
		// for an order that is no longer a delivery.
		fullfilmentType = FullfilmentType.PickupImmediate;
	};

	const onClickSelectAddress = (address: Address) => {
		if (!buyer) return;

		const addressString = customerAddressToString(
			address,
			$countriesList.data?.find((c) => c.iso === address.country?.iso)?.name ??
				address.country?.name ??
				''
		);
		buyer.address = addressString;
	};

	// ให้บริการนอกสถานที่'s own inline address card picker (see draftOnSiteLocation ===
	// 'customer' above) picks from the SAME single sale-wide address as Shipping — OnSite
	// has no per-group address override of its own — so this just does what
	// DrawerCustomerAddress's own pickAddress does: move idAddress and refresh buyer.address.
	function onSelectOnSiteAddress(address: Address) {
		idAddress = String(address.id);
		onClickSelectAddress(address);
	}

	const resetBuyer = () => {
		buyer = newPartyInfo();
		addresses = [];
		idAddress = '';
	};

	onMount(() => {
		initializeOrderState();
		GetExistingCart();
	});

	afterUpdate(() => {
		total = calculateTotalPrice(cartList);
		calculateSummary(total, discount);
	});
</script>

<svelte:window on:click={onWindowClickForPileMenu} />

<ssk-drawer
	width="min(30rem, 100vw)"
	side="right"
	show={!!editingKind}
	bodypadding="20px"
	on:close={() => {
		editingKind = undefined;
		editingPickupStoreId = undefined;
		editingAddressId = undefined;
	}}
>
	<ssk-drawer-header
		slot="header"
		title={editingKind
				? `ตั้งค่า${basicCategoryLabel(editingKind)}`
				: ''}
		close={() => {
			editingKind = undefined;
			editingPickupStoreId = undefined;
			editingAddressId = undefined;
		}}
	/>
	<div class="settings-body" slot="body">
				{#if editingKind === DeliveryGroupKind.Shipping && editingAddressId}
					<!-- A "เพิ่มตัวเลือกรับสินค้า" Shipping pile ships to its OWN address, picked from
					     the customer's address book — not the sale's shared customer drawer, which
					     only ever holds the ONE default address every other pile falls back to. -->
					{@const pileAddress = addresses.find((a) => String(a.id) === editingAddressId)}
					<button
						type="button"
						class="pile-row"
						on:click={() => {
							pileAddressPickerTarget = editingAddressId;
							showPileAddressModal = true;
						}}
						data-testid="sales.pile.shipping.address"
					>
						<ssk-icon name="outline-map-pin" size="xs" themeColor="primary"></ssk-icon>
						<span class="pile-row-label">ส่งไปที่</span>
						<span class="pile-row-value">
							{pileAddress ? addressToDisplay(pileAddress) : 'เลือกที่อยู่จัดส่ง'}
						</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				{:else if editingKind === DeliveryGroupKind.Shipping}
					<button
						type="button"
						class="pile-row"
						class:warn={!selectedAddress}
						on:click={() => openCustomerFromSettings(buyer?.name ? 'address' : 'customer')}
						data-testid={`sales.pile.${editingKind}.address`}
					>
						<ssk-icon name="outline-map-pin" size="xs" themeColor={selectedAddress ? 'primary' : 'error'}></ssk-icon>
						<span class="pile-row-label">ส่งไปที่</span>
						<span class="pile-row-value">
							{selectedAddress ? addressToDisplay(selectedAddress) : 'ยังไม่มีที่อยู่ลูกค้า — เพิ่มที่อยู่'}
						</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				{:else if editingKind === DeliveryGroupKind.OnSite}
					<!-- A service item isn't always done at the customer's own address — staff
					     can just as well have the customer come to the store instead, same choice
					     a product sale already gets (รับทันที vs จัดส่งให้ลูกค้า). -->
					<div class="inline-settings">
						<span class="field-label">รับบริการที่</span>
						<ssk-tab-header
							class="tabs"
							variant="button"
							size="sm"
							align="center"
							color="primary"
							buttonwidth="auto"
						>
							<ssk-tab-button
								variant="button"
								size="sm"
								align="center"
								buttonwidth="auto"
								width="100%"
								active={draftOnSiteLocation === 'customer'}
								on:click={() => (draftOnSiteLocation = 'customer')}
							>
								<div class="tab-text">ที่อยู่ลูกค้า</div>
							</ssk-tab-button>
							<ssk-tab-button
								variant="button"
								size="sm"
								align="center"
								buttonwidth="auto"
								width="100%"
								active={draftOnSiteLocation === 'store'}
								on:click={() => (draftOnSiteLocation = 'store')}
							>
								<div class="tab-text">ที่ร้าน</div>
							</ssk-tab-button>
						</ssk-tab-header>
					</div>
					{#if draftOnSiteLocation === 'customer'}
						<!-- Same card picker DrawerCustomerAddress's own ที่อยู่จัดส่ง section uses —
						     expanded inline here too, same "no second drawer" fix as ที่ร้าน's branch
						     list below. No customer yet still needs the full customer drawer (there's
						     no address book to show without one), same as today. -->
						{#if !buyer?.name}
							<button
								type="button"
								class="pile-row warn"
								on:click={() => openCustomerFromSettings('customer')}
								data-testid="sales.pile.onSite.address"
							>
								<ssk-icon name="outline-map-pin" size="xs" themeColor="error"></ssk-icon>
								<span class="pile-row-value">ยังไม่มีลูกค้า — เลือกลูกค้าก่อน</span>
								<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
							</button>
						{:else}
							<div class="inline-settings">
								<span class="field-label-row">
									<span class="field-label">ที่อยู่ลูกค้า<span class="required">*</span></span>
									{#if addresses.length > 0}
										<button
											type="button"
											class="link"
											on:click={() => openCustomerFromSettings('address')}
											data-testid="sales.pile.onSite.address.add"
										>
											เพิ่มที่อยู่ใหม่
										</button>
									{/if}
								</span>
								{#if addresses.length === 0}
									<button
										type="button"
										class="pile-row warn"
										on:click={() => openCustomerFromSettings('address')}
										data-testid="sales.pile.onSite.address.create"
									>
										<ssk-icon name="outline-map-pin" size="xs" themeColor="error"></ssk-icon>
										<span class="pile-row-value">เพิ่มที่อยู่จัดส่งของลูกค้ารายนี้</span>
										<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
									</button>
								{:else}
									<PickList
										label="ที่อยู่ลูกค้า"
										count={addresses.length}
										selectedIndex={addresses.findIndex((a) => String(a.id) === idAddress)}
										onMove={(i) => {
											const next = addresses[i];
											if (next) onSelectOnSiteAddress(next);
										}}
									>
										{#each addresses as address, index (address.id ?? index)}
											<PickCard
												title={address.contactName || 'ที่อยู่จัดส่ง'}
												badge={address.isDefault ? 'ที่อยู่หลัก' : ''}
												lines={[
													addressToDisplay(address),
													address.phone ? `โทร ${address.phone}` : ''
												].filter(Boolean)}
												selected={String(address.id) === idAddress}
												tabbable={String(address.id) === idAddress ||
													(!selectedAddress && index === 0)}
												onSelect={() => onSelectOnSiteAddress(address)}
												testId={`sales.pile.onSite.address.${address.id ?? index}`}
											/>
										{/each}
									</PickList>
								{/if}
							</div>
						{/if}
					{:else if draftOnSiteLocation === 'store'}
						<!-- Any of the company's own branches is a legal choice here — unlike
						     รับภายหลัง's branch (which only ever means the ONE actually collecting),
						     every branch can equally offer the service, so the list is never
						     pre-filtered (see its own "ที่ร้านจะเป็นสาขาทั้งหมดของร้าน" comment).
						     Expanded inline, not a button into a second modal — this already IS
						     the "ตั้งค่า" drawer, so a tab pick should show the cards right there. -->
						<PickList
							label="สาขาที่ให้บริการ"
							count={branches.length}
							selectedIndex={branches.findIndex((b) => b.id === draftOnSiteStoreId)}
							onMove={(i) => (draftOnSiteStoreId = branches[i]?.id ?? draftOnSiteStoreId)}
						>
							{#each branches as branch, index (branch.id ?? index)}
								<PickCard
									title={branch.name}
									badge={branch.id === $currentStore?.id ? 'สาขาที่ขาย' : ''}
									lines={[addressToDisplay(branch.address), branch.phone ? `โทร ${branch.phone}` : '']
										.filter(Boolean)
										.map(String)}
									selected={branch.id === draftOnSiteStoreId}
									tabbable={branch.id === draftOnSiteStoreId ||
										(!draftOnSiteStoreId && index === 0)}
									onSelect={() => (draftOnSiteStoreId = branch.id ?? draftOnSiteStoreId)}
									testId={`sales.pile.onSite.branch.${branch.id ?? index}`}
								/>
							{/each}
						</PickList>
						{#if branches.length === 0}
							<p class="pick-empty">บริษัทนี้มีสาขาเดียว จึงไม่มีสาขาอื่นให้เลือก</p>
						{/if}
					{/if}
				{/if}
				{#if editingKind === DeliveryGroupKind.Shipping}
					{#if isBasicMarketplaceShip}
						<div class="pile-row static" data-testid="sales.pile.shipping.courier.platform">
							<ssk-icon name="outline-truck" size="xs" themeColor="primary"></ssk-icon>
							<span class="pile-row-label">ขนส่ง</span>
							<span class="pile-row-value">ตามแพลตฟอร์ม ({subChannelOption?.label ?? subChannel})</span>
						</div>
						<!-- Courier is the platform's call, never the merchant's — but the fee is
						     still the merchant's own, same field as every other shipping fee. -->
						<div class="inline-settings">
							<div class="fee-field">
								<ssk-input
									size="lg"
									label="ค่าจัดส่ง"
									placeholder="ระบุค่าจัดส่ง"
									autoComplete="off"
									value={draftFee}
									on:input={onDraftFeeInput}
									on:change={onDraftFeeInput}
									data-testid="sales.pile.shipping.fee"
								/>
								<ssk-button
									size="lg"
									variant="outline"
									themeColor="primary"
									on:click={() => (draftFee = '0')}
									data-testid="sales.pile.shipping.fee.free"
								>
									ฟรี
								</ssk-button>
							</div>
						</div>
					{:else}
						<!-- Basic mode inline — never opens DrawerDelivery (the group-order drawer),
						     per the rule that basic mode has nothing to do with it. -->
						<div class="inline-settings">
							<span class="field-label">วิธีการจัดส่ง<span class="required">*</span></span>
							<div class="shipping-method">
								<ssk-tab-header
									class="tabs"
									variant="button"
									size="sm"
									align="center"
									color="primary"
									buttonwidth="auto"
								>
									<ssk-tab-button
										variant="button"
										size="sm"
										align="center"
										buttonwidth="auto"
										width="100%"
										active={draftShippingType === ShippingType.Standard}
										on:click={() => onSelectDraftShippingType(ShippingType.Standard)}
									>
										<div class="tab-text">Standard</div>
									</ssk-tab-button>
									<ssk-tab-button
										variant="button"
										size="sm"
										align="center"
										buttonwidth="auto"
										width="100%"
										active={draftShippingType === ShippingType.SameDay}
										on:click={() => onSelectDraftShippingType(ShippingType.SameDay)}
									>
										<div class="tab-text">Same Day</div>
									</ssk-tab-button>
								</ssk-tab-header>
								<CustomFancyRadioGroup
									label=""
									options={renderDeliveryOptions(
										draftShippingType === ShippingType.Standard ? standardDeliveries : sameDayDeliveries
									)}
									optionsPerRow={2}
									value={draftMethod}
									onChange={(v) => (draftMethod = v)}
								/>
							</div>
							{#if draftShippingType === ShippingType.SameDay}
								<!-- Same Day only — which vehicle the courier dispatches. Frontend-only
								     field for now (see DeliveryGroup.vehicleType's own comment); nothing
								     downstream reads it until a backend field exists. -->
								<div class="inline-settings">
									<span class="field-label">ประเภทยานพาหนะ</span>
									<CustomFancyRadioGroup
										label=""
										options={renderDeliveryOptions(vehicleTypes)}
										optionsPerRow={2}
										value={draftVehicleType}
										onChange={(v) => (draftVehicleType = v)}
									/>
								</div>
							{/if}
							<div class="fee-field">
								<ssk-input
									size="lg"
									label="ค่าจัดส่ง"
									placeholder="ระบุค่าจัดส่ง"
									autoComplete="off"
									value={draftFee}
									on:input={onDraftFeeInput}
									on:change={onDraftFeeInput}
									data-testid="sales.pile.shipping.fee"
								/>
								<ssk-button
									size="lg"
									variant="outline"
									themeColor="primary"
									on:click={() => (draftFee = '0')}
									data-testid="sales.pile.shipping.fee.free"
								>
									ฟรี
								</ssk-button>
							</div>
						</div>
					{/if}
				{:else if editingKind === DeliveryGroupKind.OnSite}
					<div class="inline-settings">
						<div class="fee-field">
							<ssk-input
								size="lg"
								label="ค่าเดินทาง"
								placeholder="ระบุค่าเดินทาง"
								autoComplete="off"
								value={draftTravelFee}
								on:input={onDraftTravelFeeInput}
								on:change={onDraftTravelFeeInput}
								data-testid="sales.pile.onSite.travelfee"
							/>
							<ssk-button
								size="lg"
								variant="outline"
								themeColor="primary"
								on:click={() => (draftTravelFee = '0')}
								data-testid="sales.pile.onSite.travelfee.free"
							>
								ฟรี
							</ssk-button>
						</div>
					</div>
				{:else if editingKind === DeliveryGroupKind.PickupLater}
					<button
						type="button"
						class="pile-row"
						on:click={() => runFromSettings(() => (showPickupModal = true))}
						data-testid="sales.pile.pickupLater.branch"
					>
						<ssk-icon name="outline-building-storefront" size="xs" themeColor="primary"></ssk-icon>
						<span class="pile-row-label">รับที่สาขา</span>
						<span class="pile-row-value">{editingPickupBranch ? editingPickupBranch.name : 'เลือกสาขา'}</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
					<div class="inline-settings">
						<div class="pickup-date-field">
							<span class="field-label">วันที่และเวลารับสินค้า<span class="required">*</span></span>
							<ssk-date-picker
								size="md"
								format="dd/MM/yyyy HH:mm"
								showTime
								timeFormat="hm"
								displayOk
								locale="th"
								placeholder="เลือกวันที่และเวลา"
								value={draftPickupDateValue}
								on:change={onDraftPickupDateChange}
								data-testid="sales.pile.pickupLater.date"
							/>
						</div>
					</div>
				{:else if editingKind === DeliveryGroupKind.PickupInStore}
					<div class="pile-row static">
						<ssk-icon name="outline-shopping-bag" size="xs" themeColor="success"></ssk-icon>
						<span class="pile-row-value">ส่งมอบที่เคาน์เตอร์หลังชำระเงิน</span>
					</div>
				{:else if editingKind === DeliveryGroupKind.Digital}
					<!-- Nothing drafted/saved here — the contact itself lives on the buyer, so this
					     just opens the same customer drawer every other "ส่งไปที่"/"ให้บริการที่"
					     row already opens (see the Shipping/OnSite branch above), defaulting to
					     whatever email/phone the selected customer already has. -->
					<button
						type="button"
						class="pile-row"
						class:warn={!buyer?.email && !buyer?.phone}
						on:click={() => openCustomerFromSettings('customer')}
						data-testid="sales.pile.digital.contact"
					>
						<ssk-icon name="outline-bolt" size="xs" themeColor={buyer?.email || buyer?.phone ? 'primary' : 'error'}></ssk-icon>
						<span class="pile-row-label">ส่งไปที่</span>
						<span class="pile-row-value">
							{buyer?.email || maskPhoneMiddle(buyer?.phone) || 'ยังไม่มีอีเมลหรือเบอร์โทรลูกค้า'}
						</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				{/if}
		{#if editingKind}
			<details class="settings-items" open>
				<summary class="settings-items-toggle">
					<span class="field-label">สินค้าในหมวดนี้</span>
					<span class="settings-items-count">{itemsOfKind(editingKind).length}</span>
				</summary>
				<div class="settings-item-list">
					{#each itemsOfKind(editingKind) as item (item.lineId)}
						<div class="settings-item">
							<span class="pile-row-value">{item.product_name}</span>
							<span class="settings-qty">x{item.qty}</span>
						</div>
					{/each}
				</div>
			</details>
		{/if}
	</div>
	<div slot="footer" class="footer">
		{#if isSavableKind}
			<ssk-button
				variant="outline"
				themeColor="gray"
				width="full"
				on:click={() => {
					editingKind = undefined;
					editingPickupStoreId = undefined;
					editingAddressId = undefined;
				}}
				data-testid="sales.fulfilment.settings.cancel"
			>
				ยกเลิก
			</ssk-button>
		{/if}
		<ssk-button
			width="full"
			on:click={isSavableKind
				? saveFulfilmentSettings
				: () => {
						editingKind = undefined;
						editingPickupStoreId = undefined;
						editingAddressId = undefined;
					}}
			data-testid={isSavableKind ? 'sales.fulfilment.settings.save' : 'sales.fulfilment.settings.done'}
		>
			{isSavableKind ? 'บันทึก' : 'เสร็จสิ้น'}
		</ssk-button>
	</div>
</ssk-drawer>

<DrawerCustomerAddress
	showDrawer={showDrawerCustomer}
	toggleDrawer={toggleDrawerCustomer}
	{buyer}
	bind:addresses
	bind:idAddress
	{needsAddress}
	openOn={customerDrawerOpenOn}
	onSelectCustomer={onClickSelectCustomer}
	onSelectAddress={onClickSelectAddress}
	onRemoveCustomer={onClickRemoveCustomer}
/>

<ModalPickupBranch
	show={showPickupModal}
	{branches}
	selectedStoreId={pickupStoreId}
	sellingStoreId={$currentStore?.id ?? ''}
	onSelect={onSelectPickupBranch}
	close={() => (showPickupModal = false)}
/>

<!-- A second instance for "เพิ่มตัวเลือกรับสินค้า" → รับภายหลัง — its own modalId/
     testIdPrefix so it doesn't collide with the one above (see the ids-must-be-unique
     fix in CartItem.svelte's remove/zero-qty modals), and its branch list is pre-filtered
     to exclude whatever a รับภายหลัง pile is already using. -->
<ModalPickupBranch
	show={showAddPileBranchModal}
	branches={pickupLaterBranchOptions}
	sellingStoreId={$currentStore?.id ?? ''}
	onSelect={onSelectAddPileBranch}
	close={() => (showAddPileBranchModal = false)}
	modalId="pickup-branch-pile"
	testIdPrefix="sales.pile.pickup"
/>

<!-- "เพิ่มตัวเลือกรับสินค้า" → จัดส่งจากหน้าร้าน (a second pile) AND a pile's own settings
     drawer re-picking its address both share this one modal — pileAddressPickerTarget tells
     onSelectPileAddress which of the two it is (see openAddShippingPile / the settings
     drawer's address row above). shippingAddressOptions already excludes every address
     another pile is using, so there's nothing left for a cashier to pick a duplicate. -->
<ModalAddPileAddress
	show={showPileAddressModal}
	addresses={shippingAddressOptions}
	onSelect={onSelectPileAddress}
	close={() => (showPileAddressModal = false)}
	{buyer}
	onAddressCreated={setAddress}
/>

<!-- Collapsed, the sale's context and the list's own header are two thin rows and
     neither owns the list below. Merged into one bounded block they read as the order
     header: line 1 = what this sale is, line 2 = what is in it. -->
<div class="order-head" class:merged={topCollapsed}>
	<div id="cart-top" class:collapsed={topCollapsed}>
		{#if topCollapsed}
			<!-- The small version: everything above condensed into one readable line that is
		     itself the way back. -->
			<button
				type="button"
				class="top-summary"
				on:click={() => (topCollapsed = false)}
				aria-label="แก้ไขประเภทการขายและลูกค้า"
				data-testid="sales.cart.top.summary"
			>
				<ssk-icon name="outline-chevron-down" size="xs" themeColor="stroke"></ssk-icon>
				<span class="top-summary-text">
					<ssk-text size="xs" color="gray.500">
						{#if isPos}
							{#if isMultiFulfilment}
								หลายรูปแบบ
							{:else if orderDeliveryI18nKey(fullfilmentType)}
								<ssk-i18n-translate
									key={orderDeliveryI18nKey(fullfilmentType)}
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							{:else}
								{fullfilmentMeta[fullfilmentType]?.label ?? ''}
							{/if}
						{:else if isOnline}
							<!-- POS's collapsed strip names its one decision (fulfilment type); online
							     has no such single field, so this names its three instead — the
							     sub-channel, how it's paid, and the courier actually picked in
							     "วิธีการจัดส่ง" (methodLabel already renders the 'platform' sentinel
							     as "ตามแพลตฟอร์ม (...)" for a marketplace sub-channel). ช่องทางการขาย
							     and วิธีการชำระ stay exactly as before; only this third slot changed —
							     now that online can mix รับภายหลัง/จัดส่ง/ให้บริการ (not just several
							     Shipping addresses), "จัดส่งหลายที่อยู่" no longer says what's actually
							     going on once a different KIND is also in play, so it's replaced with
							     the same "หลายรูปแบบ (N หมวด)" wording the POS dropdown trigger already
							     uses for this exact situation (isMultiFulfilment/labelKinds.length). -->
							{subChannelOption?.label ?? 'ไม่ระบุ'} ·
							{paymentLabel($orderData.paymentType)} ·
							{isMultiFulfilment
								? `หลายรูปแบบ (${labelKinds.length} หมวด)`
								: singleDeliveryGroup?.method
									? methodLabel(singleDeliveryGroup.method)
									: 'ยังไม่เลือกขนส่ง'}
						{:else if isLinkBill}
							Link bill
						{/if}
					</ssk-text>
				</span>
				<!-- Customer sits at the far right with the pencil: it is the field most likely
			     to need a second look, and the icon says the whole strip is editable —
			     clicking anywhere on it opens the block again. -->
				<span class="top-summary-customer" data-testid="sales.cart.top.customer">
					<ssk-text size="xs" color={buyer?.name ? 'gray.800' : 'gray.400'}>
						{buyer?.name ? buyer.name : 'ยังไม่เลือกลูกค้า'}
					</ssk-text>
				</span>
				<ssk-icon name="outline-pencil-square" size="xs" themeColor="primary"></ssk-icon>
			</button>
		{:else}
			<!-- One control, one decision: pick the sale channel. Nothing is nested inside a
     tab button any more, so a click here can only ever mean "switch channel". -->
			<ssk-tab-header
				class="tabs"
				variant="button"
				size="sm"
				align="center"
				color="primary"
				buttonwidth="auto"
				role="radiogroup"
				aria-label="รูปแบบการขาย"
			>
				{#each channels as ch, index}
					<ssk-tab-button
						active={ch.value === channel}
						variant="button"
						size="sm"
						align="center"
						buttonwidth="auto"
						width="100%"
						role="radio"
						aria-checked={ch.value === channel}
						tabindex={ch.value === channel ? 0 : -1}
						on:click={() => onSelectChannel(ch.value)}
						on:keydown={onChannelKeydown(index)}
						data-testid={`sales.channel.${ch.value}`}
					>
						<div class="tab-text">
							<!-- No colour prop: the icon inherits currentColor from the tab button, which
							     the DS already darkens for the active segment. Measured gray-800 when
							     active and gray-600 when not, so the state reads without extra wiring
							     (a themeColor binding here resolved to nothing anyway). -->
							<ssk-icon name={ch.icon} size="sm"></ssk-icon>
							<span>{ch.label}</span>
						</div>
					</ssk-tab-button>
				{/each}
			</ssk-tab-header>

			<!-- One decision per row, each under its own label, as the confirmed prototype
		     lays it out: a 175px half-card had to abbreviate everything it held, while a
		     full-width row can say the whole thing — and the customer block can carry the
		     address inside itself instead of spending another row on it. -->
			{#if isOnline}
				<div class="field">
					<span class="field-label">ช่องทางการขาย</span>
					<ssk-dropdown
						class="selector"
						size="sm"
						width="100%"
						optionswidth="100%"
						value={subChannel}
						aria-label="ช่องทางการขาย"
						data-testid="sales.subchannel.select"
					>
						<ssk-dropdown-button slot="selected" value={subChannel}>
							<span class="selector-body">
								{#if subChannelOption?.icon}
									<img class="channel-logo" src={subChannelOption.icon} alt="" />
								{:else}
									<ssk-icon name="outline-globe-alt" size="md" themeColor="primary"></ssk-icon>
								{/if}
								<span class="selector-title">{subChannelOption?.label ?? 'เลือกช่องทาง'}</span>
							</span>
						</ssk-dropdown-button>
						{#each salesChannels as option}
							<ssk-dropdown-option
								value={option.value}
								aria-selected={option.value === subChannel}
								on:click={() => onSelectSubChannel(option.value)}
								data-testid={`sales.subchannel.option.${option.value}`}
							>
								<span class="option-body">
									{#if option.icon}
										<img class="channel-logo sm" src={option.icon} alt="" />
									{:else}
										<ssk-icon name="outline-globe-alt" size="sm" themeColor="stroke"></ssk-icon>
									{/if}
									<span class="selector-title">{option.label}</span>
								</span>
							</ssk-dropdown-option>
						{/each}
					</ssk-dropdown>
				</div>
			{/if}
			{#if isPos || isOnline}
				<!-- This dropdown is the DEFAULT every physical line not re-picked by the
				     cashier follows (see handleSelectOption's ResetPhysicalLineFulfilment), even
				     with several categories present at once via "เพิ่มตัวเลือกรับสินค้า". Online
				     gets this same field now too (PO brief) — shown right under ช่องทางการขาย
				     above, minus รับทันที, with a marketplace sub-channel (Shopee/Lazada/...)
				     excluded entirely since those physical lines have no other legal destination
				     than the platform's own Shipping anyway (see lineFulfilmentOptions). -->
				<div class="field">
					<span class="field-label-row">
						<span class="field-label">
							รูปแบบการรับสินค้า
						</span>
						{#if cartList.length > 0}
							<!-- Opening a pile adds its section to the cart list below AND makes it
							     the active one (activeFulfilmentPile) — shown as a highlight on the
							     section itself (CartFulfilmentPiles), not a separate status line here.
							     The cashier can still drag existing lines into any pile regardless of
							     which one is active; being active only decides where a freshly TAPPED
							     product lands. -->
							<span class="pile-adder-wrap" bind:this={pileMenuWrapEl}>
								<ssk-button
									size="sm"
									variant="ghost"
									on:click={() => (showPileMenu = !showPileMenu)}
									data-testid="sales.pile.add"
								>
									<ssk-icon name="outline-plus" size="xs"></ssk-icon>
									เพิ่มตัวเลือกรับสินค้า
								</ssk-button>
								{#if showPileMenu}
									<FulfilmentMenu
										options={pileMenuOptions}
										positionStyle="top:calc(100% + 0.25rem);right:0;width:240px"
										menuTestId="sales.pile.add.menu"
										optionTestIdPrefix="sales.pile.add.option"
										on:select={(e) => {
											const option = pileTypeOptions.find(({ kind }) => kind === e.detail);
											if (!option) return;
											onSelectPileType(option.kind);
											showPileMenu = false;
										}}
									/>
								{/if}
							</span>
						{/if}
					</span>

					<ssk-dropdown
						class="selector"
						size="sm"
						width="100%"
						optionswidth="100%"
						value={fullfilmentType}
						aria-label="รูปแบบการรับสินค้า"
						data-testid="sales.fulfilment.select"
						on:click={() => (showPileMenu = false)}
					>
						<ssk-dropdown-button slot="selected" value={fullfilmentType}>
							{#if isMultiFulfilment}
							<span class="selector-body" data-testid="sales.fulfilment.multi">
								<ssk-icon name="outline-squares-2x2" size="md" themeColor="primary"></ssk-icon>
								<span class="selector-title">หลายรูปแบบ ({labelKinds.length} หมวด)</span>
							</span>
							{:else}
							<span class="selector-body">
								<ssk-icon
									name={fullfilmentMeta[displayFullfilmentType]?.icon ?? 'outline-shopping-bag'}
									size="md"
									themeColor="primary"
								></ssk-icon>
								<span class="selector-title">
									{#if orderDeliveryI18nKey(displayFullfilmentType)}
										<ssk-i18n-translate
											key={orderDeliveryI18nKey(displayFullfilmentType)}
											lang={$currentLanguage.code}
											fallbackLang="default"
										/>
									{:else}
										{fullfilmentMeta[displayFullfilmentType]?.label ?? ''}
									{/if}
								</span>
								{#if isMixedReceive}<span class="selector-mixed">· รับบางส่วน</span>{/if}
							</span>
							{/if}
						</ssk-dropdown-button>
						{#each fullfilmentOptions as opt}
							<!-- Folds "this IS the sale's current default" into the exact same signal as
							     "this already has a bucket in the cart" — ssk-dropdown-option's own
							     native selected style (triggered by `value` matching the parent
							     ssk-dropdown's `value`) used to paint ITS OWN checkmark on whichever row
							     equalled fullfilmentType, in a different colour than our ✓ on every
							     OTHER present row — two indicators doing the same job, disagreeing with
							     each other. `value` is dropped below so only our one ✓ ever renders,
							     and it now covers both cases so nothing silently loses its tick. -->
							{@const isPresent = presentFullfilmentTypes.has(opt) || opt === fullfilmentType}
							<ssk-dropdown-option
								aria-selected={isPresent}
								on:click={() => handleSelectOption(opt)}
								data-testid={`sales.fulfilment.option.${opt}`}
							>
								<span class="option-body">
									<ssk-icon name={fullfilmentMeta[opt]?.icon} size="sm" themeColor="stroke"
									></ssk-icon>
									<span class="selector-text">
										<span class="selector-title">
											{#if orderDeliveryI18nKey(opt)}
												<ssk-i18n-translate
													key={orderDeliveryI18nKey(opt)}
													lang={$currentLanguage.code}
													fallbackLang="default"
												/>
											{:else}
												{fullfilmentMeta[opt]?.label ?? ''}
											{/if}
										</span>
										<span class="selector-hint">{fullfilmentMeta[opt]?.hint ?? ''}</span>
									</span>
									{#if isPresent}
										<!-- Already has a bucket in the cart — a multi-fulfilment sale can have
										     several of these at once, so this is a plain ✓ per present
										     category, not a single radio-style highlight. -->
										<ssk-icon
											class="option-present-check"
											name="outline-check"
											size="xs"
											color="#EC5E2A"
											aria-label="มีอยู่ในตะกร้าแล้ว"
											data-testid={`sales.fulfilment.option.${opt}.present`}
										></ssk-icon>
									{/if}
								</span>
							</ssk-dropdown-option>
						{/each}
					</ssk-dropdown>
				</div>
			{/if}

			<div class="field">
				<span class="field-label-row">
					<span class="field-label">
						ลูกค้า{#if customerRequired}<span class="required">*</span>{/if}
					</span>
				</span>

				{#if buyer?.name}
					<div class="customer-block">
						<button
							type="button"
							class="customer-main"
							title={customerTooltip}
							on:click={() => openCustomerDrawer('customer')}
							data-testid="sales.customer.open"
						>
							<span class="customer-name">{buyer.name}</span>
							<span class="customer-contact">{customerContact}</span>
						</button>
						<button
							type="button"
							class="customer-detach"
							on:click|stopPropagation={onClickRemoveCustomer}
							data-testid="sales.customer.clear"
						>
							นำออก
						</button>

						{#if needsAddress && !hasMultiAddressShipping}
							<!-- The address belongs to the customer, so it sits inside their block —
							     one row, tappable, opening the same drawer on its address half. Hidden
							     once "จัดส่งหลายที่อยู่" is in play: a single buyer.address field can't
							     speak for N different per-pile addresses any more, and each badge below
							     already names its own (see CartFulfilmentPiles' own addressText). -->
							<button
								type="button"
								class="address-inline"
								on:click={() => openCustomerDrawer('address')}
								data-testid="sales.address.open"
							>
								{#if selectedAddress}
									{#if selectedAddress.isDefault}
										<span class="badge-default">ที่อยู่หลัก</span>
									{/if}
									<span class="address-text">{addressToDisplay(selectedAddress)}</span>
								{:else}
									<ssk-icon name="outline-map-pin" size="xs" themeColor="stroke"></ssk-icon>
									<span class="address-text add"
										>เพิ่มที่อยู่จัดส่ง<span class="required">*</span></span
									>
								{/if}
								<ssk-icon name="solid-chevron-down" size="xs" themeColor="stroke"></ssk-icon>
							</button>
						{/if}
					</div>
				{:else}
					<button
						type="button"
						class="field-control empty"
						on:click={() => openCustomerDrawer('customer')}
						data-testid="sales.customer.open"
					>
						<ssk-icon name="outline-user" size="sm" themeColor="primary"></ssk-icon>
						<span class="field-value">{isOnline ? 'เลือกลูกค้า' : 'ลูกค้าหน้าร้าน'}</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				{/if}
			</div>

			{#if isOnline}
				<!-- The order's ONE payment choice, covering every fulfilment group together —
				     always shown for online, whatever the sale is collected through (a
				     รับภายหลัง/ให้บริการ/ดิจิทัล-only sale still has to be paid for). No per-pile
				     drawer carries payment any more, so there is never a second place to set it. -->
				<div class="field">
					<span class="field-label">
						วิธีการชำระเงิน{#if paymentMissing}<span class="required">*</span>{/if}
					</span>
					{#if isMarketplaceOnline}
						<div class="dest-trigger static" data-testid="sales.payment.platform">
							<ssk-icon name="outline-credit-card" size="sm" themeColor="primary"></ssk-icon>
							<span class="dest-trigger-value">
								ตามแพลตฟอร์ม ({subChannelOption?.label ?? subChannel})
							</span>
						</div>
					{:else}
						<ssk-dropdown
							class="selector"
							size="sm"
							width="100%"
							optionswidth="100%"
							value={$orderData.paymentType}
							aria-label="วิธีการชำระเงิน"
							data-testid="sales.payment.select"
						>
							<ssk-dropdown-button slot="selected" value={$orderData.paymentType}>
								<span class="selector-body">
									<ssk-icon
										name={onlinePaymentOption?.icon ?? 'outline-credit-card'}
										size="md"
										themeColor="primary"
									></ssk-icon>
									<span class="selector-title" class:placeholder={paymentMissing}>
										{paymentMissing ? 'เลือกวิธีการชำระเงิน' : paymentLabel($orderData.paymentType)}
									</span>
								</span>
							</ssk-dropdown-button>
							{#each onlinePaymentOptions as option}
								<ssk-dropdown-option
									value={option.value}
									aria-selected={option.value === $orderData.paymentType}
									on:click={() => setPaymentType(option.value)}
									data-testid={`sales.payment.option.${option.value}`}
								>
									<span class="option-body">
										<ssk-icon name={option.icon} size="sm" themeColor="stroke"></ssk-icon>
										<span class="selector-title">{option.label}</span>
									</span>
								</ssk-dropdown-option>
							{/each}
						</ssk-dropdown>
					{/if}
				</div>
			{/if}

			<!-- Single-bucket-only rows, right after ลูกค้า — "รูปแบบการรับสินค้า" above already
			     states the sale's one kind, so the only bucket there is needs no badge of its
			     own repeating it; its settings live here instead. The moment a second bucket
			     exists for ANY reason, CartFulfilmentPiles shows every bucket as a badge pile
			     with its own gear icon and these rows stop showing (isSingleBucket), so there
			     is never a second, independently-resolved entry point into the same settings. -->
			{#if soleKind === DeliveryGroupKind.PickupLater}
				<div class="field">
					<span class="field-label">สาขาที่รับ</span>
					<!-- Single bucket means this is the one and only รับภายหลัง pile, so — same
					     reasoning as วันที่และเวลารับสินค้า below — this opens the branch picker
					     modal directly instead of detouring through the settings drawer first.
					     editingKind/editingPickupStoreId stay undefined here (never set), which is
					     exactly the "no specific pile" case onSelectPickupBranch already falls back
					     to: it writes straight to the sale's own default pickupStoreId. -->
					<button
						type="button"
						class="dest-trigger"
						on:click={() => (showPickupModal = true)}
						data-testid="sales.pickup.branch.open"
					>
						<ssk-icon name="outline-building-storefront" size="sm" themeColor="primary"></ssk-icon>
						<span class="dest-trigger-value">
							{branches.find((b) => b.id === (singlePickupLaterGroup?.pickupStoreId ?? pickupStoreId))
								?.name ?? 'เลือกสาขาที่ลูกค้าจะมารับ'}
						</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				</div>
				<div class="field quick-pickup-datetime-field">
					<!-- Single bucket means there is only ever this one รับภายหลัง group to edit, so
					     this opens the date-time picker itself directly — unlike สาขาที่รับ above
					     (still a real modal pick), there's no intermediate drawer step worth a detour
					     through, the way CartFulfilmentPiles' own multi-pile gear icon needs one.
					     Own `position: relative` (quick-pickup-datetime-field, not just .field) gives
					     <ssk-date-picker>'s absolutely-positioned calendar popup a containing block
					     right here — without one nearby it falls back to the page's own, which is why
					     this one opened detached from the field while the drawer's own copy (already
					     inside a positioned drawer) never did. -->
					<span class="field-label">วันที่และเวลารับสินค้า<span class="required">*</span></span>
					<ssk-date-picker
						size="md"
						format="dd/MM/yyyy HH:mm"
						showTime
						timeFormat="hm"
						displayOk
						locale="th"
						placeholder="เลือกวันที่และเวลา"
						value={quickPickupDateTimeValue}
						on:change={onQuickPickupDateTimeChange}
						data-testid="sales.pickup.datetime.open"
					/>
				</div>
			{/if}

			{#if soleKind === DeliveryGroupKind.Shipping}
				<div class="field">
					<span class="field-label">
						ข้อมูลการจัดส่ง{#if shipInfoMissing}<span
								class="required">*</span
							>{/if}
					</span>
					<button
						type="button"
						class="dest-trigger"
						on:click={() => openEditingKind(DeliveryGroupKind.Shipping)}
						data-testid="sales.deliveryinfo.method.open"
					>
						<ssk-icon name="outline-truck" size="sm" themeColor="primary"></ssk-icon>
						<span class="dest-trigger-value" class:placeholder={!shippingGroup?.method}>
							{#if shippingGroup?.method}
								{methodLabel(shippingGroup.method)} · {formatPriceWithBath(
									shippingGroup.shippingFee ?? 0
								)}
							{:else}
								ระบุขนส่งและค่าจัดส่ง
							{/if}
						</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				</div>
			{/if}

			{#if soleKind === DeliveryGroupKind.OnSite}
				<div class="field">
					<span class="field-label">
						ข้อมูลการจัดส่ง{#if onSiteInfoMissing}<span class="required">*</span>{/if}
					</span>
					<button
						type="button"
						class="dest-trigger"
						on:click={() => openEditingKind(DeliveryGroupKind.OnSite)}
						data-testid="sales.deliveryinfo.travelfee.open"
					>
						<ssk-icon name="outline-wrench-screwdriver" size="sm" themeColor="primary"
						></ssk-icon>
						<span class="dest-trigger-value">
							{#if onSiteGroup?.onSiteLocation === 'store'}
								{branches.find((b) => b.id === onSiteGroup?.onSiteStoreId)?.name ?? 'เลือกสาขา'} ·
								ค่าเดินทาง · {formatPriceWithBath(onSiteGroup?.shippingFee ?? 0)}
							{:else if onSiteGroup?.onSiteLocation === 'customer'}
								ที่อยู่ลูกค้า · ค่าเดินทาง · {formatPriceWithBath(onSiteGroup?.shippingFee ?? 0)}
							{:else}
								เลือกรับบริการที่ร้านหรือที่อยู่ลูกค้า
							{/if}
						</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				</div>
			{/if}

			{#if isLinkBill}
				<!-- The cashier can pre-pick the customer's address above, same as any other
				     channel now — this note just covers what the link itself still handles:
				     anything left unset, and its own 30-minute expiry. -->
				<div class="link-note" data-testid="sales.linkbill.note">
					<ssk-icon name="outline-link" size="sm" themeColor="primary"></ssk-icon>
					<span>
						{#if selectedAddress}
							ลิงก์จะส่งไปที่ที่อยู่ที่เลือกไว้
						{:else}
							ถ้าไม่ระบุ ลูกค้าจะกรอกเบอร์โทรและที่อยู่เองในลิงก์
						{/if}
						· ลิงก์หมดอายุใน <b>30 นาที</b>
					</span>
				</div>
			{/if}

			<!-- Digital's own contact row — same isSingleBucket gating as สาขาที่รับ/ข้อมูลการจัดส่ง
			     above: once a second bucket exists for ANY reason, CartFulfilmentPiles' own
			     Digital badge (now with its own gear icon, see hasSettings) takes over as the
			     one entry point, so this inline row must stop showing then too — otherwise
			     there'd be two places to manage the same contact at once. -->
			{#if needsDigitalContact && isSingleBucket}
				<div class="field">
					<span class="field-label">ส่งสินค้าดิจิทัลไปที่</span>
					{#if buyer?.refId}
						<!-- Edits JUST the email, right here — before this, fixing a typo'd email
						     meant opening DrawerCustomerAddress's whole "ลูกค้าและที่อยู่จัดส่ง"
						     drawer to change one field. A phone fallback still displays (ชื่อ +
						     เบอร์ are gathered at the customer-select step), but email is the one
						     digital delivery actually needs and the one this field lets a cashier
						     fix without leaving the cart. -->
						<div class="dest-trigger" class:empty={!buyer?.email && !buyer?.phone}>
							<ssk-icon
								name={buyer?.email || buyer?.phone ? 'outline-bolt' : 'outline-exclamation-triangle'}
								size="sm"
								themeColor={buyer?.email || buyer?.phone ? 'primary' : 'error'}
							></ssk-icon>
							<InlineContactEdit
								kind="email"
								value={buyer?.email}
								refId={buyer?.refId}
								placeholder={buyer?.phone
									? `หรือใช้เบอร์ ${maskPhoneMiddle(buyer.phone)}`
									: 'ยังไม่มีอีเมล — เพิ่มที่นี่'}
								onSaved={saveBuyerEmail}
								testIdPrefix="sales.deliveryinfo.digital"
							/>
						</div>
					{:else}
						<!-- No customer picked yet — nothing to save an email onto, so this still
						     has to go through the drawer to pick one first. -->
						<button
							type="button"
							class="dest-trigger empty"
							on:click={() => openCustomerDrawer('customer')}
							data-testid="sales.deliveryinfo.digital.open"
						>
							<ssk-icon name="outline-exclamation-triangle" size="sm" themeColor="error"></ssk-icon>
							<span class="dest-trigger-value">ยังไม่มีอีเมลหรือเบอร์โทร — เพิ่มลูกค้า</span>
							<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
						</button>
					{/if}
				</div>
			{/if}

		{/if}
	</div>

	{#if cartList.length > 0}
		<div class="description">
			<div class="left">
				<!-- Section label, so one step below the 16px content it heads. -->
				<ssk-text size="sm" color="gray">
					<ssk-i18n-translate
						key="patona-sellercenter-sales-subtitle-totalitems"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				{#if !topCollapsed}
					<!-- Sits after the label it acts on: collapsing is this button's job and
				     re-opening is the summary strip's, so each state has exactly one control
				     rather than two doing the same thing. -->
					<button
						type="button"
						class="items-only-toggle"
						aria-expanded="true"
						aria-controls="cart-top"
						aria-label="ย่อประเภทการขายและลูกค้า"
						title="ย่อประเภทการขายและลูกค้า"
						on:click={() => (topCollapsed = true)}
						data-testid="sales.cart.items-only.toggle"
					>
						<ssk-icon name="outline-arrows-pointing-in" size="sm" themeColor="stroke"></ssk-icon>
					</button>
				{/if}
			</div>
			<div class="right">
				<ssk-text size="sm" color="gray">
					<span>{cartList.length}</span>
					<ssk-i18n-translate
						key="patona-sellercenter-sales-classifier-menu"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
			</div>
		</div>
	{/if}
</div>

<!-- The list simply takes every pixel the panel has left, in both states: folding the
     header above hands it that space too, and the totals + pay button below keep their
     own. Nothing to drag, nothing to remember. -->
<div class={`cart-item${cartList.length > 0 ? '' : '-no-scroll'}`}>
	{#if cartList.length > 0}
		<CartFulfilmentPiles
			bind:bucketCount={pileBucketCount}
			bind:soleKind={pileSoleKind}
			items={cartList}
			saleDefaultKind={physicalKindFor(fullfilmentType, isDelivery)}
			lineCtx={{ channel: deliveryCtx.channel, marketplace: false }}
			honourReceiveMode={allowPartialReceive && isDelivery}
			openPiles={isPos ? $openFulfilmentPiles : isOnline ? onlineOpenPiles : []}
			{branches}
			salePickupStoreId={pickupStoreId}
			{addresses}
			deliveryGroups={liveGroups}
			onRemoveOpenPile={removeOpenFulfilmentPile}
			activePile={isPos ? $activeFulfilmentPile : isOnline ? onlineActivePile : undefined}
			onSetActivePile={isPos || isOnline ? onSetActivePile : undefined}
			onEditPile={openEditingKind}
		/>
	{:else}
		<EmptyCart />
	{/if}
</div>

<ssk-divider class="cart-footer-divider" size="xs" margin="md" />

<CartFooter
	hasItem={cartList.length > 0}
	isBuyerValid={footerIsBuyerValid}
	isDeliveryLater={footerIsDeliveryLater}
	{fullfilmentType}
	{total}
	{discount}
	{summary}
	{isOnline}
	isPaymentMissing={paymentMissing}
	{isLinkBill}
	pickupStoreId={footerPickupStoreId}
	onSaleReset={resetSaleDefaults}
/>

<style>
	.right > ssk-text > span {
		color: var(--ssk-colors-primary-500);
	}

	.settings-body {
		display: grid;
		gap: 1.5rem;
		width: 100%;
		box-sizing: border-box;
		text-align: left;
	}

	.footer {
		display: flex;
		gap: 0.75rem;
		width: 100%;
	}

	.footer ssk-button {
		flex: 1 1 0;
		min-width: 0;
	}

	.settings-items {
		overflow: hidden;
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		background: var(--ssk-colors-gray-50, #f9fafb);
	}

	.settings-items-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.5rem;
		padding: 0.5rem 0.625rem;
		cursor: pointer;
		list-style: none;
	}

	.settings-items-toggle::-webkit-details-marker {
		display: none;
	}

	.settings-items-toggle .field-label {
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
	}

	.settings-items-toggle::after {
		width: 0.375rem;
		height: 0.375rem;
		margin-left: auto;
		border-right: 1.5px solid var(--ssk-colors-gray-500);
		border-bottom: 1.5px solid var(--ssk-colors-gray-500);
		content: '';
		transform: rotate(45deg) translateY(-2px);
		transition: transform 150ms ease;
	}

	.settings-items:not([open]) .settings-items-toggle::after {
		transform: rotate(-45deg) translateY(2px);
	}

	.settings-items-count {
		min-width: 1.25rem;
		padding: 0 0.25rem;
		border-radius: 999px;
		background: white;
		font-size: var(--ssk-font-size-xs);
		text-align: center;
		color: var(--ssk-colors-gray-500);
	}

	.settings-item-list {
		display: grid;
		gap: 0.25rem;
		padding: 0.5rem 0.625rem;
		border-top: 1px solid var(--ssk-colors-gray-100);
	}

	.settings-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.375rem 0.5rem;
		border-radius: 6px;
		background: white;
		font-size: var(--ssk-font-size-xs);
	}

	.settings-qty {
		color: var(--ssk-colors-gray-500);
	}

	.pile-row {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		min-width: 0;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 6px;
		background: white;
		font: inherit;
		font-size: var(--ssk-font-size-md, 1rem);
		text-align: left;
		cursor: pointer;
	}

	.pile-row.static {
		cursor: default;
		border-style: dashed;
	}

	.pile-row.warn {
		border-color: var(--ssk-colors-error-200, #fecaca);
		background: var(--ssk-colors-error-50, #fef2f2);
	}

	.pile-row-label {
		flex-shrink: 0;
		color: var(--ssk-colors-gray-500);
	}

	.pile-row-value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ssk-colors-gray-800);
	}

	.inline-settings {
		display: grid;
		gap: 1.5rem;
	}

	.inline-settings > .field-label {
		font-size: var(--ssk-font-size-lg, 18px);
		font-weight: 400;
		line-height: 1;
		color: var(--ssk-colors-text-900);
	}

	.shipping-method {
		display: grid;
		gap: 0.75rem;
	}

	.fee-field {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.fee-field ssk-input {
		flex: 1;
		min-width: 0;
	}

	.fee-field ssk-button {
		padding-bottom: 0.25em;
	}

	.pickup-date-field {
		display: grid;
		gap: 0.5rem;
	}

	.pickup-date-field :global(ssk-date-picker) {
		width: 100%;
	}

	.cart-item {
		/* Let the list yield all available height; overflow stays scrollable inside it. */
		flex: 1 1 0;
		min-height: 0;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.cart-item-no-scroll {
		flex: 1 1 0;
		min-height: 0;
		overflow-y: auto;
		padding: 0;
	}

	.cart-footer-divider {
		margin-bottom: 0.5rem;
	}

	/* Replaces the plain <ssk-divider> that used to sit here: same hairline, but it
	   is the resize control now. */
	/* Icon-only state button: 32px box keeps it small next to the header text while
	   staying a comfortable target, since the whole point of this mode is saving space. */
	.items-only-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		flex: 0 0 auto;
		background: none;
		border: none;
		border-radius: 4px;
		padding: 0;
		cursor: pointer;
	}

	.items-only-toggle:hover {
		background-color: var(--ssk-colors-gray-100);
	}

	.items-only-toggle:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: -2px;
	}

	/* One block, two lines, when collapsed: the sale's context sits above the list's own
	   header inside a single bounded surface, so the pair reads as the order's header
	   instead of two loose 32/40px rows. Expanded it is a plain wrapper. */
	/* Same visual family as the two selector cards, but one line high: it is a detail
	   of the choice above, not a third choice. */
	.detail-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		box-sizing: border-box;
		margin-bottom: 0.75rem;
		padding: 0.4375rem 0.5rem;
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		font-family: var(--ssk-font-family-sans, 'Noto Sans Thai', Roboto, sans-serif);
		text-align: left;
		cursor: pointer;
	}

	/* Copied (not shared — Svelte scopes styles per component) from DrawerDelivery.svelte's
	   own .dest-trigger/.dest-trigger-value/.dest-trigger.empty, so the plain unsplit sale's
	   address/method/travel-fee rows read as the exact same control as the per-group
	   card's own. */
	.dest-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		margin-bottom: 0.5rem;
		padding: 0.625rem 0.75rem;
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		box-sizing: border-box;
	}

	.dest-trigger:last-child {
		margin-bottom: 0;
	}

	.dest-trigger:hover {
		background: var(--ssk-colors-gray-50);
	}

	.dest-trigger:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}

	.dest-trigger-value {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-800);
	}

	.selector-title.placeholder {
		color: var(--ssk-colors-gray-400);
	}

	.dest-trigger.static {
		cursor: default;
	}

	.dest-trigger-value.placeholder {
		color: var(--ssk-colors-gray-500);
	}

	.dest-trigger.empty {
		background: var(--ssk-colors-error-50, #fef2f2);
		border-color: var(--ssk-colors-error-200, #fecaca);
	}

	.dest-trigger.empty:hover {
		background: var(--ssk-colors-error-100, #fee2e2);
	}

	.dest-trigger.empty .dest-trigger-value {
		color: var(--ssk-colors-error-600, #dc2626);
	}

	.detail-row:hover {
		border-color: var(--ssk-colors-gray-300);
	}

	.detail-row:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}

	.detail-action {
		flex: 0 0 auto;
		font-size: var(--ssk-font-size-xs);
		font-weight: 500;
		color: var(--ssk-colors-primary-500);
	}

	/* A parcel with no destination turns the whole row amber and wraps a second line
	   under it naming which parcel — never a silent disabled state (§6). */
	.detail-row.warn {
		flex-wrap: wrap;
		border-color: var(--ssk-colors-warning-300, #ffe170);
		background: var(--ssk-colors-warning-50, #fff9e6);
	}

	.detail-row.warn:hover {
		border-color: var(--ssk-colors-warning-400, #ffd94a);
	}

	.detail-row-warn {
		flex: 1 0 100%;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.25rem;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-warning-700, #c99d1a);
	}

	/* Platform logos are images, not DS icons, so they need their own box to sit on the
	   same baseline as the ssk-icon in the other card. */
	.channel-logo {
		width: 20px;
		height: 20px;
		object-fit: contain;
		flex: 0 0 auto;
	}

	.channel-logo.sm {
		width: 16px;
		height: 16px;
	}

	.link-note {
		display: flex;
		align-items: flex-start;
		gap: 0.375rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem 0.625rem;
		border: 1px dashed var(--ssk-colors-primary-500);
		border-radius: 8px;
		background: var(--ssk-colors-primary-50, #fdf0ea);
		font-family: var(--ssk-font-family-sans, 'Noto Sans Thai', Roboto, sans-serif);
		font-size: var(--ssk-font-size-xs);
		line-height: 1.4;
		color: var(--ssk-colors-gray-700, #374151);
	}

	.link-note b {
		font-weight: 600;
	}

	.order-head.merged {
		background-color: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		padding: 0.25rem 0.5rem;
		margin-bottom: 0.75rem;
	}

	/* The two inner rows lose their own spacing inside the merged block, and the second
	   line is indented to clear the strip's chevron (12px + 6px gap) so both lines start
	   on the same text column — measured 1048 vs 1070 before this. */
	.order-head.merged .description {
		padding: 0 0 0 1.375rem;
	}

	/* Collapsed strip: a single 2rem line in place of the ~168px block. */
	.top-summary {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		min-height: 2rem;
		padding: 0 0.25rem;
		background: none;
		border: none;
		border-radius: 4px;
		font: inherit;
		color: inherit;
		text-align: start;
		cursor: pointer;
	}

	.top-summary:hover {
		background-color: var(--ssk-colors-gray-100);
	}

	.top-summary:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: -2px;
	}

	.top-summary-text {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
	}

	/* Pushed to the right edge, and it is the part allowed to lose characters first:
	   the sale type is short and fixed, a customer name is not. */
	.top-summary-customer {
		margin-left: auto;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	#cart-top {
		flex: 0 0 auto;
	}

	/* Two selector cards, equal halves of one row. */
	/* One field per row, each with its own label — the layout the confirmed prototype
	   uses. A label costs 16px but buys back every abbreviation the 175px half-cards
	   needed. */
	.field {
		display: grid;
		gap: 0.25rem;
		padding-bottom: 0.5rem;
	}

	.quick-pickup-datetime-field {
		position: relative;
	}

	.quick-pickup-datetime-field :global(ssk-date-picker) {
		width: 100%;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-800);
	}

	.field-label {
		font-family: var(--ssk-font-family-sans, 'Noto Sans Thai', Roboto, sans-serif);
		font-size: var(--ssk-font-size-xs);
		line-height: 1.3;
		color: var(--ssk-colors-gray-500);
	}

	/* Label plus an inline action beside it, same row — e.g. the "เพิ่มตัวเลือกรับสินค้า"
	   trigger beside "รูปแบบการรับสินค้า", so it is its own class rather than folded into
	   .field-label itself. */
	.field-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.pile-adder-wrap {
		position: relative;
	}

	.field-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 2.75rem;
		box-sizing: border-box;
		padding: 0 0.75rem;
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		font-family: var(--ssk-font-family-sans, 'Noto Sans Thai', Roboto, sans-serif);
		text-align: left;
		cursor: pointer;
	}

	.field-control:hover {
		border-color: var(--ssk-colors-gray-300);
	}

	.field-control:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}

	.field-value {
		flex: 1 1 auto;
		min-width: 0;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		color: var(--ssk-colors-gray-800);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* The chosen customer: name and contact on their own lines, "นำออก" as a word rather
	   than an ✕, and the address row inside the same block. */
	.customer-block {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.125rem 0.5rem;
		/* 0.75rem horizontal matches .dest-trigger / .field-control's own side padding,
		   so this card's left/right edges line up with the other field cards in the
		   same column instead of sitting 2px narrower than its siblings. */
		padding: 0.5rem 0.75rem 0.75rem;
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}

	.customer-main {
		display: grid;
		gap: 0.125rem;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.customer-main:focus-visible,
	.customer-detach:focus-visible,
	.address-inline:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.customer-name {
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		line-height: 1.35;
		color: var(--ssk-colors-gray-800);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.customer-contact {
		font-size: var(--ssk-font-size-xs);
		line-height: 1.3;
		color: var(--ssk-colors-gray-500);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.customer-detach {
		align-self: start;
		padding: 0;
		border: 0;
		background: none;
		font-family: inherit;
		font-size: var(--ssk-font-size-xs);
		font-weight: 500;
		color: var(--ssk-colors-sky-600, #0284c7);
		cursor: pointer;
	}

	.address-inline {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.375rem;
		padding: 0.375rem 0.5rem;
		background: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 6px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.address-inline:hover {
		border-color: var(--ssk-colors-gray-300);
	}

	.badge-default {
		flex: 0 0 auto;
		font-size: var(--ssk-font-size-xs);
		font-weight: 500;
		color: var(--ssk-colors-success-600, #16a34a);
		background: var(--ssk-colors-success-50, #f0fdf4);
		border-radius: 999px;
		padding: 0.05rem 0.4rem;
	}

	.address-text {
		flex: 1 1 auto;
		min-width: 0;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-600);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.address-text.add {
		color: var(--ssk-colors-primary-500);
		font-weight: 500;
	}

	.field-control.empty .field-value {
		color: var(--ssk-colors-gray-500);
		font-weight: 400;
	}

	.selector {
		min-width: 0;
	}

	/* Card face shared by both: icon, two lines of text, chevron. */
	.selector-body {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		/* ssk-dropdown-button slots its content inside a <button> in its shadow root, and
		   the UA stylesheet resets that button to 13.33px Arial. Slotted text inherits
		   it, so the Thai label fell back glyph-by-glyph to whatever the system had and
		   rendered visibly thinner than the customer card next to it. Font size and
		   weight are pinned below; the family has to be pinned here too. */
		font-family: var(--ssk-font-family-sans, 'Noto Sans Thai', Roboto, sans-serif);
		min-width: 0;
		text-align: start;
	}

	.selector-text {
		display: grid;
		row-gap: 0.125rem;
		min-width: 0;
		/* Lets .option-body's own trailing "present in cart" ✓ sit flush right instead of
		   right after the hint text — same flex-row/flex-child split the pile badges use. */
		flex: 1;
	}

	.selector-title,
	.selector-hint {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.selector-title {
		/* 13px, not the 14px step: the DS face spends 32px on its own padding plus ~22px
		   on its chevron, leaving ~90px of a 175px card for the label, and
		   "จัดส่งจากหน้าร้าน" needs 97px at 14px. One step down fits every label whole —
		   both cards keep the same size, so they still read as one pair. */
		font-size: 13px;
		font-weight: 500;
		line-height: 1.35;
		color: var(--ssk-colors-gray-800);
	}

	/* States what the sale has actually become (Option B), next to what the cashier
	   picked — a derived fact, not a fourth option in the dropdown's own list. */
	.selector-mixed {
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-success-600);
		font-weight: 500;
		white-space: nowrap;
	}

	.selector-hint {
		font-size: var(--ssk-font-size-xs);
		line-height: 1.3;
		color: var(--ssk-colors-gray-500);
	}

	.option-body {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		width: 100%;
		/* Room for .option-present-check's own absolute right:0 so it never sits on top of
		   the hint text. */
		padding-right: 1.5rem;
		/* 28px of content + the DS's own 9px of padding = a 37px row: a comfortable
		   target, and the list reads as separate choices instead of one block. */
		min-height: 1.75rem;
	}

	/* flex's own margin-left:auto only pushes as far as .option-body's OWN box — and
	   ssk-dropdown-option's slot wrapper shrink-wraps that box to its content width rather
	   than stretching it to the full row, so the ✓ still landed right after the hint text
	   instead of at the row's actual right edge. Pinned via :global(ssk-dropdown-option)
	   below instead — that custom element IS the full-width row (its own hover/selected
	   background already spans edge to edge), so anchoring to IT reaches the true right
	   edge regardless of how its internal slot sizes our markup. */
	:global(ssk-dropdown-option) {
		position: relative;
	}

	.option-present-check {
		position: absolute;
		top: 50%;
		right: 0.75rem;
		transform: translateY(-50%);
	}

	/* A little air between rows as well, so the eye can separate them at a glance. */
	.field ssk-dropdown-option {
		display: block;
		padding: 0.0625rem 0;
	}

	.required {
		color: var(--ssk-colors-secondary-500);
	}

	/* Same copy/look as ModalPickupBranch's own .empty — ให้บริการนอกสถานที่'s branch list
	   is expanded inline here instead of in a separate modal, but a single-branch company
	   still has nothing else to pick. */
	.pick-empty {
		margin: 0;
		padding: 0.75rem;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-500);
		background: var(--ssk-colors-gray-50);
		border-radius: 10px;
	}

	/* Same look as DrawerCustomerAddress's own "เพิ่มที่อยู่ใหม่" link, next to the inline
	   address card list ให้บริการนอกสถานที่'s own "ที่อยู่ลูกค้า" tab reuses here. */
	.link {
		padding: 0;
		border: 0;
		background: none;
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		color: var(--ssk-colors-sky-600, #0284c7);
		text-decoration: underline;
		cursor: pointer;
	}

	/* The dropdown half: give the DS field the same height as the customer card. */
	/* The dropdown draws its border on a <button> inside ssk-dropdown-button's shadow
	   root, and that button is content-sized — no height var to set, and it does not
	   stretch to the grid row, which is why this half sat 5.4px shorter than the card
	   beside it. ssk-dropdown-button is a light-DOM child of ours though, so making its
	   host a flex container turns that button into a flex item, and the host's
	   min-height then decides both. Same 48px on both halves. */
	/* The DS dropdown is a field control now: full width, the same 44px as the buttons
	   around it. */
	.field ssk-dropdown-button {
		display: flex;
		min-height: 2.75rem;
	}

	.description {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.description .left,
	.description .right {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding-bottom: 0.5rem;
	}

	.tooltip-content {
		padding: 2px 4px;
		max-width: 20rem;
		word-wrap: break-word;
		white-space: normal;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ellipsis {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.tabs {
		/* ssk-tab-header is a custom element, so it defaults to display: inline and
		   vertical padding on it moves nothing — which is why the tab track sat flush
		   against the cards below no matter what padding was set here. */
		display: block;
		width: 100%;
		/* 12px is the panel's block rhythm: tabs → cards → list all sit on it. */
		padding-bottom: 0.75rem;
	}

	/* These hosts are focusable now, so give them a DS-coloured ring instead of the
	   UA default black outline. :focus-visible keeps it off for mouse clicks. */
	ssk-tab-button:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: -2px;
		border-radius: 8px;
	}

	.tab-text span {
		white-space: nowrap;
	}

	.tab-text {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3rem;
	}

	/* Same rationale as DrawerDelivery.svelte's own 480px block: the cart pane stays
	   side by side with the product pane at every width (Sale.svelte never stacks
	   them), so on a narrow phone this pane's own share of the screen is already
	   tight — Sale.svelte's own media query also shrinks the pane's min-width floor
	   to match. The generous side padding here (0.5rem item padding, 0.75rem field
	   padding) eats a disproportionate share of what's left, so trim it to keep the
	   Thai labels and prices on their line instead of wrapping/ellipsing sooner than
	   they need to. Declared last so it wins over the earlier base rules for these
	   same selectors at equal specificity. */
	@media (max-width: 480px) {
		.cart-item {
			padding: 0.375rem;
		}

		.field-control,
		.customer-block,
		.dest-trigger,
		.detail-row {
			padding-left: 0.5rem;
			padding-right: 0.5rem;
		}
	}
</style>
