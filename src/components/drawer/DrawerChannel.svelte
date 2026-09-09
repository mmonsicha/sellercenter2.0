<script lang="ts">
	import {
		FullfilmentType,
		ShippingType,
		type Delivery,
		type DeliveryOption,
		type SaleChannel
	} from '$lib/entities/order/order';
	import { setAction, setUnsavedChanges, unsavedChanges } from '$stores/saved-changes';
	import {
		orderData,
		setDelivery,
		setPaymentType,
		setSalesChannel,
		updateOrderDeliveryChannelDetail,
		updatePaymentType,
		updateSalesChannel
	} from '$stores/order/order';
	import ChannelDetail from './ChannelDetail.svelte';
	import { getContext } from 'svelte';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';

	export let isOpened: boolean = false;
	export let toggleDrawer: () => void;
	export let selectedChannel: string = 'unknown';
	export let selectedPayment: string = 'unknown';
	export let delivery: DeliveryOption | undefined = undefined;
	export let shippingFee: string = '';

	const toastStore = getContext<ToastStore>('toast');

	let drawerEl: HTMLElement;
	let hasChanged: boolean = false;

	let shippingGroup: ShippingType = delivery?.type || ShippingType.Standard;
	let selectedProvider = delivery ? delivery.value : 'unknown';

	$: isPaidOrder = $orderData.state?.includes('paid') || false;
	$: {
		if (isOpened && !hasChanged) {
			if (drawerEl) {
				drawerEl.shadowRoot?.querySelector('.drawer')?.scrollTo(0, 0);
			}

			// set init value on drawer
			const origin = $orderData.saleChannel?.saleOrigin;
			const pType = $orderData.paymentType;

			shippingGroup = $orderData?.deliveries?.[0]?.type ?? ShippingType.Standard;
			shippingFee = $orderData?.deliveries?.[0]?.shippingFee?.toString() ?? '';
			selectedPayment = pType?.trim() ? pType : 'unknown';
			selectedChannel =
				!origin || Object.values(FullfilmentType).includes(origin as FullfilmentType)
					? 'unknown'
					: origin;
		}

		if (hasChanged) {
			setUnsavedChanges(true);
		}
	}

	function handleCancel() {
		if ($unsavedChanges) {
			setAction(() => {
				toggleDrawer();
				hasChanged = false;
			});
		} else {
			toggleDrawer();
			hasChanged = false;
		}
	}

	async function updateOrderDetails() {
		const updatedDelivery: Delivery = {
			...$orderData.deliveries?.[0],
			type: shippingGroup,
			courier: 'Seller Owned Fleet',
			method: selectedProvider,
			shippingFee: parseFloat(shippingFee) || 0
		};
		const updatedSaleChannel: SaleChannel = {
			...$orderData.saleChannel,
			saleOrigin: selectedChannel
		};

		setDelivery(updatedDelivery);
		setSalesChannel(updatedSaleChannel);
		setPaymentType(selectedPayment);

		try {
			if (!isPaidOrder) {
				await updatePaymentType();
				await updateSalesChannel();
			}

			await updateOrderDeliveryChannelDetail();
			toastStore.addToast({
				message: 'บันทึกข้อมูลสำเร็จ',
				type: 'success',
				timeout: 3000,
				testId: 'drawer.channel.toast.success'
			});
		} catch (error) {
			toastStore.addToast({
				message: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
				type: 'error',
				timeout: 3000,
				testId: 'drawer.channel.toast.error'
			});
			console.error('Failed to update order channel detail:', error);
		}

		hasChanged = false;
		setUnsavedChanges(false);
		toggleDrawer();
	}
</script>

<ssk-drawer
	bind:this={drawerEl}
	width="550px"
	side="right"
	show={isOpened}
	bodypadding="24px"
	on:close={handleCancel}
>
	<ssk-drawer-header slot="header" title="แก้ไขช่องทางและการจัดส่ง" close={handleCancel}>
	</ssk-drawer-header>
	<div slot="body" class="body">
		<ChannelDetail
			bind:isDirty={hasChanged}
			bind:isPaidOrder
			bind:selectedChannel
			bind:selectedPayment
			bind:selectedProvider
			bind:shippingFee
			bind:shippingGroup
		/>
	</div>
	<div slot="footer" class="footer-container">
		<ssk-button variant="outline" themeColor="gray" on:click={handleCancel}> ยกเลิก </ssk-button>
		<ssk-button disabled={!hasChanged} on:click={updateOrderDetails}> บันทึก </ssk-button>
	</div>
</ssk-drawer>

<style>
	ssk-drawer {
		z-index: 10;
	}
	.footer-container {
		display: flex;
		gap: 16px;
	}
</style>
