<script lang="ts">
	import { FullfilmentType } from '$lib/entities/order/order';
	import { currentLanguage, i18nKW } from '$stores/i18n';
	import { orderData } from '$stores/order/order';

	function onClickToCustomer(refId?: string) {
		window.open(`/customers/view/${refId}`, '_blank');
	}
</script>

<ssk-text size="xl">{$i18nKW['patona-sellercenter-orderdetail-customer-title']}</ssk-text>

<div class="container">
	<div class="changed-summary">
		<div class="item">
			<div class="label">
				<ssk-text color="gray.500">
					<ssk-i18n-translate
						key="patona-sellercenter-orderdetail-title-customername"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
			</div>
			<div class="value">
				<div class="customer-action">
					<ssk-text>{$orderData.buyer.name ?? '-'}</ssk-text>
					{#if $orderData.saleChannel?.saleOrigin !== FullfilmentType.PickupImmediate}
						<ssk-icon
							on:click={() => {
								onClickToCustomer($orderData.buyer.refId);
							}}
							name="outline-arrow-top-right-on-square"
						/>
					{/if}
				</div>
			</div>
		</div>
		<div class="item">
			<div class="label">
				<ssk-text color="gray.500"
					>{$i18nKW['patona-sellercenter-orderdetail-customer-phone']}</ssk-text
				>
			</div>
			<div class="value">
				<ssk-text>{$orderData.buyer.phone ?? '-'}</ssk-text>
			</div>
		</div>
		<div class="item">
			<div class="label">
				<ssk-text color="gray.500"
					>{$i18nKW['patona-sellercenter-orderdetail-customer-email']}</ssk-text
				>
			</div>
			<div class="value">
				<ssk-text>{$orderData.buyer.email ?? '-'}</ssk-text>
			</div>
		</div>
		<div class="item">
			<div class="label">
				<ssk-text color="gray.500"
					>{$i18nKW['patona-sellercenter-orderdetail-customer-shipping-address']}</ssk-text
				>
			</div>
			<div class="value">
				<ssk-text>{$orderData.buyer.address ?? '-'}</ssk-text>
			</div>
		</div>
	</div>
</div>

<style>
	.container {
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		padding: 1.5rem;
		display: grid;
		gap: 0.5rem;
	}

	.customer-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.customer-action ssk-icon {
		cursor: pointer;
	}
	.changed-summary {
		display: grid;
		gap: 1rem;
	}

	.value {
		overflow-wrap: anywhere;
		white-space: normal;
	}
</style>
