<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import Item from '$pages/sales/ProductItem.svelte';
	import { currentLanguage } from '$stores/i18n';
	import { salesProductList } from '$stores/sales/sales';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import InfiniteScroll from 'svelte-infinite-scroll';

	const i18nStore = getContext<I18nStore>('i18n');
	export let loadMore: () => void;
	let productNotFound = '';

	const loadKeywords = async () => {
		productNotFound = await i18nStore.get(
			'patona-sellercenter-sales-subtitle-productsfound',
			$currentLanguage.code,
			'default'
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

{#if $salesProductList.data && $salesProductList.data.length > 0}
	<div class="card-content">
		{#each $salesProductList.data as product}
			<Item product_info={product} />
		{/each}
	</div>
	<InfiniteScroll
		hasMore={$salesProductList.data && $salesProductList.data.length < $salesProductList.total}
		threshold={100}
		on:loadMore={loadMore}
	/>
{:else}
	<BlankPage description={productNotFound} />
{/if}

<style lang="css">
	.card-content {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(216px, 1fr));
		gap: 1em;
	}
</style>
