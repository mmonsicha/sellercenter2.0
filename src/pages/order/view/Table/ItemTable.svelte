<script lang="ts">
	import type { Item } from '$lib/entities/order/order';
	import { currentLanguage } from '$stores/i18n';
	import { formatPrice } from '$utils/format-number';
	import { getImageUrl } from '$utils/image-url';

	export let items: Item[] = [];
</script>

<div class="item-table">
	<ssk-dynamic-table
		height="100%"
		columnsWidth={['1fr', '3fr', 'minmax(200px, 6fr)', '4fr', '2fr', '4fr']}
	>
		<ssk-header-cell slot="headers"></ssk-header-cell>
		<ssk-header-cell slot="headers" align="center">
			<ssk-i18n-translate
				key="patona-sellercenter-orderdetail-table-header-productimage"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-orderdetail-table-header-productname"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-orderdetail-table-header-price"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-orderdetail-table-header-quantity"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-orderdetail-table-header-totalprice"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		{#each items as item, idx}
			<ssk-table-cell align="center">
				<ssk-text color="gray.800">{idx + 1}</ssk-text>
			</ssk-table-cell>
			<ssk-table-cell align="center">
				<div class="image">
					<ssk-image
						src={getImageUrl(item.image)}
						fallbacksrc="/images/products/default-product-image.png"
						objectfit="cover"
						boxsize="3rem"
					/>
				</div>
			</ssk-table-cell>
			<ssk-table-cell align="left">
				<div class="product">
					{#if item.productName.length > 30}
						<ssk-tooltip
							size="sm"
							themeColor="white"
							label={item.productName}
							maxWidth="400px"
							hideCloseButton
						>
							<div class="overflow-ellipsis">
								{item.productName}
							</div>
						</ssk-tooltip>
					{:else}
						<div class="overflow-ellipsis">
							{item.productName}
						</div>
					{/if}

					{#if item.variants}
						<div class="variants">
							<ssk-text size="sm" color="gray.500">
								{Object.entries(item.variants)
									.map(([key, value]) => `${key}: ${value}`)
									.join(' ')}
							</ssk-text>
						</div>
					{/if}
				</div>
			</ssk-table-cell>
			<ssk-table-cell align="left">
				<ssk-text color="gray.800"><span>฿</span> {formatPrice(item.salePrice)}</ssk-text>
			</ssk-table-cell>
			<ssk-table-cell>
				<ssk-text color="gray.800">{item.qty}</ssk-text>
			</ssk-table-cell>
			<ssk-table-cell align="left">
				<ssk-text color="gray.800"><span>฿</span> {formatPrice(item.salePrice * item.qty)}</ssk-text
				>
			</ssk-table-cell>
		{/each}
	</ssk-dynamic-table>
</div>

<style>
	ssk-dynamic-table {
		--table-border-color: var(--ssk-colors-gray-200);
		color: var(--ssk-colors-gray-500);
	}

	ssk-text > span {
		color: var(--ssk-colors-gray-500);
	}

	ssk-header-cell {
		z-index: 1;
		white-space: nowrap;
		position: inherit;
	}

	ssk-table-cell {
		width: 100%;
		height: 80px;
	}

	.variants {
		display: flex;
		gap: 0.25rem;
	}

	.image {
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 4px;
		height: 3rem;
	}

	.overflow-ellipsis {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		font-size: 24px;
		color: var(--ssk-colors-gray-800);
	}

	.product {
		width: -webkit-fill-available;
	}
</style>
