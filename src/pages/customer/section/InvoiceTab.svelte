<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import {
		customerAddressToString,
		translateTaxKind,
		type TaxInformation
	} from '$lib/entities/customer/customer';
	import { countriesList } from '$stores/country';
	import { currentLanguage } from '$stores/i18n';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';

	export let data: TaxInformation[] = [];

	const i18nStore = getContext<I18nStore>('i18n');
	let noTaxAddress: string = '';

	$: formattedData = data.map((tax, index) => {
		const countryName =
			$countriesList.data?.find((c) => c.iso === tax.country?.iso)?.name || tax.country?.iso || '';
		const taxString = customerAddressToString(tax, countryName);
		return { ...tax, index, taxString };
	});

	const loadKeywords = async () => {
		noTaxAddress = await i18nStore.get(
			'patona-sellercenter-customerbook-notaxaddress',
			$currentLanguage.code,
			'default'
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

<div class="container">
	<ssk-dynamic-table height="100%" columnsWidth={['auto', '2fr', '2fr', '3fr', '3fr', '3fr']}>
		<ssk-header-cell slot="headers"></ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-taxaddress-table-header-type"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left"
			><ssk-i18n-translate
				key="patona-sellercenter-customerbook-taxaddress-table-header-name"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/></ssk-header-cell
		>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-taxaddress-table-header-taxid"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-taxaddress-table-header-email"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-taxaddress-table-header-address"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>

		{#if formattedData.length > 0}
			{#each formattedData as tax, index}
				<ssk-table-cell align="center">
					<ssk-text color="gray.800">{index + 1}</ssk-text>
				</ssk-table-cell>
				<ssk-table-cell align="left">
					<ssk-text color="gray.800">{translateTaxKind(tax.kind)}</ssk-text>
				</ssk-table-cell>
				<ssk-table-cell align="left">
					<div class="tax-info">
						<div class="overflow-ellipsis">
							<ssk-text color="gray.800">{tax.fullName}</ssk-text>
						</div>
						{#if tax.branchName}
							<div class="branch-name">
								<ssk-text size="sm" color="gray.500">{tax.branchName}</ssk-text>
							</div>
						{/if}
					</div>
				</ssk-table-cell>
				<ssk-table-cell align="left">
					<ssk-text color="gray.800">{tax.taxNumber}</ssk-text>
				</ssk-table-cell>
				<ssk-table-cell align="left">
					<ssk-text color="gray.800">{tax.email ? tax.email : '-'}</ssk-text>
				</ssk-table-cell>
				<ssk-table-cell align="left">
					<ssk-text color="gray.800">{tax.taxString}</ssk-text>
				</ssk-table-cell>
			{/each}
		{:else}
			<div slot="placeholder">
				<BlankPage description={noTaxAddress} />
			</div>
		{/if}
	</ssk-dynamic-table>
</div>

<style lang="css">
	.tax-info {
		width: -webkit-fill-available;
	}
	.overflow-ellipsis {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		font-size: 24px;
		color: var(--ssk-colors-gray-800);
	}
	.branch-name {
		display: flex;
		gap: 0.25rem;
	}

	ssk-dynamic-table {
		--table-border-color: var(--ssk-colors-gray-200);
		color: var(--ssk-colors-gray-500);
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
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
</style>
