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
	export let columns: 3 | 4 | 5 = 3;
	let productNotFound = '';

	$: compact = columns >= 5;

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
	<div class="card-content" style="--cols: {columns}">
		{#each $salesProductList.data as product}
			<Item product_info={product} {compact} />
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
		grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
		gap: 1em;
	}

	/* The product pane stays side by side with the cart pane at every width
	   (Sale.svelte never stacks them) — so on a tablet the left pane itself is
	   narrower than on desktop, not the whole screen. A 216px floor would only
	   ever fit one column once the pane itself drops under ~450px, turning
	   browsing into a long single-file list well before the device is actually
	   phone-sized. Shrinking the floor keeps 2-3 visibly-clear columns in the
	   pane instead. */
	@media (max-width: 1024px) {
		.card-content {
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
			gap: 0.75em;
		}
	}

	/* Phone-width window (or a phone-narrow split POS view): shrink further so
	   two columns still fit inside the left pane's own, now even narrower, share
	   of the screen. */
	@media (max-width: 480px) {
		.card-content {
			/* Cap at 2 columns regardless of the chosen density so cards never
			   shrink below a legible size on phone-width panes. */
			grid-template-columns: repeat(min(var(--cols, 3), 2), minmax(0, 1fr));
			gap: 0.5em;
		}
	}
</style>
