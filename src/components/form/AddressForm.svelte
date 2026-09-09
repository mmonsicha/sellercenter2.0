<script lang="ts">
	import type { Address, Country } from '$lib/entities/address/address';
	import { type StringKey } from '$lib/types';
	import { countriesList } from '$stores/country';
	import { searchGeoNames, type GeoNamesRow, type SearchResult } from '$stores/geo-names';
	import { currentLanguage, i18nKW } from '$stores/i18n';
	import { setUnsavedChanges } from '$stores/saved-changes';
	import { addressFormSchema } from '$utils/form-validation/address-form';
	import { ValidationError } from 'yup';
	import GeoNameBreadCrumb from '$components/form/GeoNameBreadCrumb.svelte';
	import { onDestroy, onMount } from 'svelte';

	export let address: Partial<Address> | undefined;
	export let validationError: Record<string, string> = {};
	export let formTouched: boolean = false;
	export let currentCountry: Country | undefined;
	export let formName: string | undefined;
	export let isValid: boolean = false;

	let geoNames: { loading: boolean; field?: string } & SearchResult = {
		loading: false,
		geoNames: [],
		total: 0
	};

	let openDropdown: string | undefined = undefined;

	$: currentCountry = $countriesList.data?.find((country) => country.iso === address?.country?.iso);

	// Update isValid based on required fields and validation errors
	$: isValid = !!(
		address &&
		address.street &&
		address.country?.iso &&
		address.postalCode &&
		Object.keys(validationError).filter(
			(key) => validationError[key] && validationError[key].trim() !== ''
		).length === 0
	);

	const loadGeoNames = async (countryCode: string, field: keyof Address, keyword: string = '') => {
		geoNames = {
			field: field as keyof Address,
			loading: true,
			geoNames: [],
			total: 0
		};

		let result: SearchResult | undefined;
		if ((keyword.length ?? 0) >= 3) {
			result = await searchGeoNames(countryCode, field as any, keyword);
		}

		geoNames = {
			field: field as keyof Address,
			loading: false,
			geoNames: result?.geoNames ?? [],
			total: result?.total ?? 0
		};
	};

	const handleAddressFieldChanged = async (e: CustomEvent) => {
		const target = e.target as HTMLInputElement;
		const field = target.name as StringKey<Address>;
		if (!field || !address) return;

		setUnsavedChanges(true, formName);

		address[field] = target.value as any;

		try {
			const postalCodeFormat = currentCountry?.settings?.postalCodeFormat
				? new RegExp(currentCountry.settings.postalCodeFormat)
				: /.*/;

			address[field] = addressFormSchema(postalCodeFormat).validateSyncAt(field, address);
			target.value = address[field]! as string;
			validationError[field] = '';
		} catch (error) {
			if (error instanceof ValidationError) {
				validationError[field] = error.errors?.[0] || '';
			}
		}

		formTouched = true;

		loadGeoNames(address?.country?.iso!, field, target.value);
	};

	const handleCountryChange = (event: CustomEvent) => {
		if (!address) return;

		const selectedCountry = $countriesList.data?.find(
			(country) => country.iso === (event.target as HTMLInputElement).value
		);

		if (selectedCountry) {
			address.country = selectedCountry;
			currentCountry = selectedCountry;
			setUnsavedChanges(true, formName);
			formTouched = true;
		}
	};

	const handleGeoNamesClick = (gn: GeoNamesRow) => {
		if (!address) return;

		const lang = gn.language || $currentLanguage.code;

		address = {
			...address,
			administrativeAreaLevel1: gn.addressMapper?.administrative_name_level_1?.[lang] || '',
			administrativeAreaLevel2: gn.addressMapper?.administrative_name_level_2?.[lang],
			administrativeAreaLevel3: gn.addressMapper?.administrative_name_level_3?.[lang],
			localityAreaLevel1: gn.addressMapper?.locality_name_level_1?.[lang],
			localityAreaLevel2: gn.addressMapper?.locality_name_level_2?.[lang],
			localityAreaLevel3: gn.addressMapper?.locality_name_level_3?.[lang],
			postalCode: gn.postalCode || address.postalCode
		};

		validationError = {
			administrativeAreaLevel1: '',
			administrativeAreaLevel2: '',
			administrativeAreaLevel3: '',
			localityAreaLevel1: '',
			localityAreaLevel2: '',
			localityAreaLevel3: '',
			postalCode: '',
			street: ''
		};

		geoNames = {
			field: undefined,
			loading: false,
			geoNames: [],
			total: 0
		};

		closeAllDropdowns();
		setUnsavedChanges(true, formName);
		formTouched = true;
	};

	const closeAllDropdowns = () => {
		openDropdown = undefined;
	};

	const toggleDropdown = (field: string) => {
		if (openDropdown === field) {
			openDropdown = undefined;
		} else {
			openDropdown = field;
		}
	};

	const handleDropdownBlur = (field: string) => {
		setTimeout(() => {
			if (openDropdown === field) {
				openDropdown = undefined;
			}
		}, 150);
	};

	const handleAutoComplateInputClick = (e: CustomEvent) => {
		const target = e.target as HTMLInputElement;
		const field = target.name as StringKey<Address>;

		toggleDropdown(field);
		loadGeoNames(address?.country?.iso!, field, target.value);
	};

	const addrMapper: Array<keyof NonNullable<Country['addressMapper']>> = [
		'administrativeAreaLevel1',
		'administrativeAreaLevel2',
		'administrativeAreaLevel3',
		'localityAreaLevel1',
		'localityAreaLevel2',
		'localityAreaLevel3'
	];

	$: addressLevels = addrMapper
		.map((key) => ({
			level: key,
			name: currentCountry?.addressMapper?.[key],
			geoNames: geoNames.field === key ? geoNames.geoNames : []
		}))
		.filter((c) => !!c.name);

	let countryLabel = '';
	let postalCodeLabel = '';
	let addressLabel = '';

	let postalCodePhd = '';
	let countryPhd = '';
	let addressPhd = '';

	let selectPhd = '';

	$: mapTranslateLabelAndPlaceHolder = (level: any) => {
		switch (level.level) {
			default:
				return { label: level.name, placeholder: `${selectPhd}${level.name}` };
		}
	};

	$: {
		countryLabel = $i18nKW['patona-sellercenter-addressform-input-label-country'] || 'Country';
		postalCodeLabel =
			$i18nKW['patona-sellercenter-addressform-input-label-postalcode'] || 'Postal Code';
		addressLabel = $i18nKW['patona-sellercenter-addressform-input-label-address'] || 'Address';
		countryPhd =
			$i18nKW['patona-sellercenter-addressform-input-placeholder-country'] || 'Select country';
		postalCodePhd =
			$i18nKW['patona-sellercenter-addressform-input-placeholder-postalcode'] ||
			'Enter postal code';
		addressPhd =
			$i18nKW['patona-sellercenter-addressform-input-placeholder-address'] || 'Enter address';
		selectPhd = $i18nKW['patona-sellercenter-addressform-input-placeholder-select'] || 'Select';
	}

	let formContainer: HTMLDivElement;

	const handleClickOutside = (event: MouseEvent) => {
		if (formContainer && !formContainer.contains(event.target as Node)) {
			closeAllDropdowns();
		}
	};

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="form" bind:this={formContainer}>
	<div class="form-group">
		<ssk-dropdown
			size="md"
			label={countryLabel}
			placeholder={countryPhd}
			required
			name="country.iso"
			value={address?.country?.iso}
			themeColor="primary"
		>
			<ssk-dropdown-button slot="selected">
				<ssk-dropdown-preview value={address?.country?.iso}>
					{#if currentCountry?.name}
						{currentCountry.name}
					{:else}
						<ssk-i18n-translate
							key="patona-sellercenter-addressform-input-placeholder-country"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					{/if}
				</ssk-dropdown-preview>
			</ssk-dropdown-button>
			{#each $countriesList.data ?? [] as country}
				<ssk-dropdown-option value={country.iso} on:click={handleCountryChange}>
					{country.name}
				</ssk-dropdown-option>
			{/each}
		</ssk-dropdown>

		<ssk-dropdown
			themeColor="primary"
			testId="dropdown.postalCode"
			forceOpen={openDropdown === 'postalCode' &&
				geoNames.field === 'postalCode' &&
				geoNames.geoNames.length > 0}
			state={{ isOpen: false, setValue: () => {} }}
		>
			<ssk-input
				slot="selected"
				size="md"
				label={postalCodeLabel}
				placeholder={postalCodePhd}
				required
				name="postalCode"
				on:input={handleAddressFieldChanged}
				on:click={handleAutoComplateInputClick}
				on:blur={() => handleDropdownBlur('postalCode')}
				value={address?.postalCode}
				helperText={$i18nKW[validationError.postalCode] || validationError.postalCode}
				error={!!validationError.postalCode}
			/>

			{#each geoNames.geoNames as gn}
				<ssk-dropdown-option on:click={() => handleGeoNamesClick(gn)}>
					<GeoNameBreadCrumb field="postalCode" geoNames={gn} />
				</ssk-dropdown-option>
			{/each}
		</ssk-dropdown>

		{#each addressLevels as level}
			<ssk-dropdown
				themeColor="primary"
				testId={`dropdown.${level}`}
				forceOpen={openDropdown === level.level && level.geoNames.length > 0}
				state={{ isOpen: false }}
			>
				<ssk-input
					slot="selected"
					size="md"
					label={mapTranslateLabelAndPlaceHolder(level).label}
					placeholder={mapTranslateLabelAndPlaceHolder(level).placeholder}
					name={level.level}
					on:input={handleAddressFieldChanged}
					on:click={handleAutoComplateInputClick}
					on:blur={() => handleDropdownBlur(level.level)}
					value={address?.[level.level]}
					helperText={$i18nKW[validationError[level.level]] || validationError[level.level]}
					error={!!validationError[level.level]}
				/>

				{#each level.geoNames as gn}
					<ssk-dropdown-option on:click={() => handleGeoNamesClick(gn)}>
						<GeoNameBreadCrumb field={level.level} geoNames={gn} />
					</ssk-dropdown-option>
				{/each}
			</ssk-dropdown>
		{/each}
	</div>

	<ssk-textarea
		themeColor="primary"
		label={addressLabel}
		placeholder={addressPhd}
		limit={255}
		rows={4}
		size="md"
		required
		name="street"
		value={address?.street}
		helperText={$i18nKW[validationError.street] || validationError.street}
		error={!!validationError.street}
		on:input={handleAddressFieldChanged}
		on:change={handleAddressFieldChanged}
	></ssk-textarea>
</div>

<style>
	.form-group {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.form-group > *:nth-last-child(1):nth-child(odd) {
		grid-column: span 2;
	}

	.form {
		display: grid;
		gap: 16px;
	}

	ssk-textarea {
		--background-color: white;
	}

	@container (max-width: 600px) {
		.form-group {
			grid-template-columns: 1fr;
		}

		.form-group > * {
			grid-column: span 1 !important;
		}
	}
</style>
