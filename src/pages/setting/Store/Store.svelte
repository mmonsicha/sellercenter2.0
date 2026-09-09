<script lang="ts">
	import { newCompany } from '$lib/entities/company/company';
	import { companyData, companyList, setCompanyData } from '$stores/company/company';
	import { currentCompany } from '$stores/company/current-company';
	import { configurationStore } from '$stores/configuration';
	import { currentStore } from '$stores/store/current-store';
	import { beforeUpdate, onDestroy } from 'svelte';
	import StoreDetail from './StoreDetail.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';

	let companyId: string;
	let storeId: string;
	let prevCompanyId: string;

	beforeUpdate(() => {
		prevCompanyId = companyId;

		companyId = $configurationStore.data?.user?.selectedCompanyId || $currentCompany?.id!;
		storeId = $configurationStore.data?.user?.selectedStoreId || $currentStore?.id!;

		if (prevCompanyId !== companyId) {
			if ($companyList.data && $companyList.data.length > 0) {
				setCompanyData($companyList.data?.find((c) => c.id === companyId));
			}
		}
	});

	onDestroy(() => {
		companyData.set(newCompany());
	});
</script>

{#key storeId}
	{#if $currentStore && $companyData.id}
		<StoreDetail {...{ company: $companyData }} />
	{:else}
		<LoadingPage description="loading" />
	{/if}
{/key}
