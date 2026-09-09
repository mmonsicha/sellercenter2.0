<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import { customerAddressToString, type Address } from '$lib/entities/customer/customer';
	import { countriesList } from '$stores/country';
	import { currentLanguage } from '$stores/i18n';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	export let data: Address[] = [];

	const i18nStore = getContext<I18nStore>('i18n');
	let noShippingAddress: string = '';

	$: formattedData = data.map((address, index) => {
		const countryName =
			$countriesList.data?.find((c) => c.iso === address.country?.iso)?.name ||
			address.country?.name ||
			'';
		const addressString = customerAddressToString(address, countryName);
		return { ...address, index, addressString };
	});

	const loadKeywords = async () => {
		const language = $currentLanguage.code;
		const fallback = 'default';
		noShippingAddress = await i18nStore.get(
			'patona-sellercenter-customerbook-noshippingaddress',
			language,
			fallback
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

<div class="container">
	<ssk-dynamic-table height="100%" columnsWidth={['60px', '200px', '120px', 'minmax(200px, 1fr)']}>
		<ssk-header-cell slot="headers"></ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-shippingaddress-table-header-fullname"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-shippingaddress-table-header-phone"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-shippingaddress-table-header-address"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		{#if formattedData.length > 0}
			{#each formattedData as address, index}
				<ssk-table-cell align="center">
					<ssk-text color="gray.800">{index + 1}</ssk-text>
				</ssk-table-cell>
				<ssk-table-cell align="left">
					<ssk-text color="gray.800">{address.contactName}</ssk-text>
				</ssk-table-cell>
				<ssk-table-cell align="left">
					<ssk-text color="gray.800">{address.phone}</ssk-text>
				</ssk-table-cell>
				<ssk-table-cell align="left">
					<ssk-tooltip
						size="sm"
						themeColor="white"
						placement="topright"
						color="currentcolor"
						hideCloseButton={true}
					>
						<span slot="content" class="tooltip-content">
							<ssk-text color="gray.800">{address.addressString}</ssk-text>
						</span>
						<ssk-text>
							<span class="ellipsis" color="gray.800">{address.addressString}</span>
						</ssk-text>
					</ssk-tooltip>
					{#if address.isDefault}
						<ssk-badge variant="subtle" themeColor="primary">
							<ssk-i18n-translate
								key="patona-sellercenter-customerbook-shippingaddress-table-header-primaryaddress"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-badge>
					{/if}
				</ssk-table-cell>
			{/each}
		{:else}
			<div slot="placeholder">
				<BlankPage description={noShippingAddress} />
			</div>
		{/if}
	</ssk-dynamic-table>
</div>

<style lang="css">
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

	.tooltip-content {
		max-width: 500px;
		white-space: normal;
		word-break: break-word;
		width: auto;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ellipsis {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: normal;
		word-break: break-word;
		line-clamp: 2;
	}
</style>
