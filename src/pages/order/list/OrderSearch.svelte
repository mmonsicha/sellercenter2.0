<script lang="ts">
	import { currentLanguage } from '$stores/i18n';
	import { debouncedSearch, isClearSearchFilter, oFilter } from '$stores/order/filter';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import type { OrderStatus } from './filterHandler';
	import FilterPopup from './FilterPopup.svelte';
	export let oType: OrderStatus;

	const i18nStore = getContext<I18nStore>('i18n');
	let disabled: boolean = true;
	let badgeFilter: string;
	let searchValue: string = '';
	let fTotal: string;
	let phdSearch = '';

	oFilter.subscribe((f) => {
		badgeFilter = f.total.toString();
		fTotal = badgeFilter;
	});

	$: if ($oFilter) searchValue = $oFilter.search ?? '';

	function togglePopup() {
		disabled = !disabled;
	}

	const _onChange = async (e: Event) => {
		searchValue = (e.target as HTMLInputElement).value.trim();
		debouncedSearch(searchValue);
	};

	const loadKeywords = async () => {
		phdSearch = await i18nStore.get(
			'patona-sellercenter-myorder-placeholder-search',
			$currentLanguage.code,
			'default'
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}

	$: {
		if ($isClearSearchFilter) {
			searchValue = '';
			debouncedSearch(searchValue);
		}
	}
</script>

<div class="input-container">
	<ssk-input
		placeholder={phdSearch}
		value={searchValue}
		on:input={_onChange}
		testId="orders.input.search"
	>
		<ssk-input-addon slot="prefix">
			<ssk-icon name="outline-magnifying-glass" size="md"></ssk-icon>
		</ssk-input-addon>
		{#if searchValue}
			<ssk-input-addon
				slot="postfix"
				on:click={() => {
					searchValue = '';
					debouncedSearch(searchValue);
				}}
				data-testid="orders.button.clear"
			>
				<ssk-icon name="outline-x-circle"></ssk-icon>
			</ssk-input-addon>
		{/if}
	</ssk-input>
	<div class="filter">
		<ssk-button
			variant="solid-light"
			width="full"
			themeColor="gray"
			on:click={togglePopup}
			data-testid="orders.button.filter"
		>
			<ssk-icon slot="prefix" name="outline-funnel" color="gray.500"></ssk-icon>
			<ssk-text color="gray.800">
				<ssk-i18n-translate
					key="patona-sellercenter-myorder-button-filter"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
			{#if badgeFilter !== '0'}
				<ssk-badge slot="postfix" variant="subtle" data-testid="orders.badge.counter-filter"
					>{badgeFilter}</ssk-badge
				>
			{/if}
		</ssk-button>
		<FilterPopup bind:disabled {oType} />
	</div>
</div>

<style lang="css">
	.input-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
	}

	.filter {
		position: relative;
	}

	ssk-input {
		--background-color: white;
		--border-color: var(--ssk-colors-gray-200);
		--gap: 0.5rem;
		width: 358px;
	}
</style>
