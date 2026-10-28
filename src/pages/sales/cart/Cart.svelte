<script lang="ts">
	import {
		calculateSummary,
		calculateTotalPrice,
		cartListInfo,
		GetExistingCart
	} from '$stores/cart/cart';
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import CartItem from './CartItem.svelte';
	import CartReceivePiles from './CartReceivePiles.svelte';
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
		SaleChannelType,
		SaleChannelUI,
		saleChannelToPayload,
		paymentMethods,
		salesChannels,
		sameDayDeliveries,
		standardDeliveries
	} from '$lib/entities/order/order';
	import {
		clearOrderMeta,
		orderData,
		setPartyInfoToOrder,
		setSalesChannel
	} from '$stores/order/order';
	import { orderDeliveryI18nKey } from '$utils/i18n-keys';
	import { countriesList } from '$stores/country';
	import DrawerCustomerAddress from './section/DrawerCustomerAddress.svelte';
	import DrawerOnline from './section/DrawerOnline.svelte';
	import ModalPickupBranch from './section/ModalPickupBranch.svelte';
	import { currentCompany } from '$stores/company/current-company';
	import { currentStore } from '$stores/store/current-store';
	import { addressToDisplay } from '$utils/format-address';
	import { maskPhoneMiddle } from '$utils/format-phone';
	import { formatPriceWithBath } from '$utils/format-number';
	import type { Store } from '$lib/entities/store/store';
	import DrawerDelivery from './section/DrawerDelivery.svelte';
	import DeliveryGroupCards from './section/DeliveryGroupCards.svelte';
	import {
		activeDeliveryGroupId,
		deliveryGroups,
		deliverySummary,
		enableGroupOrder,
		hasSplitDelivery,
		physicalKindFor,
		showDeliveryDetail,
		resetDeliveryGroups,
		setActiveDeliveryGroup,
		syncDeliveryGroups,
		updateDeliveryGroup
	} from '$stores/order/delivery-group';
	import {
		DeliveryGroupKind,
		ItemFulfilmentType,
		handoverItemQty,
		itemFulfilmentOf,
		kindNeedsShippingMethod
	} from '$lib/entities/order/delivery-group';
	import { isMultiParcelEnabled } from '$lib/feature-flags';

	export let buyer: PartyInfo | undefined;
	export let fullfilmentType: string;

	var total: number = 0;
	var discount: number = 0;
	var summary: number = 0;
	var cartList: TCartItem[];
	// One drawer holds customer + address; this only decides which half it lands on.
	let showDrawerCustomer: boolean = false;
	let customerDrawerOpenOn: 'customer' | 'address' = 'customer';
	let showDrawerOnlineChannel: boolean = false;
	let showPickupModal: boolean = false;
	let showDeliveryDrawer: boolean = false;
	let openMethodGroupId: string | undefined;
	// Set only when the cashier hit "เลือกที่อยู่จัดส่ง" on a parcel in DrawerDelivery
	// while no customer was picked yet — onCreateAddress(groupId) below stashes which
	// parcel asked, closes that drawer and sends the cashier to pick a customer first.
	// The moment a selectedAddress exists afterwards (new customer's own default, or one
	// the cashier just picked), this parcel gets stamped with it automatically and the
	// cashier is dropped back into the delivery drawer instead of having to open it again
	// and pick the very address they just set.
	let pendingAddressGroupId: string | undefined;
	// Where the customer will collect a pick-up-later order. The company's branches are
	// already in memory from the company load, so the picker needs no extra request.
	let pickupStoreId: string = '';
	// DigitalDelivery only makes sense when every line in the cart is a digital product —
	// offering it otherwise would promise an email-only sale for items that still need a
	// physical destination. OnSite has no such gate; any POS sale can dispatch staff out.
	$: fullfilmentOptions = [
		FullfilmentType.PickupImmediate,
		FullfilmentType.PickupLater,
		FullfilmentType.ShopDelivery,
		FullfilmentType.OnSite,
		...(cartList?.length > 0 &&
		cartList.every((i) => itemFulfilmentOf(i.fulfilmentType) === ItemFulfilmentType.Digital)
			? [FullfilmentType.DigitalDelivery]
			: [])
	];
	// The channel / fulfilment / customer block collapses to a one-line summary so the
	// list gets the space back. A view toggle, not a data change: nothing selected is
	// cleared, and the collapsed strip states what it is holding, so the cashier can
	// still read the sale's context — and click it to open the block again.
	let topCollapsed = false;
	// LINE OA is the spec's default sub-channel for an online sale.
	const DEFAULT_SUB_CHANNEL = 'line';
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
			hint: 'ให้บริการนอกสถานที่ลูกค้า',
			label: 'ให้บริการที่สถานที่ลูกค้า'
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
	$: pickupBranch = branches.find((b) => b.id === pickupStoreId);
	$: needsPickupBranch = isPos && fullfilmentType === FullfilmentType.PickupLater;
	// ShopDelivery/OnSite both need a destination + a fee, same as their own per-group
	// card already does inside the drawer — shown even for the ordinary, unsplit sale
	// (today's showDeliveryDetail/zero-cost path hides ALL delivery UI until a real split
	// or a digital item exists, which left these two fulfilment types with nowhere to
	// confirm an address/fee at all until the cashier happened to open the drawer some
	// other way).
	$: needsDeliveryInfo =
		isPos &&
		(fullfilmentType === FullfilmentType.ShopDelivery || fullfilmentType === FullfilmentType.OnSite);
	// The one-and-only group a plain, unsplit sale already has (syncDeliveryGroups' own
	// "default group" step) — reused here instead of duplicating its address/fee fields.
	$: singleDeliveryGroup = $deliveryGroups[0];
	// Safety net for DeliveryGroupCards' own remove button (the main-page cards, not this
	// drawer) — DrawerDelivery.svelte already closes itself in the same tick it removes
	// its own last group, but a removal from the cards behind it must close this drawer
	// too, if it happened to be open at the same time.
	$: if (showDeliveryDrawer && $deliveryGroups.length <= 1) showDeliveryDrawer = false;

	function methodLabel(method?: string): string {
		const found = [...standardDeliveries, ...sameDayDeliveries].find((o) => o.value === method);
		return found?.label.replace(/<br\s*\/?>/gi, ' ') ?? method ?? '';
	}

	const onSelectPickupBranch = (branch: Store) => {
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
	// The parcel that sent the cashier off to pick a customer (see pendingAddressGroupId
	// and onCreateAddress below) finally has an address to inherit — stamp it on without
	// making the cashier open the drawer again and pick the very address they just set.
	$: if (pendingAddressGroupId && selectedAddress) {
		updateDeliveryGroup(pendingAddressGroupId, {
			recipientAddressId: idAddress,
			recipientAddress: addressToDisplay(selectedAddress),
			recipientName: selectedAddress.contactName ?? buyer?.name
		});
		pendingAddressGroupId = undefined;
		showDeliveryDrawer = true;
	}

	// A voucher can't be emailed to nobody — a digital item in the cart needs a customer
	// the moment it's picked, not at the pay button (§3 "ประกาศตั้งแต่ตอนหยิบของ").
	$: hasDigitalItem = (cartList ?? []).some(
		(i) => itemFulfilmentOf(i.fulfilmentType) === ItemFulfilmentType.Digital
	);
	// A service item is an on-site visit — staff needs an address to go to, which rides on
	// the customer's address book, same reasoning as the reference prototype's own
	// `customerRequired = channel !== 'POS' || hasService` (FULFILLMENT_LOGIC.md §4).
	$: hasServiceItem = (cartList ?? []).some(
		(i) => itemFulfilmentOf(i.fulfilmentType) === ItemFulfilmentType.Service
	);
	// A customer is mandatory unless the buyer walks out with the goods immediately.
	// A customer is mandatory for every ONLINE / LINK_BILL sale, and for POS unless the
	// buyer walks out with the goods immediately — and always once a digital or service
	// item is in the cart, pickup-immediate or not. Those last two clauses are
	// multi-parcel's own rule (an item needs an email/address to send itself to), so they
	// drop out with the flag — a production cashier must not be gated on a requirement
	// nothing on screen explains.
	$: customerRequired =
		fullfilmentType !== FullfilmentType.PickupImmediate ||
		!isPos ||
		(isMultiParcelEnabled() && (hasDigitalItem || hasServiceItem));
	$: customerContact =
		[maskPhoneMiddle(buyer?.phone), buyer?.email].filter(Boolean).join(' · ') || 'ผูกลูกค้าแล้ว';
	$: customerTooltip = buyer?.name
		? [buyer.name, buyer.phone, buyer.email].filter(Boolean).join(' · ')
		: 'เลือกลูกค้า';

	// Delivery groups mirror the cart + fulfilment + buyer on every change, so the S2
	// row and the drawer always reflect the current split (see delivery-group.ts). A
	// shop sale that never becomes a delivery (pickup, POS pickup-later) keeps isDelivery
	// false, which is what makes syncDeliveryGroups leave the group list empty and the
	// row below not render at all — the 80-90% case pays for none of this.
	$: isDelivery = (isPos && fullfilmentType === FullfilmentType.ShopDelivery) || isOnline;
	// "รับบางส่วน" (Option B) only ever applies to a POS จัดส่งให้ลูกค้า sale — no fourth
	// FullfilmentType is added for it. order-flow.ts already maps ShopDelivery to the
	// deliver-from-store flow, which is the correct order-level flow for a sale that part-
	// ships; a new enum value would ride into saleChannel.saleOrigin with no backend
	// behaviour behind it at all.
	$: allowPartialReceive = isPos && fullfilmentType === FullfilmentType.ShopDelivery;
	// Named (not inlined) so enableGroupOrder's own forced re-sync — createGroupOrder /
	// addAnotherGroup below — can pass the exact same ctx the reactive statement already
	// builds, instead of a second, driftable copy of these fields.
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
		recipientEmail: buyer?.email
	};
	$: syncDeliveryGroups(cartList ?? [], deliveryCtx);

	// "at least one fee is known" is not the same question deliverySummary answers
	// (feeUnknown is true the moment ANY group is still unknown) — the row needs to
	// know whether to show a total at all, so it reads the groups directly. A pickup or
	// digital group's fee is 0 by definition, which IS "known" — counting it here would
	// print "· ฿0" on a walk-in sale that has no shipping fee to speak of at all, so
	// only a group that could actually need a courier counts.
	$: hasKnownDeliveryFee = $deliveryGroups.some(
		(g) => kindNeedsShippingMethod(g.kind) && g.shippingFee !== undefined
	);
	// A thing handed across the counter has no address, no fee and no tracking — calling
	// it a พัสดุ would be a lie, so the handover pile is reported as pieces instead.
	$: handoverQty = $deliverySummary.handoverGroup
		? handoverItemQty($deliverySummary.handoverGroup, cartList ?? [])
		: 0;
	$: deliverySummaryText = [
		handoverQty > 0 ? `รับเลย ${handoverQty} ชิ้น` : '',
		$deliverySummary.parcelCount > 0 ? `${$deliverySummary.parcelCount} พัสดุ` : '',
		hasKnownDeliveryFee ? formatPriceWithBath($deliverySummary.totalFee) : ''
	]
		.filter(Boolean)
		.join(' · ');
	// The phrase from the approved prototype's fulfilment selector, shown as a derived
	// state rather than as a fourth fulfilment option a cashier would have to choose
	// before knowing which lines even ended up in stock.
	$: isMixedReceive = allowPartialReceive && handoverQty > 0 && $deliverySummary.parcelCount > 0;
	// The reason line names the actual blocker: a digital parcel is missing an email,
	// never an address.
	$: firstMissingGroup = $deliverySummary.missing[0];
	$: firstMissingReason =
		firstMissingGroup?.kind === DeliveryGroupKind.Digital
			? 'ยังไม่มีอีเมลผู้รับ'
			: 'ยังไม่ระบุที่อยู่';

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
		fullfilmentType = option;
		// saleOrigin carries the fulfilment type for offline sales and the sales
		// channel (line/facebook/…) for online ones, so pin the type when writing a
		// fulfilment value into it.
		setSalesChannel({
			...$orderData.saleChannel,
			saleOrigin: option,
			type: SaleChannelType.Offline
		});
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
		fullfilmentType = FullfilmentType.PickupImmediate;
		subChannel = next === SaleChannelUI.Online ? DEFAULT_SUB_CHANNEL : '';
		setSalesChannel({
			...$orderData.saleChannel,
			saleOrigin: next === SaleChannelUI.Online ? subChannel : FullfilmentType.PickupImmediate,
			type: saleChannelToPayload(next)
		});
	};

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
		showDrawerCustomer = !showDrawerCustomer;
	}

	// Both panel rows lead to the same drawer; the row only says which half was asked for.
	function openCustomerDrawer(half: 'customer' | 'address') {
		customerDrawerOpenOn = half;
		showDrawerCustomer = true;
	}

	function toggleDrawerOnlineChannel() {
		showDrawerOnlineChannel = !showDrawerOnlineChannel;
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

	function toggleDeliveryDrawer() {
		showDeliveryDrawer = !showDeliveryDrawer;
	}

	function openStandardDeliveryMethod() {
		openMethodGroupId = singleDeliveryGroup?.id;
		showDeliveryDrawer = true;
	}

	// Manual entry point for a voluntary split: a soft-split parcel pushes
	// deliveryGroups from 1 to 2 entries, which is what flips showDeliveryDetail
	// (and the S2 row it gates) to true on its own — nothing else here needs to react.
	// enableGroupOrder (not addUserDeliveryGroup) because a pickup/pickup-later sale's
	// own syncDeliveryGroups guard clears groups with no digital item in the cart — this
	// is the one call that tells it not to, for exactly this cashier-started split.
	function createGroupOrder() {
		// Matches how the rest of THIS sale is already being collected (pickup now/later/
		// ship) — a new parcel must never default to Shipping on a pickup sale. Passing
		// cartList/deliveryCtx is what makes whatever is ALREADY in the cart show up as its
		// own "กลุ่ม 1" immediately, instead of staying invisible until some unrelated cart
		// edit happens to re-trigger the reactive sync above on its own.
		const id = enableGroupOrder(
			cartList ?? [],
			deliveryCtx,
			physicalKindFor(fullfilmentType, isDelivery)
		);
		setActiveDeliveryGroup(id);
		showDeliveryDrawer = true;
	}

	// Adding a group once already split doesn't need to open the drawer — the cashier
	// taps the new (empty, now-active) card and starts shopping straight into it.
	function addAnotherGroup() {
		const id = enableGroupOrder(
			cartList ?? [],
			deliveryCtx,
			physicalKindFor(fullfilmentType, isDelivery)
		);
		setActiveDeliveryGroup(id);
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

	const onClickSelectCustomerOnline = (p: PartyInfo) => {
		buyer = p;
	};

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

<DrawerCustomerAddress
	showDrawer={showDrawerCustomer}
	toggleDrawer={toggleDrawerCustomer}
	{buyer}
	bind:addresses
	bind:idAddress
	needsAddress={isPos && fullfilmentType === FullfilmentType.ShopDelivery}
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

<DrawerOnline
	bind:showDrawer={showDrawerOnlineChannel}
	bind:buyerInput={buyer}
	bind:idAddress
	toggleDrawer={toggleDrawerOnlineChannel}
	{onClickSelectCustomerOnline}
/>

<DrawerDelivery
	showDrawer={showDeliveryDrawer}
	toggleDrawer={toggleDeliveryDrawer}
	{addresses}
	{branches}
	defaultPickupStoreId={pickupStoreId}
	{openMethodGroupId}
	buyerName={buyer?.name ?? ''}
	hasBuyer={!!buyer}
	onCreateAddress={(groupId) => {
		pendingAddressGroupId = groupId;
		toggleDeliveryDrawer();
		openCustomerDrawer('address');
	}}
	onEditCustomer={() => {
		toggleDeliveryDrawer();
		openCustomerDrawer('customer');
	}}
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
							{#if orderDeliveryI18nKey(fullfilmentType)}
								<ssk-i18n-translate
									key={orderDeliveryI18nKey(fullfilmentType)}
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							{:else}
								{fullfilmentMeta[fullfilmentType]?.label ?? ''}
							{/if}
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
			{:else if isPos && !$hasSplitDelivery}
				<!-- Once a group order exists, each group picks its OWN fulfilment type
				     (DrawerDelivery's per-group dropdown) — a single sale-level choice here
				     would no longer describe the sale, which can now hold several at once. -->
				<div class="field">
					<span class="field-label">รูปแบบการรับสินค้า</span>
					<ssk-dropdown
						class="selector"
						size="sm"
						width="100%"
						optionswidth="100%"
						value={fullfilmentType}
						aria-label="รูปแบบการรับสินค้า"
						data-testid="sales.fulfilment.select"
					>
						<ssk-dropdown-button slot="selected" value={fullfilmentType}>
							<span class="selector-body">
								<ssk-icon
									name={fullfilmentMeta[fullfilmentType]?.icon ?? 'outline-shopping-bag'}
									size="md"
									themeColor="primary"
								></ssk-icon>
								<span class="selector-title">
									{#if orderDeliveryI18nKey(fullfilmentType)}
										<ssk-i18n-translate
											key={orderDeliveryI18nKey(fullfilmentType)}
											lang={$currentLanguage.code}
											fallbackLang="default"
										/>
									{:else}
										{fullfilmentMeta[fullfilmentType]?.label ?? ''}
									{/if}
								</span>
								{#if isMixedReceive}<span class="selector-mixed">· รับบางส่วน</span>{/if}
							</span>
						</ssk-dropdown-button>
						{#each fullfilmentOptions as opt}
							<ssk-dropdown-option
								value={opt}
								aria-selected={opt === fullfilmentType}
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
					{#if isPos && !$showDeliveryDetail && cartList.length > 0}
						<!-- Voluntary split: today a cashier can only ever get the delivery drawer
						     opened on them by an auto-split (digital item or mixed origin). This is
						     the only manual entry point, so it is gated on the same condition the
						     S2 row itself depends on being false (not split yet). Available for all
						     three POS fulfilment types (pickup now/later/ship) — enableGroupOrder
						     (not addUserDeliveryGroup) is what keeps the resulting split alive for
						     the two pickup fulfilments, whose own sync guard otherwise clears any
						     group with no digital item in the cart. -->
						<ssk-button
							size="sm"
							variant="ghost"
							on:click={createGroupOrder}
							data-testid="sales.delivery.creategroup"
						>
							สร้างคำสั่งซื้อกลุ่ม
						</ssk-button>
					{/if}
				</span>

				{#if buyer?.name}
					<div class="customer-block">
						<button
							type="button"
							class="customer-main"
							title={customerTooltip}
							on:click={isOnline ? toggleDrawerOnlineChannel : () => openCustomerDrawer('customer')}
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

						{#if isPos && fullfilmentType === FullfilmentType.ShopDelivery}
							<!-- The address belongs to the customer, so it sits inside their block —
							     one row, tappable, opening the same drawer on its address half. -->
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
						on:click={isOnline ? toggleDrawerOnlineChannel : () => openCustomerDrawer('customer')}
						data-testid="sales.customer.open"
					>
						<ssk-icon name="outline-user" size="sm" themeColor="stroke"></ssk-icon>
						<span class="field-value">ลูกค้าหน้าร้าน</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				{/if}
			</div>

			{#if $showDeliveryDetail}
				{#if !$hasSplitDelivery}
					<!-- The one row S2 adds to the whole cart panel — only for the lone-digital-
					     parcel case (an e-voucher needs an email even alone in the cart). Once a
					     real split exists, the group cards below are the whole "การจัดส่ง" picture
					     on their own — this row would just repeat them as a redundant aggregate. -->
					<div class="field">
						<span class="field-label">การจัดส่ง</span>
						<button
							type="button"
							class="detail-row"
							class:warn={$deliverySummary.missing.length > 0}
							on:click={() => (showDeliveryDrawer = true)}
							data-testid="sales.delivery.open"
						>
							<ssk-icon
								name="outline-truck"
								size="sm"
								themeColor={$deliverySummary.missing.length > 0 ? 'warning' : 'primary'}
							></ssk-icon>
							<span class="field-value">{deliverySummaryText}</span>
							<span class="detail-action">จัดการ</span>
							{#if $deliverySummary.missing.length > 0}
								<span class="detail-row-warn">
									<ssk-icon name="outline-exclamation-triangle" size="xs" themeColor="warning"
									></ssk-icon>
									พัสดุ {$deliverySummary.firstMissingSeq}
									{firstMissingReason}
								</span>
							{/if}
						</button>
					</div>
				{/if}
			{/if}

			{#if isLinkBill}
				<!-- The link carries the rest of the journey: the buyer fills in their own phone
				     and address there, and the link stops working after 30 minutes. -->
				<div class="link-note" data-testid="sales.linkbill.note">
					<ssk-icon name="outline-link" size="sm" themeColor="primary"></ssk-icon>
					<span>
						ลูกค้าจะกรอกเบอร์โทรและที่อยู่เองในลิงก์ · ลิงก์หมดอายุใน <b>30 นาที</b>
					</span>
				</div>
			{/if}

			<!-- Rows that only exist when the sale needs them, full width under the cards. -->
			{#if needsPickupBranch}
				<!-- "รับภายหลัง" needs a place to come back to. One line states the branch and
				     enough of its address to tell branches apart; the full list (with each
				     address on its own lines) lives in the modal (picking a branch is the same
				     kind of job as picking an address — one choice out of several multi-line
				     options, better suited to a card list than a native dropdown menu). -->
				<div class="field">
					<span class="field-label">สาขาที่รับสินค้า</span>
					<button
						type="button"
						class="dest-trigger"
						on:click={() => (showPickupModal = true)}
						data-testid="sales.pickup.open"
					>
						<ssk-icon name="outline-building-storefront" size="sm" themeColor="primary"></ssk-icon>
						<span class="dest-trigger-value">
							{pickupBranch ? `รับที่สาขา ${pickupBranch.name}` : 'เลือกสาขาที่ลูกค้าจะมารับ'}
						</span>
						<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				</div>
			{/if}

			{#if needsDeliveryInfo}
				<!-- ShopDelivery/OnSite's own destination+fee — the same two fields the per-group
				     card inside the drawer already shows, surfaced here too so the ordinary,
				     unsplit 80-90% sale isn't the one case with nowhere to confirm them short of
				     opening the drawer some other way first. Tapping either row just opens that
				     same drawer — there is only one group to manage yet, so the cashier lands
				     straight on its one card. -->
				<div class="field">
					<span class="field-label">ข้อมูลการจัดส่ง</span>
					{#if !selectedAddress}
						<button
							type="button"
							class="dest-trigger empty"
							on:click={() => openCustomerDrawer('address')}
							data-testid="sales.deliveryinfo.address.open"
						>
							<ssk-icon name="outline-exclamation-triangle" size="xs" themeColor="error"
							></ssk-icon>
							<span class="dest-trigger-value">ลูกค้ายังไม่มีที่อยู่ — กรุณาเพิ่มที่อยู่จัดส่ง</span>
						</button>
					{/if}
					{#if fullfilmentType === FullfilmentType.ShopDelivery}
						<button
							type="button"
							class="dest-trigger"
							on:click={openStandardDeliveryMethod}
							data-testid="sales.deliveryinfo.method.open"
						>
							<ssk-icon name="outline-truck" size="sm" themeColor="primary"></ssk-icon>
							<span class="dest-trigger-value">
								{#if singleDeliveryGroup?.method}
									{methodLabel(singleDeliveryGroup.method)} ·
									{singleDeliveryGroup.shippingFee !== undefined
										? formatPriceWithBath(singleDeliveryGroup.shippingFee)
										: 'ยังไม่ระบุค่าส่ง'}
								{:else}
									ระบุขนส่งและค่าจัดส่ง
								{/if}
							</span>
							<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
						</button>
					{:else}
						<button
							type="button"
							class="dest-trigger"
							on:click={() => (showDeliveryDrawer = true)}
							data-testid="sales.deliveryinfo.travelfee.open"
						>
							<ssk-icon name="outline-wrench-screwdriver" size="sm" themeColor="primary"
							></ssk-icon>
							<span class="dest-trigger-value">
								ค่าเดินทาง ·
								{singleDeliveryGroup?.shippingFee !== undefined
									? formatPriceWithBath(singleDeliveryGroup.shippingFee)
									: 'ไม่ระบุค่าเดินทาง'}
							</span>
							<ssk-icon name="solid-chevron-right" size="xs" themeColor="stroke"></ssk-icon>
						</button>
					{/if}
				</div>
			{/if}
			{#if isOnline && buyer?.name}
				<ssk-button
					size="xs"
					variant="outline"
					width="full"
					themeColor="button"
					on:click={toggleDrawerOnlineChannel}
				>
					<ssk-icon slot="postfix" name="solid-chevron-right" themeColor="stroke"></ssk-icon>
					<ssk-text size="sm" color="gray.800">
						{getLabelFromValue($orderData.saleChannel?.saleOrigin, 'salesChannels')}
						| {getLabelFromValue($orderData.paymentType, 'paymentMethods')}
						| {getLabelFromValue($orderData.deliveries?.[0]?.method, 'standardDeliveries')}
					</ssk-text>
				</ssk-button>
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
<div class={`cart-item${cartList.length > 0 && !$hasSplitDelivery ? '' : '-no-scroll'}`}>
	{#if $hasSplitDelivery}
		<!-- Keep the item summary and group section outside the collapsible sale setup so
		     collapsing the top leaves the order groups immediately visible. -->
		<div class="group-order-head">
			<span class="field-label">คำสั่งขายกลุ่ม</span>
			<ssk-button
				size="sm"
				variant="ghost"
				on:click={addAnotherGroup}
				data-testid="sales.delivery.addgroup"
			>
				<ssk-icon name="outline-plus" size="xs"></ssk-icon>
				เพิ่มกลุ่ม
			</ssk-button>
		</div>
		<DeliveryGroupCards
			groups={$deliveryGroups}
			items={cartList ?? []}
			activeId={$activeDeliveryGroupId}
			on:activate={(e) =>
				setActiveDeliveryGroup($activeDeliveryGroupId === e.detail ? undefined : e.detail)}
			on:open={() => (showDeliveryDrawer = true)}
		/>
	{:else if cartList.length > 0}
		{#if allowPartialReceive}
			<CartReceivePiles items={cartList} />
		{:else}
			<CartItem items={cartList} />
		{/if}
	{:else}
		<EmptyCart />
	{/if}
</div>

<ssk-divider class="cart-footer-divider" size="xs" margin="md" />

<CartFooter
	hasItem={cartList.length > 0}
	isBuyerValid={fullfilmentType === FullfilmentType.ShopDelivery
		? !!buyer?.name && !!buyer?.address
		: !!buyer?.name}
	isDeliveryLater={fullfilmentType === FullfilmentType.ShopDelivery ||
		fullfilmentType === FullfilmentType.PickupLater}
	{fullfilmentType}
	{total}
	{discount}
	{summary}
	{isOnline}
	{isLinkBill}
	pickupStoreId={needsPickupBranch ? pickupStoreId : ''}
/>

<style>
	.right > ssk-text > span {
		color: var(--ssk-colors-primary-500);
	}

	.cart-item {
		/* The one region that scrolls, and the only one that yields. `flex: 1 1 0` (not
		   `auto`): a basis of 0 means a long list cannot claim its own content height
		   and push the totals and the pay button out of the panel — it takes what is
		   left over and scrolls inside that. The floor is about one row, low enough
		   that the money and the two terminal buttons below always fit first. */
		flex: 1 1 0;
		min-height: 3.25rem;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.cart-item-no-scroll {
		flex: 1 1 0;
		min-height: 3.25rem;
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

	.field-label {
		font-family: var(--ssk-font-family-sans, 'Noto Sans Thai', Roboto, sans-serif);
		font-size: var(--ssk-font-size-xs);
		line-height: 1.3;
		color: var(--ssk-colors-gray-500);
	}

	/* Label plus an inline action beside it, same row — only the customer field needs
	   this today (the "สร้างคำสั่งซื้อกลุ่ม" entry point), so it is its own class rather
	   than folded into .field-label itself. */
	.field-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	/* Same shape as .field-label-row, but a separate rule: this one sits directly above
	   the group cards rather than inside a .field block, so it carries its own bottom
	   spacing instead of .field's. */
	.group-order-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-bottom: 0.5rem;
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
		padding: 0.5rem 0.625rem 0.625rem;
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
		/* 28px of content + the DS's own 9px of padding = a 37px row: a comfortable
		   target, and the list reads as separate choices instead of one block. */
		min-height: 1.75rem;
	}

	/* A little air between rows as well, so the eye can separate them at a glance. */
	.field ssk-dropdown-option {
		display: block;
		padding: 0.0625rem 0;
	}

	.required {
		color: var(--ssk-colors-secondary-500);
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
