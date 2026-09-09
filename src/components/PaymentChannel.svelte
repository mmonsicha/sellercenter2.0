<script lang="ts">
	import { type Order } from '$lib/entities/order/order';
	import { currentLanguage } from '$stores/i18n';
	import {
		findPaymentLabelBySaleOrigin,
		getBadgeThemeFromTaskStatus,
		mapOrderPayment,
		marketplaceValues
	} from '$utils/utils-order';

	export let order: Order;
	export let testid: string = '';

	const tPaymentDetail = mapOrderPayment(order.tasks, order.paymentType);
</script>

<div data-testid={testid}>
	<ssk-badge
		variant="subtle"
		size="md"
		themecolor={getBadgeThemeFromTaskStatus(tPaymentDetail.status)}
	>
		<ssk-i18n-translate
			key={tPaymentDetail.label}
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-badge>
	<ssk-text size="xs" color="stroke">
		{#if order.saleChannel?.saleOrigin && marketplaceValues.includes(order.saleChannel.saleOrigin)}
			{findPaymentLabelBySaleOrigin(order.saleChannel.saleOrigin)}
		{:else}
			<ssk-i18n-translate
				key={tPaymentDetail.type}
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		{/if}
	</ssk-text>
</div>
