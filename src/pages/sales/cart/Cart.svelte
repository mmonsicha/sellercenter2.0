<script lang="ts">
	import {
		calculateSummary,
		calculateTotalPrice,
		cartListInfo,
		GetExistingCart
	} from '$stores/cart/cart';
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import CartItem from './CartItem.svelte';
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
	import type { Store } from '$lib/entities/store/store';

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
	// Where the customer will collect a pick-up-later order. The company's branches are
	// already in memory from the company load, so the picker needs no extra request.
	let pickupStoreId: string = '';
	let fullfilmentOptions = Object.values(FullfilmentType);
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
	const fullfilmentMeta: Record<string, { icon: string; hint: string }> = {
		[FullfilmentType.PickupImmediate]: { icon: 'outline-shopping-bag', hint: 'รับสินค้าไปเลย' },
		[FullfilmentType.PickupLater]: { icon: 'outline-clock', hint: 'ลูกค้ามารับภายหลัง' },
		[FullfilmentType.ShopDelivery]: { icon: 'outline-truck', hint: 'ร้านจัดส่งให้ลูกค้า' }
	};

	$: isPos = channel === SaleChannelUI.Pos;
	$: isOnline = channel === SaleChannelUI.Online;
	$: isLinkBill = channel === SaleChannelUI.LinkBill;
	$: subChannelOption = salesChannels.find((c) => c.value === subChannel);

	$: branches = ($currentCompany?.stores ?? []) as Store[];
	// The branch ringing up the sale is the sane default: most customers come back to
	// the shop they bought from.
	$: if (!pickupStoreId && $currentStore?.id) pickupStoreId = $currentStore.id;
	$: pickupBranch = branches.find((b) => b.id === pickupStoreId);
	$: needsPickupBranch = isPos && fullfilmentType === FullfilmentType.PickupLater;

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

	// A customer is mandatory unless the buyer walks out with the goods immediately.
	// A customer is mandatory for every ONLINE / LINK_BILL sale, and for POS unless the
	// buyer walks out with the goods immediately.
	$: customerRequired = fullfilmentType !== FullfilmentType.PickupImmediate || !isPos;
	$: customerContact =
		[maskPhoneMiddle(buyer?.phone), buyer?.email].filter(Boolean).join(' · ') || 'ผูกลูกค้าแล้ว';
	$: customerTooltip = buyer?.name
		? [buyer.name, buyer.phone, buyer.email].filter(Boolean).join(' · ')
		: 'เลือกลูกค้า';

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
		// channel's defaults — initializeOrderState() already clears payment + buyer.
		initializeOrderState();
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

	function initializeOrderState() {
		resetBuyer();
		clearOrderMeta();
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
						{channels.find((c) => c.value === channel)?.label}
						{#if isPos && orderDeliveryI18nKey(fullfilmentType)}
							· <ssk-i18n-translate
								key={orderDeliveryI18nKey(fullfilmentType)}
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
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
			{:else if isPos}
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
									{/if}
								</span>
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
				<span class="field-label">
					ลูกค้า{#if customerRequired}<span class="required">*</span>{/if}
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
				     address on its own lines) lives in the drawer. -->
				<div class="field">
					<span class="field-label">สถานที่รับสินค้า</span>
					<button
						type="button"
						class="detail-row"
						on:click={() => (showPickupModal = true)}
						data-testid="sales.pickup.open"
					>
						<ssk-icon name="outline-building-storefront" size="sm" themeColor="primary"></ssk-icon>
						<span class="field-value">
							{pickupBranch?.name ?? 'เลือกสาขาที่ลูกค้าจะมารับ'}
						</span>
						<span class="detail-action">เปลี่ยน</span>
					</button>
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
<div class={`cart-item${cartList.length > 0 ? '' : '-no-scroll'}`}>
	{#if cartList.length > 0}
		<CartItem items={cartList} />
	{:else}
		<EmptyCart />
	{/if}
</div>

<ssk-divider size="xs" margin="md" />

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
		/* Fill whatever the panel has left, in every state — folding the header hands
		   this block that space, unfolding takes it back, and no interaction of its own
		   is needed. The floor is one item row (68px) plus its gap, so however many
		   blocks a channel adds above, a row stays visible and the totals below shrink
		   and scroll instead. */
		flex: 1 1 auto;
		min-height: 5.5rem;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.cart-item-no-scroll {
		flex: 1 1 auto;
		min-height: 0;
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
</style>
