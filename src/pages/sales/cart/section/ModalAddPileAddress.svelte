<script lang="ts">
	/**
	 * "เพิ่มตัวเลือกรับสินค้า" → จัดส่งจากหน้าร้าน (a SECOND Shipping pile, its own address)
	 * — same job/shape as ModalPickupBranch, just picking from the customer's own address
	 * book instead of the company's branches. `addresses` is pre-filtered by the caller to
	 * exclude whatever address(es) another open Shipping pile is already using — a new pile
	 * must ship somewhere DIFFERENT.
	 */
	import Modal from '$components/modal/Modal.svelte';
	import type { Address } from '$lib/entities/customer/customer';
	import { addressToDisplay } from '$utils/format-address';
	import PickCard from './PickCard.svelte';
	import PickList from './PickList.svelte';

	export let show: boolean = false;
	export let addresses: Address[] = [];
	export let onSelect: (address: Address) => void;
	export let close: () => void;
	export let modalId: string = 'pile-address';
	export let testIdPrefix: string = 'sales.pile.address';

	// Edits a draft, like ModalPickupBranch: "ยกเลิก" really cancels.
	let draftId: string = '';
	$: draftIndex = addresses.findIndex((a) => String(a.id) === draftId);

	const cancel = () => {
		draftId = '';
		close();
	};

	const apply = () => {
		const address = addresses.find((a) => String(a.id) === draftId);
		if (address) onSelect(address);
		draftId = '';
		close();
	};
</script>

<Modal
	id={modalId}
	ShowModal={show}
	title="เลือกที่อยู่จัดส่ง"
	hPosition="left"
	width="min(30rem, calc(100vw - 2.5rem))"
	toggleModal={cancel}
>
	<div class="body" slot="body">
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
			<p class="empty">ลูกค้ายังไม่มีที่อยู่อื่นให้เลือก — เพิ่มที่อยู่ใหม่ในโปรไฟล์ลูกค้าก่อน</p>
		{/if}
	</div>

	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={cancel}
		data-testid={`${testIdPrefix}.cancel`}
	>
		ยกเลิก
	</ssk-button>
	<ssk-button
		slot="modal-footer-right"
		width="full"
		disabled={!draftId}
		on:click={apply}
		data-testid={`${testIdPrefix}.apply`}
	>
		เลือกที่อยู่นี้
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
</style>
