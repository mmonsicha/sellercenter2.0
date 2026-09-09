<script lang="ts">
	import {
		customerAddressToString,
		type Address,
		type Customer
	} from '$lib/entities/customer/customer';
	import { generateEmptyAddress } from '$lib/entities/customer/generator';
	import {
		ShippingType,
		FullfilmentType,
		newPartyInfo,
		SaleChannelType,
		type PartyInfo,
		type SaleChannel,
		type Delivery,
		Mode
	} from '$lib/entities/order/order';
	import { currentCompany } from '$stores/company/current-company';
	import { countriesList } from '$stores/country';
	import {
		clearOrderMeta,
		orderData,
		setDelivery,
		setPartyInfoToOrder,
		setPaymentType,
		setSalesChannel
	} from '$stores/order/order';
	import { AxiosError } from 'axios';
	import {
		getCustomerByIdWithAccess,
		updateCustomerWithAccess
	} from '../../../../service/customer-book-v2-rest';
	import CustomerCreate from './CustomerCreate.svelte';
	import CustomerList from './CustomerList.svelte';
	import DropdownAddress from './DropdownAddress.svelte';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import AddressPanel from './AddressPanel.svelte';
	import ChannelDetail from '$components/drawer/ChannelDetail.svelte';
	import { setAction, setUnsavedChanges, unsavedChanges } from '$stores/saved-changes';
	import { checkPermissionsEach } from '$utils/permission';
	import { currentStore } from '$stores/store/current-store';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';

	export let showDrawer: boolean = false;
	export let buyerInput: PartyInfo = newPartyInfo();
	export let idAddress: string = '';
	let buyer: PartyInfo = { ...buyerInput };
	export let toggleDrawer: () => void;
	export let onClickSelectCustomerOnline: (p: PartyInfo) => void = () => {};

	const toastStore = getContext<ToastStore>('toast');

	let shippingGroup: ShippingType.Standard | ShippingType.SameDay = ShippingType.Standard;
	let drawerEl: HTMLElement;
	let mode: Mode = Mode.Online;
	let selectedChannel: string = 'unknown';
	let selectedPayment: string = 'unknown';
	let selectedProvider: string = 'unknown';
	let shippingFee: string = '';
	let hasChanged: boolean = false;
	let canCreate = false;

	// customer
	let resetCustomerTrigger: boolean = false;
	let submitCustomerTrigger: boolean = false;
	let loadListTrigger: boolean = false;
	let disabledCustomerSubmit: boolean = true;
	let customer: Partial<Customer> = {};

	const FORM_ADDRESS_NAME = 'sales-online-address';
	const FORM_NAME = 'sales-online';

	const setCustomer = (c: Customer) => {
		customer = c;
	};

	$: if (buyer.refId && $currentCompany) {
		loadCustomer();
	}

	const loadCustomer = async (): Promise<Customer> => {
		const resp = await getCustomerByIdWithAccess(
			buyer.refId!,
			`sellsuki.company:${$currentCompany.id}`
		);
		setCustomer(resp);
		return resp;
	};

	// address
	let addresses: Address[] = [];
	let addrIdx: number;
	const setAddress = (ad: Address[]) => {
		addresses = ad;
	};

	let address: Partial<Address> | undefined = undefined;
	let resetAddressTrigger: boolean = false;
	let disabledAddressSubmit: boolean = true;

	$: disabledSubmit = !buyer?.name || !buyer.address;

	const selectCustomer = (c: Customer) => {
		if (!c.firstName || !c.lastName) return;

		customer = c;

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
			idAddress = defaultAddress?.id?.toString() ?? '';
			setAddress(c.addresses ?? []);
			setUnsavedChanges(true, FORM_NAME);
			switchMode(Mode.Online);
		}
	};

	$: drawerTitle = {
		[Mode.Online]: 'เลือกลูกค้าและการจัดส่ง',
		[Mode.CustomerSelect]: 'เลือกลูกค้า',
		[Mode.CustomerCreate]: 'เพิ่มลูกค้า',
		[Mode.AddressCreate]: 'เพิ่มที่อยู่สำหรับจัดส่งสินค้า',
		[Mode.AddressEdit]: 'แก้ไขที่อยู่สำหรับจัดส่งสินค้า'
	}[mode];

	function resetState() {
		addrIdx = -1;
		address = generateEmptyAddress();
		resetAddressTrigger = true;
	}

	function openAddressCreate() {
		addrIdx = -1;
		resetAddressTrigger = true;

		address = generateEmptyAddress();

		if (customer.firstName && customer.lastName) {
			address = {
				...address,
				contactName: `${customer.firstName} ${customer.lastName}`,
				phone: customer.phone || ''
			};
		}

		switchMode(Mode.AddressCreate);
	}

	$: if (showDrawer && buyerInput) {
		buyer = { ...buyerInput };
	}

	$: if (showDrawer && !hasChanged) {
		if (drawerEl) {
			drawerEl.shadowRoot?.querySelector('.drawer')?.scrollTo(0, 0);
		}

		checkPermission();
		loadListTrigger = true;

		const origin = $orderData.saleChannel?.saleOrigin;
		const pType = $orderData.paymentType;

		// init drawer
		shippingGroup = $orderData?.deliveries?.[0]?.type ?? ShippingType.Standard;
		selectedProvider = $orderData?.deliveries?.[0]?.method ?? 'unknown';
		shippingFee = $orderData?.deliveries?.[0]?.shippingFee?.toString() ?? '';
		selectedPayment = pType?.trim() ? pType : 'unknown';
		selectedChannel =
			!origin || Object.values(FullfilmentType).includes(origin as FullfilmentType)
				? 'unknown'
				: origin;
	} else if (!showDrawer) {
		mode = Mode.Online;
	}

	function handleCancel() {
		const hasUnsaved = $unsavedChanges;
		const hasFormAddressUnsaved = hasUnsaved[FORM_ADDRESS_NAME];
		const hasFormBuyerUnsaved = hasUnsaved[FORM_NAME];

		const shouldPrompt = hasUnsaved || hasFormAddressUnsaved || hasFormBuyerUnsaved;

		if (shouldPrompt) {
			let formNameToUse: string | undefined = undefined;

			if (hasFormAddressUnsaved) {
				formNameToUse = FORM_ADDRESS_NAME;
			} else if (hasFormBuyerUnsaved) {
				formNameToUse = FORM_NAME;
			}

			setAction(() => {
				if (hasFormAddressUnsaved) {
					address = undefined;
					resetState();
				}

				switchMode(Mode.CustomerSelect);
				toggleDrawer();
				resetCustomerTrigger = true;
				hasChanged = false;
			}, formNameToUse);

			return;
		}

		address = undefined;
		resetState();
		switchMode(Mode.CustomerSelect);
		toggleDrawer();
		resetCustomerTrigger = true;
		hasChanged = false;
	}

	function handleSubmit() {
		hasChanged = false;
		if (!buyer?.name) return;

		const updatedDelivery: Delivery = {
			type: shippingGroup,
			courier: 'Seller Owned Fleet',
			method: selectedProvider,
			shippingFee: parseFloat(shippingFee) || 0
		};
		const updatedSaleChannel: SaleChannel = {
			...$orderData.saleChannel,
			saleOrigin: selectedChannel,
			type: SaleChannelType.Online
		};

		setDelivery(updatedDelivery);
		setSalesChannel(updatedSaleChannel);
		setPaymentType(selectedPayment);
		onClickSelectCustomerOnline(buyer);
		resetState();
		setUnsavedChanges(false, FORM_NAME);
		toggleDrawer();
	}

	async function checkPermission() {
		if (!$currentStore?.id) {
			canCreate = false;
			return;
		}
		await waitForDialogPermissionReady($currentCompany?.id);

		try {
			const data = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
				EntityPermission.CUSTOMERCREATE
			]);
			canCreate = data[EntityPermission.CUSTOMERCREATE];
		} catch (error) {
			canCreate = false;
		}
	}

	function handleCreateClick() {
		if (!canCreate) return;
		switchMode(Mode.CustomerCreate);
	}

	const switchMode = (m: Mode) => (mode = m);
	const handleSetAddress = async () => {
		if (!address || !customer) return;
		let lastIndex = addrIdx;
		let newAddresses = [...addresses];

		if (addrIdx === -1) {
			if (newAddresses.length === 0) {
				address.isDefault = true;
			}
			newAddresses.push({ ...address } as Address);
			lastIndex = newAddresses.length - 1;
		} else {
			newAddresses[lastIndex] = { ...address } as Address;
		}

		customer.addresses = newAddresses;
		try {
			await updateCustomerWithAccess(customer as Customer);
		} catch (error) {
			if (error instanceof AxiosError) {
				toastStore.addToast({
					message: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
					type: 'error',
					timeout: 3000,
					testId: 'sales-customer-address.toast.failed'
				});
			} else {
				toastStore.addToast({
					message: `${error}`,
					title: 'เกิดข้อผิดพลาด',
					type: 'error',
					timeout: 3000,
					testId: 'sales-customer-address.toast.failed'
				});
			}
			return;
		}

		const savedCustomer = await loadCustomer();
		const updatedAddresses = savedCustomer.addresses || [];
		addresses = [...updatedAddresses];

		const savedAddress = updatedAddresses[lastIndex];

		if (savedAddress) {
			idAddress = savedAddress.id?.toString() || '';
			onClickSelectAddress(savedAddress);
		}

		toastStore.addToast({
			message:
				addrIdx === -1
					? 'เพิ่มที่อยู่สำหรับจัดส่งสินค้าสำเร็จ'
					: 'แก้ไขที่อยู่สำหรับจัดส่งสินค้าสำเร็จ',
			type: 'success',
			timeout: 3000,
			testId: 'sales-customer-address.toast.success'
		});
		switchMode(Mode.Online);
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

	const onClickEditAddress = (e: MouseEvent, index: number) => {
		e.stopPropagation();
		e.preventDefault();
		addrIdx = index;
		address = { ...addresses[addrIdx] };
		switchMode(Mode.AddressEdit);
	};

	const onClickRemoveCustomer = () => {
		buyer = newPartyInfo();
		addresses = [];
		idAddress = '';
		resetState();
		clearOrderMeta();
		onClickSelectCustomerOnline(buyer);
	};
</script>

{#key mode}
	<ssk-drawer
		bind:this={drawerEl}
		width="550px"
		side="right"
		show={showDrawer}
		bodypadding="24px"
		on:close={handleCancel}
	>
		<ssk-drawer-header slot="header" title={drawerTitle} close={handleCancel}>
			{#if mode === Mode.CustomerSelect}
				{#if !canCreate}
					<ssk-tooltip size="xs" themeColor="black" hideCloseButton={true} placement="bottom">
						<span slot="content" class="tooltip-content">
							<ssk-text size="xs" color="white"> จำกัดสิทธิ์การเข้าถึง </ssk-text>
						</span>
						<ssk-button disabled={!canCreate} on:click={handleCreateClick}>
							เพิ่มลูกค้า
						</ssk-button>
					</ssk-tooltip>
				{:else}
					<ssk-button on:click={handleCreateClick}> เพิ่มลูกค้า </ssk-button>
				{/if}
			{/if}
		</ssk-drawer-header>
		{#if mode === Mode.CustomerSelect}
			<div slot="body" class="body-container">
				<CustomerList onClickSelectCustomer={selectCustomer} shouldLoadCustomer={loadListTrigger} />
			</div>
			<div slot="footer" class="footer-container-full">
				<ssk-button
					width="full"
					variant="outline"
					themeColor="gray"
					on:click={() => switchMode(Mode.Online)}
				>
					กลับ
				</ssk-button>
			</div>
		{:else if mode === Mode.CustomerCreate}
			<div slot="body" class="body-container">
				<CustomerCreate
					bind:shouldSubmit={submitCustomerTrigger}
					bind:shouldreset={resetCustomerTrigger}
					bind:disabledSubmit={disabledCustomerSubmit}
					onClickSelectCustomer={selectCustomer}
				/>
			</div>
			<div slot="footer" class="footer-container">
				<ssk-button
					variant="outline"
					themeColor="gray"
					on:click={() => {
						if ($unsavedChanges) {
							setAction(() => {
								switchMode(Mode.CustomerSelect);
								resetCustomerTrigger = true;
							});
						} else {
							switchMode(Mode.CustomerSelect);
							resetCustomerTrigger = true;
						}
					}}
				>
					ยกเลิก
				</ssk-button>
				<ssk-button
					disabled={disabledCustomerSubmit}
					on:click={() => (submitCustomerTrigger = true)}
				>
					บันทึก
				</ssk-button>
			</div>
		{:else if [Mode.AddressCreate, Mode.AddressEdit].includes(mode)}
			<div slot="body" class="body-container">
				<AddressPanel
					bind:address
					bind:disabledAddressSubmit
					bind:shouldreset={resetAddressTrigger}
					formName={FORM_ADDRESS_NAME}
				/>
			</div>
			<div slot="footer" class="footer-container">
				<ssk-button
					variant="outline"
					themeColor="gray"
					on:click={() => {
						if ($unsavedChanges[FORM_ADDRESS_NAME]) {
							setAction(() => {
								address = undefined;
								resetState();
								switchMode(Mode.Online);
							}, FORM_ADDRESS_NAME);
						} else {
							address = undefined;
							resetState();
							switchMode(Mode.Online);
						}
					}}
				>
					ยกเลิก
				</ssk-button>
				<ssk-button disabled={disabledAddressSubmit} on:click={handleSetAddress}>
					บันทึก
				</ssk-button>
			</div>
		{:else}
			<div slot="body" class="body-container">
				{#if buyer.name}
					<div class="header-customer">
						<div class="left">
							<ssk-tooltip
								size="sm"
								themeColor="white"
								placement="top"
								color="currentcolor"
								hideCloseButton={true}
							>
								<span slot="content" class="tooltip-content">
									<ssk-text size="xs">{buyer?.name}</ssk-text>
								</span>
								<ssk-text size="xl">
									<span class="ellipsis">{buyer?.name}</span>
								</ssk-text>
							</ssk-tooltip>
							{#if buyer.phone || buyer.email}
								<ssk-tooltip
									size="sm"
									themeColor="white"
									placement="top"
									color="currentcolor"
									hideCloseButton={true}
								>
									<span slot="content" class="tooltip-content">
										<ssk-text size="xs">
											{buyer.phone ?? ''}{buyer.phone && buyer.email ? ' | ' : ''}{buyer.email ??
												''}
										</ssk-text>
									</span>
									<ssk-text size="sm" color="gray.500">
										<span class="ellipsis">
											{buyer.phone ?? ''}{buyer.phone && buyer.email ? ' | ' : ''}{buyer.email ??
												''}
										</span>
									</ssk-text>
								</ssk-tooltip>
							{/if}
						</div>
						<div class="right" on:click={onClickRemoveCustomer}>
							<ssk-text size="sm" color="sky.600">นำออก</ssk-text>
						</div>

						{#if addresses.length > 0}
							<DropdownAddress
								{addresses}
								bind:idAddress
								{onClickEditAddress}
								{onClickSelectAddress}
								toggleDrawer={openAddressCreate}
							/>
						{:else}
							<ssk-button
								variant="outline"
								width="full"
								themeColor="button"
								on:click={openAddressCreate}
							>
								<ssk-icon slot="prefix" name="outline-map-pin" themeColor="stroke"></ssk-icon>
								<ssk-text color="gray.800">
									เพิ่มที่อยู่จัดส่ง<span class="required">*</span>
								</ssk-text>
							</ssk-button>
						{/if}
					</div>
				{:else}
					<ssk-button
						variant="outline"
						width="full"
						themeColor="button"
						on:click={() => switchMode(Mode.CustomerSelect)}
					>
						<ssk-icon slot="prefix" name="outline-user" themeColor="stroke"></ssk-icon>
						<ssk-text slot="prefix" color="gray.800">
							เลือกลูกค้า<span class="required">*</span>
						</ssk-text>
					</ssk-button>
				{/if}

				<ChannelDetail
					bind:isDirty={hasChanged}
					bind:selectedChannel
					bind:selectedPayment
					bind:selectedProvider
					bind:shippingFee
					bind:shippingGroup
					form={FORM_NAME}
				/>
			</div>

			<div slot="footer" class="footer-container-full">
				<ssk-button width="full" variant="outline" themeColor="gray" on:click={handleCancel}>
					ปิด
				</ssk-button>
				<ssk-button width="full" disabled={disabledSubmit} on:click={handleSubmit}>
					ตกลง
				</ssk-button>
			</div>
		{/if}
	</ssk-drawer>
{/key}

<style>
	.required {
		color: red;
	}

	.body-container {
		display: grid;
		gap: 1rem;
	}

	.header-customer {
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		padding: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.header-customer .left {
		width: auto;
		max-width: 300px;
		white-space: nowrap;
		display: flex;
		gap: 0.25rem;
		flex-direction: column;
	}

	.header-customer .right {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-left: auto;
		cursor: pointer;
	}

	.header-customer > ssk-button {
		padding-top: 0.2rem;
		display: block;
		width: 100%;
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

	.footer-container {
		display: flex;
		gap: 16px;
	}

	.footer-container-full {
		display: flex;
		gap: 16px;
		width: 100%;
		padding: 0.5rem;
	}

	.footer-container-full ssk-button {
		flex: 1;
	}
</style>
