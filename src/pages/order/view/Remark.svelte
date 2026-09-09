<script lang="ts">
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import { Status, type Delivery } from '$lib/entities/order/order';
	import {
		setAction,
		setCancelAction,
		setUnsavedChanges,
		unsavedChanges
	} from '$stores/saved-changes';
	import { currentStore } from '$stores/store/current-store';
	import { getContext } from 'svelte';
	import { storeUpdateOrderDeliveryRemark } from '../../../service/management-rest';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { orderData, setDelivery } from '$stores/order/order';
	import { i18nKW } from '$stores/i18n';

	const toastStore = getContext<ToastStore>('toast');
	export let canUpdate: boolean = false;
	$: remark = $orderData.deliveries?.[0]?.remark ?? '';
	$: tempRemark = remark;
	let isOpened: boolean = false;
	let isDirty: boolean = false;

	async function _onOkRemark() {
		isOpened = false;
		try {
			if (!$currentStore.id || !$orderData.orderId) return;
			const updatedDelivery: Delivery = {
				...$orderData.deliveries?.[0],
				remark: tempRemark
			};
			setDelivery(updatedDelivery);

			await storeUpdateOrderDeliveryRemark($currentStore.id, $orderData.orderId, tempRemark);
			remark = tempRemark;
			toastStore.addToast({
				message: $i18nKW['patona-sellercenter-orderdetail-remark-toast-success'],
				type: 'success',
				timeout: 3000,
				testId: 'remark.toast.success'
			});
		} catch (error) {
			toastStore.addToast({
				message: $i18nKW['patona-sellercenter-orderdetail-remark-toast-error'],
				type: 'error',
				timeout: 3000,
				testId: 'remark.toast.error'
			});
		}
		tempRemark = remark;
	}

	function _onCloseRemark() {
		if (isDirty) {
			setUnsavedChanges(true);
		}

		if (isDirty && $unsavedChanges) {
			isOpened = false;
			setAction(() => {
				toggleModal();
				isDirty = false;
				isOpened = false;
				tempRemark = remark;
			});

			setCancelAction(() => {
				isOpened = true;
				setUnsavedChanges(false);
			});
		} else {
			toggleModal();
		}
	}

	function toggleModal() {
		isOpened = !isOpened;
		isDirty = false;
	}

	function handleRemark(event: Event) {
		isDirty = true;
		tempRemark = (event.target as HTMLInputElement).value;
		(event.target as HTMLInputElement).value = tempRemark;
	}
</script>

<ModalWithDivider
	ShowModal={isOpened}
	toggleModal={_onCloseRemark}
	hPosition="left"
	id="remark"
	modalWidth="30vw"
	modalPaddingBody="0px"
	bodySlotDisplay="content"
>
	<div slot="title">
		{$i18nKW['patona-sellercenter-orderdetail-remark-edit-title']}
	</div>
	<div class="modal-body" slot="body">
		<ssk-input
			label={$i18nKW['patona-sellercenter-orderdetail-remark-note-label']}
			placeholder={$i18nKW['patona-sellercenter-orderdetail-remark-note-placeholder']}
			autoComplete="off"
			limit="255"
			value={tempRemark}
			on:input={handleRemark}
			on:change={handleRemark}
		/>
	</div>
	<div class="modal-footer" slot="footer">
		<ssk-button variant="outline" themeColor="gray" on:click={_onCloseRemark}>
			{$i18nKW['patona-sellercenter-orderdetail-modal-button-cancel']}
		</ssk-button>
		<ssk-button on:click={_onOkRemark} disabled={!isDirty}>
			{$i18nKW['patona-sellercenter-orderdetail-modal-button-save']}
		</ssk-button>
	</div>
</ModalWithDivider>

<div class="header">
	<ssk-text size="xl"
		>{$i18nKW['patona-sellercenter-orderdetail-remark-section-title']}</ssk-text
	>
	{#if $orderData.status !== Status.Completed && $orderData.status !== Status.Canceled && canUpdate}
		<ssk-icon name="outline-pencil-square" on:click={toggleModal} />
	{/if}
</div>

<div class="container">
	<ssk-text color="gray.500"
		>{$i18nKW['patona-sellercenter-orderdetail-remark-note-label']}</ssk-text
	>
	<ssk-text>{remark ? remark : '-'}</ssk-text>
</div>

<style>
	.container {
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		padding: 1.5rem;
		display: grid;
		gap: 0.5rem;
		word-break: break-all;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header > ssk-icon {
		cursor: pointer;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.modal-footer {
		display: flex;
		gap: 1rem;
	}
</style>
