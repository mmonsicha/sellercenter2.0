<script lang="ts">
	import { configurationStore } from '$stores/configuration';
	import { currentStore } from '$stores/store/current-store';
	import { getItem, localStorageKey } from '$utils/local-storage';
	import IframeProduct from './IframeProduct.svelte';

	let currentStoreId: string = $configurationStore.data?.user?.selectedStoreId

	currentStore.subscribe((s) => {
		if (s?.id) {
			currentStoreId = s.id;
		}
	});
</script>

{#key currentStoreId}
	<IframeProduct iframePath="product-list" iframeTitle="Embedded Suki Space Product List" />
{/key}
