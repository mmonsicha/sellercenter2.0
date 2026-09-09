<script lang="ts">
	import { formatPrice } from '$utils/format-number';
	import ItemTable from './Table/ItemTable.svelte';
	import { OrderFlow, type PricingDetail } from '$lib/entities/order/order';
	import { currentLanguage } from '$stores/i18n';
	import { orderData, shippingFee } from '$stores/order/order';

	let hasDiscount: boolean = false;
	let discountPrice: number = 0;
	$: isOnline =
		$orderData.flow.type === OrderFlow.POS_ONLINE ||
		$orderData.flow.type === OrderFlow.POS_ONLINE_SUKIPAY_V1;
	$: netPrice = $orderData.buyerStatement.netPrice ?? 0;

	function calDiscount(details: PricingDetail[] = []): number {
		return details.reduce((total, d) => {
			return d.kind === 'discount' ? total + Math.abs(d.amount!) : total;
		}, 0);
	}

	$: {
		discountPrice = calDiscount($orderData.buyerStatement.details);
		hasDiscount = ($orderData.buyerStatement?.details ?? []).length > 0 && discountPrice > 0;
	}
</script>

{#if $orderData.orderId}
	<div class="order-detail">
		<div class="pre-table">
			<div class="title">
				<ssk-text size="xl" color="gray.800">
					<ssk-i18n-template
						key="patona-sellercenter-orderdetail-title-listitem"
						data={{ count: $orderData.items.length }}
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
			</div>
			<ItemTable items={$orderData.items} />
		</div>
		<div class="footer">
			<div class="price-summary">
				<div class="price-item">
					<ssk-text color="gray.800">
						<ssk-i18n-translate
							key="patona-sellercenter-orderdetail-summary-totalamount"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>
					<ssk-text class="value" color="gray.800">
						฿{formatPrice($orderData.buyerStatement.totalPrice ?? 0)}
					</ssk-text>
				</div>
				{#if hasDiscount}
					<div class="price-item discount">
						<ssk-text color="gray.800">
							<ssk-i18n-translate
								key="patona-sellercenter-orderdetail-summary-discount"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
						<ssk-text class="value" color="rose.600">
							-฿{formatPrice(Math.abs(discountPrice))}
						</ssk-text>
					</div>
				{/if}
				{#if isOnline}
					<div class="price-item">
						<ssk-text>
							<ssk-i18n-translate
								key="patona-sellercenter-orderdetail-summary-shippingfee"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
						<ssk-text class="value">
							฿{formatPrice(Math.abs($shippingFee))}
						</ssk-text>
					</div>
				{/if}
				<div class="price-item total">
					<ssk-text fontWeight="bold" color="gray.800">
						<ssk-i18n-translate
							key="patona-sellercenter-orderdetail-summary-grandtotal"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>
					<ssk-text class="value" size="xl" color="primary.500">
						฿{formatPrice(netPrice + $shippingFee)}
					</ssk-text>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.title {
		padding: 1.5rem;
	}

	.order-detail {
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;

		display: flex;
		flex-direction: column;
		justify-content: space-between;

		height: fit-content;
	}

	.footer {
		padding: 1.5rem;
	}

	.price-summary {
		background-color: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		display: grid;
		padding: 1.5rem;

		grid-template-columns: 1fr auto;
		gap: 8px;
	}

	.price-item {
		display: contents;
	}

	.price-item > .value {
		text-align: end;
	}

	.pre-table {
		display: contents;
	}
</style>
