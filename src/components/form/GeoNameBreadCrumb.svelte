<script lang="ts">
	import type { Address, GeoNamesAddressMapper } from '$lib/entities/address/address';
	import type { StringKey } from '$lib/types';
	import { countryMapperNames, type GeoNamesRow } from '$stores/geo-names';
	import { currentLanguage } from '$stores/i18n';

	export let field: StringKey<Address>;
	export let geoNames: GeoNamesRow;

	let lang = geoNames.language || $currentLanguage.code;

	const level = countryMapperNames[field];

	const levelOrder: (keyof GeoNamesAddressMapper)[] = [
		'administrative_name_level_1',
		'administrative_name_level_2',
		'administrative_name_level_3',
		'locality_name_level_1',
		'locality_name_level_2',
		'locality_name_level_3'
	];
</script>

<span>
	{#if geoNames?.addressMapper && lang}
		{#each levelOrder as key, i}
			{#if typeof geoNames.addressMapper[key] === 'object' && geoNames.addressMapper[key] !== null}
				{#if geoNames.addressMapper[key][lang]}
					{#if level === key}
						<b>{geoNames.addressMapper[key][lang]}</b>
					{:else}
						<span>{geoNames.addressMapper[key][lang]}</span>
					{/if}
					<span> &gt; </span>
				{/if}
			{/if}
		{/each}

		{#if field === 'postalCode'}
			<b>{geoNames.postalCode}</b>
		{:else}
			<span>{geoNames.postalCode}</span>
		{/if}
	{/if}
</span>

<style>
	span {
		display: flex;
		text-wrap: nowrap;
		flex-flow: row wrap;
		gap: 0.25rem;
	}

	b {
		font-weight: 600;
	}
</style>
