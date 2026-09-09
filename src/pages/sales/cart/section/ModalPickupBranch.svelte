<script lang="ts">
	import Modal from '$components/modal/Modal.svelte';
	import type { Store } from '$lib/entities/store/store';
	import { addressToDisplay } from '$utils/format-address';
	import PickCard from './PickCard.svelte';
	import PickList from './PickList.svelte';

	export let show: boolean = false;
	export let branches: Store[] = [];
	/** Branch the goods will be collected at, as committed on the order. */
	export let selectedStoreId: string = '';
	/** Branch ringing up the sale — labelled so the cashier can spot "here". */
	export let sellingStoreId: string = '';
	export let onSelect: (branch: Store) => void;
	export let close: () => void;

	// Edits a draft, like the discount modal: "ยกเลิก" really cancels.
	let draftId: string = '';
	$: if (show && !draftId) draftId = selectedStoreId;
	$: draftIndex = branches.findIndex((b) => b.id === draftId);

	const cancel = () => {
		draftId = '';
		close();
	};

	const apply = () => {
		const branch = branches.find((b) => b.id === draftId);
		if (branch) onSelect(branch);
		draftId = '';
		close();
	};
</script>

<Modal
	id="pickup-branch"
	ShowModal={show}
	title="เลือกสาขาที่มารับสินค้า"
	hPosition="left"
	width="min(30rem, calc(100vw - 2.5rem))"
	toggleModal={cancel}
>
	<div class="body" slot="body">
		<p class="lead">ลูกค้าจะมารับสินค้าที่สาขานี้ — สาขาที่ขายยังเป็นผู้บันทึกคำสั่งซื้อ</p>

		<PickList
			label="สาขาที่มารับสินค้า"
			count={branches.length}
			selectedIndex={draftIndex}
			onMove={(i) => (draftId = branches[i]?.id ?? draftId)}
		>
			{#each branches as branch, index (branch.id ?? index)}
				<PickCard
					title={branch.name}
					badge={branch.id === sellingStoreId ? 'สาขาที่ขาย' : ''}
					lines={[addressToDisplay(branch.address), branch.phone ? `โทร ${branch.phone}` : '']
						.filter(Boolean)
						.map(String)}
					selected={branch.id === draftId}
					tabbable={branch.id === draftId || (draftIndex < 0 && index === 0)}
					onSelect={() => (draftId = branch.id ?? draftId)}
					testId={`sales.pickup.branch.${branch.id ?? index}`}
				/>
			{/each}
		</PickList>

		{#if branches.length === 0}
			<p class="empty">บริษัทนี้มีสาขาเดียว จึงไม่มีสาขาอื่นให้เลือกรับสินค้า</p>
		{/if}
	</div>

	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={cancel}
		data-testid="sales.pickup.cancel"
	>
		ยกเลิก
	</ssk-button>
	<ssk-button
		slot="modal-footer-right"
		width="full"
		disabled={!draftId}
		on:click={apply}
		data-testid="sales.pickup.apply"
	>
		เลือกสาขานี้
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
