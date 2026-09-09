<script lang="ts">
	import { OrderTaskName, Status } from '$lib/entities/order/order';
	import { currentLanguage } from '$stores/i18n';
	import { orderData } from '$stores/order/order';
	import { openDeliverModal } from '$stores/order/deliver-modal';

	$: paymentTask = $orderData.tasks?.find((t) => t.name === OrderTaskName.Payments);

	function _onClickDeliver() {
		openDeliverModal($orderData);
	}
</script>

{#if $orderData.orderId}
	{#if $orderData.status === Status.Pending || $orderData.status === Status.Processing}
		{#if paymentTask?.status === Status.Completed}
			<ssk-button
				width="full"
				on:click={_onClickDeliver}
				data-testid="order-view.actions.button.deliver"
			>
				<ssk-i18n-translate
					key="patona-sellercenter-orderdetail-button-deliver"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-button>
		{/if}
	{/if}
{/if}
