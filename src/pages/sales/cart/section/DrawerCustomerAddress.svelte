<script lang="ts">
	import { getContext } from 'svelte';
	import { AxiosError } from 'axios';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { type Address, type Customer } from '$lib/entities/customer/customer';
	import { generateEmptyAddress } from '$lib/entities/customer/generator';
	import type { PartyInfo } from '$lib/entities/order/order';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { currentCompany } from '$stores/company/current-company';
	import { currentStore } from '$stores/store/current-store';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';
	import {
		DEFAULT_SLOT_name,
		setAction,
		setUnsavedChanges,
		unsavedChanges
	} from '$stores/saved-changes';
	import { addressToDisplay } from '$utils/format-address';
	import { maskPhoneMiddle } from '$utils/format-phone';
	import { checkPermissionsEach } from '$utils/permission';
	import {
		getCustomerByIdWithAccess,
		updateCustomerWithAccess
	} from '$service/customer-book-v2-rest';
	import AddressPanel from './AddressPanel.svelte';
	import CustomerCreate from './CustomerCreate.svelte';
	import CustomerList from './CustomerList.svelte';
	import PickCard from './PickCard.svelte';
	import PickList from './PickList.svelte';

	/**
	 * Customer and delivery address in one surface, the way the online drawer
	 * (DrawerOnline) has always done it: one drawer whose body switches view, so the
	 * cashier never has to hop between a panel row, a modal and a second drawer to
	 * finish one thought ("who is this order for, and where does it go").
	 */
	export let showDrawer: boolean = false;
	export let toggleDrawer: () => void;
	/** Read-only view of the order's buyer; Cart owns the writes. */
	export let buyer: PartyInfo | undefined;
	export let addresses: Address[] = [];
	export let idAddress: string = '';
	/** shopDelivery — the address block is shown and an address is required. */
	export let needsAddress: boolean = false;
	/** Which half the cashier asked for; only decides where the drawer lands. */
	export let openOn: 'customer' | 'address' = 'customer';
	export let onSelectCustomer: (c: Customer) => void;
	export let onSelectAddress: (a: Address) => void;
	export let onRemoveCustomer: () => void;

	// Local, not the shared Mode enum: Mode's main value is `Online` (it was written for
	// the online drawer) and naming the offline summary "online" would read as a bug.
	type View = 'summary' | 'customer-select' | 'customer-create' | 'address-form';

	const FORM_ADDRESS = 'sales-address';
	const toastStore = getContext<ToastStore>('toast');

	let view: View = 'summary';
	let canCreateCustomer = false;
	let loadListTrigger = false;
	let submitCustomerTrigger = false;
	let resetCustomerTrigger = false;
	let disabledCustomerSubmit = true;

	let addrIdx = -1;
	let addressDraft: Partial<Address> | undefined = undefined;
	let disabledAddressSubmit = true;
	let resetAddressTrigger = false;
	let prevShow = false;

	const titles: Record<View, string> = {
		summary: 'ลูกค้าและที่อยู่จัดส่ง',
		'customer-select': 'เลือกลูกค้า',
		'customer-create': 'เพิ่มลูกค้าใหม่',
		'address-form': 'ที่อยู่จัดส่ง'
	};

	$: drawerTitle =
		view === 'summary' && !needsAddress
			? 'ลูกค้า'
			: view === 'address-form'
				? addrIdx === -1
					? 'เพิ่มที่อยู่จัดส่ง'
					: 'แก้ไขที่อยู่จัดส่ง'
				: titles[view];

	$: hasCustomer = !!buyer?.name;
	$: selectedAddress = addresses.find((a) => String(a.id) === idAddress);
	$: customerLines = [maskPhoneMiddle(buyer?.phone), buyer?.email].filter(Boolean) as string[];
	// The cashier may leave once the order has what this fulfilment type needs.
	$: canFinish = hasCustomer && (!needsAddress || !!selectedAddress);

	// Opening lands on the half that is still empty: no customer at all -> the list;
	// a customer but no address on a delivery order -> the address form.
	$: if (showDrawer && !prevShow) {
		prevShow = true;
		checkPermission();
		// One-way prop that CustomerList clears locally, so this must stay true — toggling
		// it handed every second open a list that never fetched (empty table).
		loadListTrigger = true;

		if (!buyer?.name) {
			view = 'customer-select';
		} else if (openOn === 'address' && needsAddress && addresses.length === 0) {
			startCreateAddress();
		} else {
			view = 'summary';
		}
	}

	$: if (!showDrawer && prevShow) {
		prevShow = false;
		view = 'summary';
		addressDraft = undefined;
		addrIdx = -1;
	}

	async function checkPermission() {
		if (!$currentStore?.id) {
			canCreateCustomer = false;
			return;
		}
		// Scoped to this company (as DrawerOnline does): without the id this waits on a
		// pending check that may belong to a company we are not looking at.
		await waitForDialogPermissionReady($currentCompany?.id);

		// checkPermissionsEach never throws — it answers all-false on failure — so a
		// try/catch here would be dead code.
		const data = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
			EntityPermission.CUSTOMERCREATE
		]);
		canCreateCustomer = data[EntityPermission.CUSTOMERCREATE];
	}

	const handleSelectCustomer = (c: Customer) => {
		onSelectCustomer(c);

		// A delivery order is not finished by picking a customer — the address is the
		// other half of the same decision, so the drawer stays open on it. Pick-up
		// orders are done, and closing keeps that flow at one click as before.
		if (needsAddress) {
			view = 'summary';
		} else {
			toggleDrawer();
		}
	};

	const handleCreatedCustomer = (c: Customer) => {
		onSelectCustomer(c);
		setUnsavedChanges(false);
		resetCustomerTrigger = true;
		// A brand-new customer has no addresses yet, so a delivery order lands on the
		// summary where the empty address block invites adding one.
		view = 'summary';
	};

	function startCreateAddress() {
		addrIdx = -1;
		disabledAddressSubmit = true;
		addressDraft = {
			...generateEmptyAddress(),
			contactName: buyer?.name ?? '',
			phone: buyer?.phone ?? ''
		};
		resetAddressTrigger = true;
		view = 'address-form';
	}

	function startEditAddress(index: number) {
		addrIdx = index;
		disabledAddressSubmit = true;
		addressDraft = { ...addresses[index] };
		resetAddressTrigger = true;
		view = 'address-form';
	}

	const pickAddress = (address: Address) => {
		idAddress = String(address.id ?? '');
		onSelectAddress(address);
	};

	const leaveCustomerForm = () => {
		const back = () => {
			setUnsavedChanges(false, DEFAULT_SLOT_name);
			resetCustomerTrigger = true;
			view = 'customer-select';
		};

		if ($unsavedChanges[DEFAULT_SLOT_name]) {
			setAction(back, DEFAULT_SLOT_name);
		} else {
			back();
		}
	};

	const leaveAddressForm = () => {
		const back = () => {
			addressDraft = undefined;
			addrIdx = -1;
			resetAddressTrigger = true;
			view = 'summary';
		};

		if ($unsavedChanges[FORM_ADDRESS]) {
			setAction(back, FORM_ADDRESS);
		} else {
			back();
		}
	};

	const saveAddress = async () => {
		if (!addressDraft || !buyer?.refId || !$currentCompany?.id) return;

		const owner = `sellsuki.company:${$currentCompany.id}`;
		// An edit is tracked by address id, not by row position: the array being written
		// is the one the server just returned, and nothing guarantees it keeps the order
		// the local list had — writing by index can overwrite a different address.
		const editingId = addrIdx >= 0 ? addresses[addrIdx]?.id : undefined;
		let customer: Customer;

		try {
			customer = await getCustomerByIdWithAccess(buyer.refId, owner);
		} catch (error) {
			showSaveError(error);
			return;
		}

		const next = [...(customer.addresses ?? [])];
		const knownIds = new Set(next.map((a) => String(a.id)));

		if (editingId === undefined) {
			if (next.length === 0) addressDraft.isDefault = true;
			next.push({ ...addressDraft } as Address);
		} else {
			const at = next.findIndex((a) => String(a.id) === String(editingId));
			if (at < 0) {
				toastStore.addToast({
					message: 'ไม่พบที่อยู่ที่ต้องการแก้ไข อาจถูกลบไปแล้ว กรุณาลองใหม่',
					type: 'error',
					timeout: 3000,
					testId: 'sales-customer-address.toast.failed'
				});
				addresses = [...next];
				view = 'summary';
				return;
			}
			next[at] = { ...addressDraft } as Address;
		}

		customer.addresses = next;

		try {
			await updateCustomerWithAccess(customer);
		} catch (error) {
			showSaveError(error);
			return;
		}

		const saved = await getCustomerByIdWithAccess(buyer.refId, owner);
		addresses = [...(saved.addresses ?? [])];

		// Select what was just saved by identity: an edit keeps its id, a create is the
		// one id that was not in the list before the write.
		const savedAddress =
			editingId === undefined
				? addresses.find((a) => !knownIds.has(String(a.id))) ?? addresses[addresses.length - 1]
				: addresses.find((a) => String(a.id) === String(editingId));
		if (savedAddress) pickAddress(savedAddress);

		toastStore.addToast({
			message:
				editingId === undefined
					? 'เพิ่มที่อยู่สำหรับจัดส่งสินค้าสำเร็จ'
					: 'แก้ไขที่อยู่สำหรับจัดส่งสินค้าสำเร็จ',
			type: 'success',
			timeout: 3000,
			testId: 'sales-customer-address.toast.success'
		});

		setUnsavedChanges(false, FORM_ADDRESS);
		addressDraft = undefined;
		addrIdx = -1;
		view = 'summary';
	};

	function showSaveError(error: unknown) {
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
	}

	const handleRemoveCustomer = () => {
		onRemoveCustomer();
		view = 'customer-select';
	};

	function handleClose() {
		const close = () => {
			view = 'summary';
			addressDraft = undefined;
			addrIdx = -1;
			resetCustomerTrigger = true;
			resetAddressTrigger = true;
			setUnsavedChanges(false, FORM_ADDRESS);
			setUnsavedChanges(false, DEFAULT_SLOT_name);
			toggleDrawer();
		};

		if (view === 'address-form' && $unsavedChanges[FORM_ADDRESS]) {
			setAction(close, FORM_ADDRESS);
		} else if (view === 'customer-create' && $unsavedChanges[DEFAULT_SLOT_name]) {
			setAction(close, DEFAULT_SLOT_name);
		} else {
			close();
		}
	}
</script>

{#key view}
	<ssk-drawer
		width="550px"
		side="right"
		show={showDrawer}
		bodypadding="20px"
		on:close={handleClose}
	>
		<ssk-drawer-header slot="header" title={drawerTitle} close={handleClose}>
			{#if view === 'customer-select'}
				{#if canCreateCustomer}
					<ssk-button size="sm" on:click={() => (view = 'customer-create')}>เพิ่มลูกค้า</ssk-button>
				{:else}
					<ssk-tooltip size="xs" themeColor="black" hideCloseButton={true} placement="bottom">
						<span slot="content" class="tooltip-content">
							<ssk-text size="xs" color="white">จำกัดสิทธิ์การเข้าถึง</ssk-text>
						</span>
						<ssk-button size="sm" disabled>เพิ่มลูกค้า</ssk-button>
					</ssk-tooltip>
				{/if}
			{/if}
		</ssk-drawer-header>

		{#if view === 'customer-select'}
			<div slot="body">
				<CustomerList
					onClickSelectCustomer={handleSelectCustomer}
					selectedCustomerId={buyer?.refId ?? ''}
					selectedAddressLine={buyer?.address ?? ''}
					shouldLoadCustomer={loadListTrigger}
				/>
			</div>
			{#if hasCustomer}
				<div slot="footer" class="footer">
					<ssk-button
						variant="outline"
						themeColor="gray"
						width="full"
						on:click={() => (view = 'summary')}
						data-testid="sales.customer.back"
					>
						กลับ
					</ssk-button>
				</div>
			{/if}
		{:else if view === 'customer-create'}
			<div slot="body">
				<CustomerCreate
					bind:shouldSubmit={submitCustomerTrigger}
					bind:shouldreset={resetCustomerTrigger}
					bind:disabledSubmit={disabledCustomerSubmit}
					onClickSelectCustomer={handleCreatedCustomer}
				/>
			</div>
			<div slot="footer" class="footer">
				<ssk-button
					variant="outline"
					themeColor="gray"
					width="full"
					on:click={leaveCustomerForm}
					data-testid="sales.customer.form.cancel"
				>
					ยกเลิก
				</ssk-button>
				<ssk-button
					width="full"
					disabled={disabledCustomerSubmit}
					on:click={() => (submitCustomerTrigger = true)}
				>
					บันทึก
				</ssk-button>
			</div>
		{:else if view === 'address-form'}
			<div slot="body">
				<AddressPanel
					bind:address={addressDraft}
					bind:disabledAddressSubmit
					bind:shouldreset={resetAddressTrigger}
					formName={FORM_ADDRESS}
				/>
			</div>
			<div slot="footer" class="footer">
				<ssk-button
					variant="outline"
					themeColor="gray"
					width="full"
					on:click={leaveAddressForm}
					data-testid="sales.address.form.cancel"
				>
					ยกเลิก
				</ssk-button>
				<ssk-button
					width="full"
					disabled={disabledAddressSubmit}
					on:click={saveAddress}
					data-testid="sales.address.form.save"
				>
					บันทึก
				</ssk-button>
			</div>
		{:else}
			<div slot="body" class="summary">
				<!-- Who the order is for. One block, one place to change or detach it. -->
				<section class="block">
					<header class="block-head">
						<h3>ลูกค้า</h3>
						<div class="block-actions">
							{#if hasCustomer}
								<button
									type="button"
									class="link"
									on:click={() => (view = 'customer-select')}
									data-testid="sales.customer.change"
								>
									เปลี่ยนลูกค้า
								</button>
								<button
									type="button"
									class="link muted"
									on:click={handleRemoveCustomer}
									data-testid="sales.customer.remove"
								>
									นำออก
								</button>
							{/if}
						</div>
					</header>

					{#if hasCustomer}
						<div class="customer">
							<ssk-icon name="outline-user" size="md" themeColor="primary"></ssk-icon>
							<div class="customer-text">
								<span class="customer-name">{buyer?.name}</span>
								{#if customerLines.length}
									<span class="customer-meta">{customerLines.join(' · ')}</span>
								{/if}
							</div>
						</div>
					{:else}
						<button
							type="button"
							class="empty"
							on:click={() => (view = 'customer-select')}
							data-testid="sales.customer.pick"
						>
							<ssk-icon name="outline-user" size="sm" themeColor="stroke"></ssk-icon>
							เลือกลูกค้าจากสมุดลูกค้า
						</button>
					{/if}
				</section>

				{#if needsAddress}
					<!-- ...and where it goes. Same surface, so the pair is decided together. -->
					<section class="block">
						<header class="block-head">
							<h3>ที่อยู่จัดส่ง<span class="required">*</span></h3>
							{#if hasCustomer && addresses.length > 0}
								<button
									type="button"
									class="link"
									on:click={startCreateAddress}
									data-testid="sales.address.create"
								>
									เพิ่มที่อยู่ใหม่
								</button>
							{/if}
						</header>

						{#if !hasCustomer}
							<p class="hint">เลือกลูกค้าก่อน แล้วที่อยู่ของลูกค้าจะแสดงที่นี่</p>
						{:else if addresses.length === 0}
							<button
								type="button"
								class="empty"
								on:click={startCreateAddress}
								data-testid="sales.address.create"
							>
								<ssk-icon name="outline-map-pin" size="sm" themeColor="stroke"></ssk-icon>
								เพิ่มที่อยู่จัดส่งของลูกค้ารายนี้
							</button>
						{:else}
							<PickList
								label="ที่อยู่จัดส่ง"
								count={addresses.length}
								selectedIndex={addresses.findIndex((a) => String(a.id) === idAddress)}
								onMove={(i) => {
									const next = addresses[i];
									if (next) pickAddress(next);
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
										tabbable={String(address.id) === idAddress || (!selectedAddress && index === 0)}
										onSelect={() => pickAddress(address)}
										actionLabel="แก้ไข"
										onAction={(e) => {
											e.stopPropagation();
											startEditAddress(index);
										}}
										testId={`sales.address.option.${address.id ?? index}`}
									/>
								{/each}
							</PickList>
						{/if}
					</section>
				{/if}
			</div>

			<div slot="footer" class="footer">
				<ssk-button
					width="full"
					disabled={!canFinish}
					on:click={handleClose}
					data-testid="sales.customeraddress.done"
				>
					{needsAddress ? 'ใช้ลูกค้าและที่อยู่นี้' : 'ใช้ลูกค้ารายนี้'}
				</ssk-button>
			</div>
		{/if}
	</ssk-drawer>
{/key}

<style>
	ssk-drawer {
		z-index: 10;
	}

	.summary {
		display: grid;
		gap: 1.25rem;
	}

	.block {
		display: grid;
		gap: 0.5rem;
	}

	.block-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		padding-bottom: 0.375rem;
		border-bottom: 1px solid var(--ssk-colors-gray-200);
	}

	.block-head h3 {
		margin: 0;
		font-size: var(--ssk-font-size-md);
		font-weight: 600;
		color: var(--ssk-colors-gray-800);
	}

	.block-actions {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}

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

	.link.muted {
		color: var(--ssk-colors-gray-500);
	}

	.link:focus-visible,
	.empty:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 2px;
		border-radius: 4px;
	}

	/* The chosen customer reads as a record, not as another control to press. */
	.customer {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.75rem 0.875rem;
		background: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 10px;
	}

	.customer-text {
		display: grid;
		gap: 0.125rem;
		min-width: 0;
	}

	.customer-name {
		font-size: var(--ssk-font-size-md);
		font-weight: 500;
		color: var(--ssk-colors-gray-800);
	}

	.customer-meta {
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-500);
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.875rem;
		background: none;
		border: 1px dashed var(--ssk-colors-gray-300);
		border-radius: 10px;
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		color: var(--ssk-colors-primary-500);
		cursor: pointer;
	}

	.empty:hover {
		background: var(--ssk-colors-gray-50);
	}

	.hint {
		margin: 0;
		padding: 0.75rem 0.875rem;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-500);
		background: var(--ssk-colors-gray-50);
		border-radius: 10px;
	}

	.required {
		color: var(--ssk-colors-red-500, #ef4444);
	}

	.footer {
		display: flex;
		gap: 0.75rem;
		width: 100%;
	}

	/* ssk-button width="full" resolves against its own shrink-to-fit host here, so the
	   confirm button was only as wide as its label; let flex do the sizing instead. */
	.footer ssk-button {
		flex: 1 1 0;
		min-width: 0;
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
</style>
