<script lang="ts">
	/**
	 * "เพิ่มตัวเลือกรับสินค้า" → จัดส่งจากหน้าร้าน (a SECOND Shipping pile, its own address)
	 * — same job/shape as ModalPickupBranch, just picking from the customer's own address
	 * book instead of the company's branches. `addresses` is pre-filtered by the caller to
	 * exclude whatever address(es) another open Shipping pile is already using — a new pile
	 * must ship somewhere DIFFERENT.
	 *
	 * Also lets the cashier add a brand-new address right here (`view = 'create'`) — before
	 * this, a customer with no other address sent the cashier away to DrawerCustomerAddress
	 * just to come back and pick the one they'd just added. Mirrors DrawerCustomerAddress's
	 * own saveAddress (read-modify-write the whole Customer via Customer Book v2 — there is
	 * no per-address create endpoint), scoped down to "create only" since this modal never
	 * edits an existing address.
	 */
	import { getContext } from 'svelte';
	import { AxiosError } from 'axios';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import Modal from '$components/modal/Modal.svelte';
	import type { Address, Customer } from '$lib/entities/customer/customer';
	import { generateEmptyAddress } from '$lib/entities/customer/generator';
	import type { PartyInfo } from '$lib/entities/order/order';
	import { currentCompany } from '$stores/company/current-company';
	import {
		getCustomerByIdWithAccess,
		updateCustomerWithAccess
	} from '$service/customer-book-v2-rest';
	import { addressToDisplay } from '$utils/format-address';
	import AddressPanel from './AddressPanel.svelte';
	import PickCard from './PickCard.svelte';
	import PickList from './PickList.svelte';

	export let show: boolean = false;
	export let addresses: Address[] = [];
	export let onSelect: (address: Address) => void;
	export let close: () => void;
	export let modalId: string = 'pile-address';
	export let testIdPrefix: string = 'sales.pile.address';
	// Needed to create a new address at all (buyer.refId is the Customer Book id) — undefined
	// just hides "เพิ่มที่อยู่ใหม่" below, same as any other customer-scoped action would.
	export let buyer: PartyInfo | undefined = undefined;
	// The modal only ever ADDS a new address, never edits one in place — so the caller's own
	// address list is stale the moment a create succeeds. Handed the full refetched list plus
	// the one just created, same split DrawerCustomerAddress's own saveAddress reports back.
	export let onAddressCreated: (addresses: Address[], created: Address) => void = () => {};

	const toastStore = getContext<ToastStore>('toast');
	const FORM_ADDRESS = 'sales-pile-address';

	type View = 'pick' | 'create';
	let view: View = 'pick';

	// Edits a draft, like ModalPickupBranch: "ยกเลิก" really cancels.
	let draftId: string = '';
	$: draftIndex = addresses.findIndex((a) => String(a.id) === draftId);

	let addressDraft: Partial<Address> | undefined;
	let disabledAddressSubmit = true;
	let resetAddressTrigger = false;
	let saving = false;

	const reset = () => {
		draftId = '';
		view = 'pick';
		addressDraft = undefined;
		saving = false;
	};

	const cancel = () => {
		reset();
		close();
	};

	const apply = () => {
		const address = addresses.find((a) => String(a.id) === draftId);
		if (address) onSelect(address);
		reset();
		close();
	};

	function startCreateAddress() {
		addressDraft = {
			...generateEmptyAddress(),
			contactName: buyer?.name ?? '',
			phone: buyer?.phone ?? ''
		};
		disabledAddressSubmit = true;
		resetAddressTrigger = true;
		view = 'create';
	}

	function backToPick() {
		addressDraft = undefined;
		view = 'pick';
	}

	function showSaveError(error: unknown) {
		toastStore.addToast({
			message:
				error instanceof AxiosError
					? 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
					: `เกิดข้อผิดพลาด: ${error}`,
			type: 'error',
			timeout: 3000,
			testId: `${testIdPrefix}.create.toast.failed`
		});
	}

	// Create-only version of DrawerCustomerAddress's own saveAddress — no editingId branch,
	// since a line already shipping to an address never needs a SECOND pile for the same
	// one (the caller already filters it out of `addresses`).
	const saveNewAddress = async () => {
		if (!addressDraft || !buyer?.refId || !$currentCompany?.id || saving) return;
		saving = true;

		const owner = `sellsuki.company:${$currentCompany.id}`;
		let customer: Customer;
		try {
			customer = await getCustomerByIdWithAccess(buyer.refId, owner);
		} catch (error) {
			saving = false;
			showSaveError(error);
			return;
		}

		const existing = customer.addresses ?? [];
		const knownIds = new Set(existing.map((a) => String(a.id)));
		const draft = { ...addressDraft } as Address;
		if (existing.length === 0) draft.isDefault = true;
		customer.addresses = [...existing, draft];

		try {
			await updateCustomerWithAccess(customer);
		} catch (error) {
			saving = false;
			showSaveError(error);
			return;
		}

		const saved = await getCustomerByIdWithAccess(buyer.refId, owner);
		const savedAddresses = saved.addresses ?? [];
		const created = savedAddresses.find((a) => !knownIds.has(String(a.id)));

		toastStore.addToast({
			message: 'เพิ่มที่อยู่สำหรับจัดส่งสินค้าสำเร็จ',
			type: 'success',
			timeout: 3000,
			testId: `${testIdPrefix}.create.toast.success`
		});

		onAddressCreated(savedAddresses, created ?? savedAddresses[savedAddresses.length - 1]);
		saving = false;

		// Straight through to picking it — the cashier asked for a new address FOR this
		// pile, not just to have it exist somewhere in the profile.
		if (created) {
			onSelect(created);
			reset();
			close();
		} else {
			backToPick();
		}
	};
</script>

<Modal
	id={modalId}
	ShowModal={show}
	title={view === 'create' ? 'เพิ่มที่อยู่จัดส่ง' : 'เลือกที่อยู่จัดส่ง'}
	hPosition="left"
	width="min(30rem, calc(100vw - 2.5rem))"
	toggleModal={cancel}
>
	<div class="body" slot="body">
		{#if view === 'create'}
			<AddressPanel
				bind:address={addressDraft}
				bind:disabledAddressSubmit
				bind:shouldreset={resetAddressTrigger}
				formName={FORM_ADDRESS}
			/>
		{:else}
			<p class="lead">พัสดุนี้จะจัดส่งไปยังที่อยู่นี้ — แยกจากที่อยู่หลักของลูกค้า</p>

			<PickList
				label="ที่อยู่จัดส่ง"
				count={addresses.length}
				selectedIndex={draftIndex}
				onMove={(i) => (draftId = String(addresses[i]?.id ?? draftId))}
			>
				{#each addresses as address, index (address.id ?? index)}
					<PickCard
						title={address.contactName || 'ที่อยู่'}
						badge={address.isDefault ? 'ที่อยู่หลัก' : ''}
						lines={[addressToDisplay(address), address.phone ? `โทร ${address.phone}` : ''].filter(
							Boolean
						)}
						selected={String(address.id) === draftId}
						tabbable={String(address.id) === draftId || (draftIndex < 0 && index === 0)}
						onSelect={() => (draftId = String(address.id ?? draftId))}
						testId={`${testIdPrefix}.address.${address.id ?? index}`}
					/>
				{/each}
			</PickList>

			{#if addresses.length === 0}
				<p class="empty">ลูกค้ายังไม่มีที่อยู่อื่นให้เลือก</p>
			{/if}

			{#if buyer?.refId}
				<button
					type="button"
					class="add-new"
					on:click={startCreateAddress}
					data-testid={`${testIdPrefix}.create.open`}
				>
					<ssk-icon name="outline-plus" size="xs"></ssk-icon>
					เพิ่มที่อยู่ใหม่
				</button>
			{/if}
		{/if}
	</div>

	<!-- One pair of footer buttons, not two swapped via {#if}/{:else} — a named-slot element
	     wrapped directly in a conditional at the component's top level doesn't satisfy
	     Svelte's "slot content must be a child of the component" check, so behaviour/label
	     branches on `view` inside each button instead of the whole element being swapped. -->
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={view === 'create' ? backToPick : cancel}
		data-testid={view === 'create' ? `${testIdPrefix}.create.cancel` : `${testIdPrefix}.cancel`}
	>
		ยกเลิก
	</ssk-button>
	<ssk-button
		slot="modal-footer-right"
		width="full"
		disabled={view === 'create' ? disabledAddressSubmit || saving : !draftId}
		on:click={view === 'create' ? saveNewAddress : apply}
		data-testid={view === 'create' ? `${testIdPrefix}.create.save` : `${testIdPrefix}.apply`}
	>
		{view === 'create' ? 'บันทึกและเลือก' : 'เลือกที่อยู่นี้'}
	</ssk-button>
</Modal>

<style>
	.body {
		display: grid;
		gap: 0.625rem;
		width: 100%;
		box-sizing: border-box;
		text-align: left;
	}

	.lead {
		margin: 0;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
	}

	.empty {
		margin: 0;
		padding: 0.75rem;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-500);
		background: var(--ssk-colors-gray-50);
		border-radius: 10px;
	}

	.add-new {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.625rem;
		background: none;
		border: 1px dashed var(--ssk-colors-gray-300);
		border-radius: 10px;
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		color: var(--ssk-colors-primary-500);
		cursor: pointer;
	}

	.add-new:hover {
		background: var(--ssk-colors-gray-50);
	}
</style>
