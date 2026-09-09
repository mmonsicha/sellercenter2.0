<script lang="ts">
	import type { Country } from '$lib/entities/address/address';
	import type { Customer } from '$lib/entities/customer/customer';
	import { customerSchema } from '$lib/entities/customer/validator';
	import type { StringKey } from '$lib/types';
	import { countriesList } from '$stores/country';
	import { currentLanguage } from '$stores/i18n';
	import { setUnsavedChanges } from '$stores/saved-changes';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { ValidationError } from 'yup';

	export let customer: Partial<Customer> = {};
	export let validationError: Record<string, string> = {};
	export let formTouched: boolean = false;
	export let currentCountry: Country | undefined;

	const i18nStore = getContext<I18nStore>('i18n');

	let nameLabel: string = '';
	let namePlaceholder: string = '';
	let lastNameLabel: string = '';
	let lastNamePlaceholder: string = '';
	let phoneLabel: string = '';
	let phonePlaceholder: string = '';
	let emailLabel: string = '';
	let emailPlaceholder: string = '';

	const handleCustomerFieldChanged = (
		field: StringKey<Customer>,
		op: { shouldTrim?: boolean; onlyNumber?: boolean } = { shouldTrim: false, onlyNumber: false }
	) => {
		return (e: CustomEvent) => {
			if (!field) return;

			setUnsavedChanges(true);

			const target = e.target as HTMLInputElement;
			let value = target.value;

			if (op.shouldTrim) {
				value = value.trim();
				target.value = value;
			}
			if (op.onlyNumber) {
				value = value.replace(/[^0-9]/g, '');
				target.value = value;
			}

			customer[field] = value;

			try {
				customerSchema(currentCountry).validateSyncAt(field, customer);
				validationError[field] = '';
			} catch (error) {
				if (error instanceof ValidationError) {
					validationError[field] = error.errors?.[0];
				}
			}

			formTouched = true;
		};
	};

	let nameErrorMsg: string = validationError.firstName || '';
	let lastNameErrorMsg: string = validationError.lastName || '';
	let phoneErrorMsg: string = validationError.phone || '';
	let emailErrorMsg: string = validationError.email || '';

	const loadKeywordsErrorMsg = async () => {
		const lang = $currentLanguage.code;
		const fallback = 'default';

		nameErrorMsg = await i18nStore.get(validationError.firstName, lang, fallback);
		lastNameErrorMsg = await i18nStore.get(validationError.lastName, lang, fallback);
		phoneErrorMsg = await i18nStore.get(validationError.phone, lang, fallback);
		emailErrorMsg = await i18nStore.get(validationError.email, lang, fallback);
	};

	const formattedCountries = $countriesList.data?.map((country) => ({
		code: country.iso,
		name: country.iso === 'THA' ? 'Thailand' : country.name,
		phoneCode: country.phoneCode
	}));

	const handleCountryChange = (event: CustomEvent) => {
		const selectedCountry = $countriesList.data?.find(
			(country) => country.iso === event.detail.value
		);

		if (selectedCountry) {
			customer.countryCode = selectedCountry.iso;
			currentCountry = selectedCountry;
			setUnsavedChanges(true);
			formTouched = true;
		}
	};

	const loadKeywords = async () => {
		const lang = $currentLanguage.code;
		const fallback = 'default';

		nameLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-add-label-name',
			lang,
			fallback
		);

		namePlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-add-placeholder-name',
			lang,
			fallback
		);

		lastNameLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-add-label-lastname',
			lang,
			fallback
		);
		lastNamePlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-add-placeholder-lastname',
			lang,
			fallback
		);
		phoneLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-add-label-phone',
			lang,
			fallback
		);
		phonePlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-add-placeholder-phone',
			lang,
			fallback
		);
		emailLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-add-label-email',
			lang,
			fallback
		);
		emailPlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-add-placeholder-email',
			lang,
			fallback
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();

		if (validationError) {
			loadKeywordsErrorMsg();
		}
	}
</script>

<div class="form">
	<ssk-input
		size="md"
		label={nameLabel}
		placeholder={namePlaceholder}
		required
		name="firstName"
		on:input={handleCustomerFieldChanged('firstName')}
		on:change={handleCustomerFieldChanged('firstName', { shouldTrim: true })}
		value={customer.firstName}
		helperText={nameErrorMsg}
		error={!!nameErrorMsg}
	/>
	<ssk-input
		size="md"
		label={lastNameLabel}
		placeholder={lastNamePlaceholder}
		required
		name="lastName"
		on:input={handleCustomerFieldChanged('lastName')}
		on:change={handleCustomerFieldChanged('lastName', { shouldTrim: true })}
		value={customer.lastName}
		helperText={lastNameErrorMsg}
		error={!!lastNameErrorMsg}
	/>
	<ssk-input
		size="md"
		label={phoneLabel}
		placeholder={phonePlaceholder}
		required
		name="phone"
		on:input={handleCustomerFieldChanged('phone', { shouldTrim: true, onlyNumber: true })}
		on:change={handleCustomerFieldChanged('phone', { shouldTrim: true, onlyNumber: true })}
		value={customer.phone}
		helperText={phoneErrorMsg}
		error={!!phoneErrorMsg}
	>
		<ssk-addon-phone-country
			slot="prefix"
			countries={formattedCountries}
			value={customer.countryCode || 'THA'}
			on:change={handleCountryChange}
		>
		</ssk-addon-phone-country>
	</ssk-input>

	<ssk-input
		size="md"
		label={emailLabel}
		placeholder={emailPlaceholder}
		name="email"
		on:input={handleCustomerFieldChanged('email')}
		on:change={handleCustomerFieldChanged('email', { shouldTrim: true })}
		value={customer.email}
		helperText={emailErrorMsg}
		error={!!emailErrorMsg}
		limit="254"
	/>
</div>

<style lang="css">
	.form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	@container (max-width: 600px) {
		.form {
			grid-template-columns: 1fr;
		}
	}
</style>
