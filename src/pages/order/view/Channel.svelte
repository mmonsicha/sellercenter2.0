<script lang="ts">
	import DrawerChannel from '$components/drawer/DrawerChannel.svelte';
	import IconLabel from '$components/IconLabel.svelte';
	import { SaleChannelType, Status, salesChannels } from '$lib/entities/order/order';
	import { orderData, shippingFee } from '$stores/order/order';

	import { formatPrice } from '$utils/format-number';
	import { getDeliveryMethod } from '$utils/utils-order';
	import { orderChannelI18nKey, orderDeliveryI18nKey } from '$utils/i18n-keys';
	import { currentLanguage, i18nKW } from '$stores/i18n';
	import PaymentInfo from './PaymentInfo.svelte';

	let isOpened: boolean = false;
	const isOnlineOrder = $orderData.saleChannel?.type === SaleChannelType.Online;
	$: salesChannel = salesChannels.find((s) => s.value === $orderData.saleChannel?.saleOrigin);
	$: notCompletedOrCanceled =
		$orderData.status !== Status.Completed && $orderData.status !== Status.Canceled;
	$: delivery = getDeliveryMethod($orderData);

	function onEditPaymentAndDeliveryDetail() {
		isOpened = true;
	}

	function toggleDrawer() {
		isOpened = !isOpened;
	}
</script>

<DrawerChannel
	bind:isOpened
	{toggleDrawer}
	{delivery}
	selectedChannel={$orderData.saleChannel?.saleOrigin}
	selectedPayment={$orderData.paymentType ?? 'unknown'}
	shippingFee={$orderData?.deliveries?.[0]?.shippingFee?.toString() ?? ''}
/>

{#if $orderData.orderId}
	<div class="header">
		<ssk-text size="xl"
			>{$i18nKW['patona-sellercenter-orderdetail-channel-title']}</ssk-text
		>
		{#if isOnlineOrder && notCompletedOrCanceled}
			<ssk-icon name="outline-pencil-square" on:click={onEditPaymentAndDeliveryDetail} />
		{/if}
	</div>

	<div class="container">
		<ssk-text color="gray.500"
			>{$i18nKW['patona-sellercenter-orderdetail-channel-sale-channel']}</ssk-text
		>
		{#if $orderData.saleChannel?.type === SaleChannelType.Offline}
			{@const deliveryKey = orderDeliveryI18nKey($orderData.saleChannel?.saleOrigin)}
			<ssk-text>
				<ssk-i18n-translate
					key={orderChannelI18nKey($orderData.saleChannel?.type)}
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
				{#if deliveryKey}
					-
					<ssk-i18n-translate
						key={deliveryKey}
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				{/if}
			</ssk-text>
		{:else}
			<IconLabel label={salesChannel?.label ?? ''} icon={salesChannel?.icon ?? ''} />
		{/if}
	</div>
	<PaymentInfo />
	{#if $orderData.saleChannel?.type === SaleChannelType.Online}
		<div class="container">
			<ssk-text color="gray.500"
				>{$i18nKW['patona-sellercenter-orderdetail-channel-delivery-method']}</ssk-text
			>
			<IconLabel label={delivery?.label ?? ''} icon={delivery?.icon ?? ''} />

			<ssk-text color="gray.500"
				>{$i18nKW['patona-sellercenter-orderdetail-channel-shipping-fee']}</ssk-text
			>
			<ssk-text class="value">
				฿ {formatPrice($shippingFee)}
			</ssk-text>
		</div>
	{/if}
{/if}

<style>
	.container {
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		padding: 1.5rem;
		display: grid;
		gap: 0.5rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header > ssk-icon {
		cursor: pointer;
	}
</style>
