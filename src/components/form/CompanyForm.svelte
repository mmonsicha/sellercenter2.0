<script lang="ts">
	import type { Company } from '$lib/entities/company/company';
	import { countriesList } from '$stores/country';
	import { currentLanguage, i18nKW } from '$stores/i18n';
	import { isUpdatedSettings, setSettingFormatWithIso, setting } from '$stores/settings';
	import {
		companyFormSchema,
		initCompanyForm,
		type ICompanyForm
	} from '$utils/form-validation/company-form';
	import { tick } from 'svelte';

	import { ValidationError } from 'yup';

	export let onChange: any;
	export let testId: string = '';
	export let company: Company;
	export let isValidCompany: boolean;

	let nameLabel = '';
	let taxLabel = '';
	let emailLabel = '';
	let phoneLabel = '';
	let subPhoneLabel = '';

	let namePhd = '';
	let taxPhd = '';
	let emailPhd = '';
	let phonePhd = '';
	let subPhonePhd = '';

	const loadKeywords = async () => {
		nameLabel = $i18nKW['patona-sellercenter-company-create-input-label-companyname'];
		taxLabel = $i18nKW['patona-sellercenter-company-create-input-label-tax'];
		emailLabel = $i18nKW['patona-sellercenter-company-create-input-label-email'];
		phoneLabel = $i18nKW['patona-sellercenter-company-create-input-label-phone'];
		subPhoneLabel = $i18nKW['patona-sellercenter-company-create-input-label-subphone'];

		namePhd = $i18nKW['patona-sellercenter-company-create-input-placeholder-company'];
		taxPhd = $i18nKW['patona-sellercenter-company-create-input-placeholder-tax'];
		emailPhd = $i18nKW['patona-sellercenter-company-create-input-placeholder-email'];
		phonePhd = $i18nKW['patona-sellercenter-company-create-input-placeholder-phone'];
		subPhonePhd = $i18nKW['patona-sellercenter-company-create-input-placeholder-subphone'];
	};

	$: currentCountry = $countriesList.data?.find(
		(country) => country.iso === company.address.country?.iso
	);

	$: if ($currentLanguage?.code) {
		loadKeywords();
	}

	$: if (currentCountry?.iso) {
		setSettingFormatWithIso(currentCountry?.iso ?? 'THA');
		(async () => {
			await tick();
			if (form.phone || form.phone2 || form.taxNumber) {
				validateField('phone', form.phone);
				validateField('phone2', form.phone2);
				validateField('taxNumber', form.taxNumber);
			}
		})();
	}

	$: schema = companyFormSchema(
		new RegExp($setting?.settings?.phoneFormat || ''),
		new RegExp($setting?.settings?.taxIdFormat || '')
	);

	let form: ICompanyForm = initCompanyForm(company);
	let errors: Record<string, string> = {};

	function validateField(field: keyof ICompanyForm, value: any) {
		try {
			schema.validateSyncAt(field, form);
			errors[field] = '';
		} catch (err) {
			if (err instanceof ValidationError) {
				errors[field] = err.errors?.[0];
			}
		}
	}

	$: if (schema) {
		isValidCompany = Object.values(errors).every((v) => !v);
	}

	function handleCompanyFieldChanged(
		field: keyof ICompanyForm,
		op: { shouldTrim?: boolean; onlyNumber?: boolean } = { shouldTrim: false, onlyNumber: false }
	) {
		return (e: Event) => {
			const t = e.target as HTMLInputElement;
			let value = t.value;
			if (op.shouldTrim) {
				value = value.trim();
				t.value = value;
			}
			if (op.onlyNumber) {
				value = value.replace(/[^0-9]/g, '');
				t.value = value;
			}
			form[field] = value;
			validateField(field, value);
			onChange(form);
		};
	}
</script>

<div>
	<ssk-input
		testId={`${testId}.company-name.input`}
		size="md"
		name="name"
		label={nameLabel}
		limit="50"
		required
		placeholder={namePhd}
		helperText={!!errors.name ? $i18nKW[errors.name] : ''}
		value={form.name}
		error={!!errors.name}
		on:input={handleCompanyFieldChanged('name')}
		on:change={handleCompanyFieldChanged('name', { shouldTrim: true })}
	>
	</ssk-input>
</div>
<div>
	<ssk-input
		testId={`${testId}.tax-id.input`}
		size="md"
		name="taxNumber"
		label={taxLabel}
		limit="13"
		placeholder={taxPhd}
		helperText={!!errors.taxNumber ? $i18nKW[errors.taxNumber] : ''}
		value={form.taxNumber}
		error={!!errors.taxNumber}
		on:input={handleCompanyFieldChanged('taxNumber', { shouldTrim: true })}
		on:change={handleCompanyFieldChanged('taxNumber', { shouldTrim: true })}
	>
	</ssk-input>
</div>
<div>
	<ssk-input
		testId={`${testId}.company-email.input`}
		size="md"
		name="email"
		label={emailLabel}
		placeholder={emailPhd}
		limit="254"
		helperText={!!errors.email ? $i18nKW[errors.email] : ''}
		value={form.email}
		error={!!errors.email}
		on:input={handleCompanyFieldChanged('email')}
		on:change={handleCompanyFieldChanged('email', { shouldTrim: true })}
	>
	</ssk-input>
</div>

<div class="grid">
	<ssk-input
		testId={`${testId}.phone.input`}
		name="phone"
		size="md"
		label={phoneLabel}
		required
		placeholder={phonePhd}
		value={form.phone}
		helperText={!!errors.phone ? $i18nKW[errors.phone] : ''}
		error={!!errors.phone}
		on:input={handleCompanyFieldChanged('phone', { onlyNumber: true })}
		on:change={handleCompanyFieldChanged('phone', { onlyNumber: true })}
	>
		<ssk-input-addon data-testid={`${testId}.text.phone.country-code`} slot="prefix">
			{$setting?.settings?.phoneCode ?? '+66'}
		</ssk-input-addon>
	</ssk-input>
	<ssk-input
		testId={`${testId}.phone2.input`}
		name="phone2"
		size="md"
		label={subPhoneLabel}
		placeholder={subPhonePhd}
		value={form.phone2}
		helperText={!!errors.phone2 ? $i18nKW[errors.phone2] : ''}
		error={!!errors.phone2}
		on:input={handleCompanyFieldChanged('phone2', { onlyNumber: true })}
		on:change={handleCompanyFieldChanged('phone2', { onlyNumber: true })}
	>
		<ssk-input-addon data-testid={`${testId}.text.phone-code2.country-code`} slot="prefix">
			{$setting?.settings?.phoneCode ?? '+66'}
		</ssk-input-addon>
	</ssk-input>
</div>

<style lang="css">
	.grid {
		display: grid;
		grid-gap: 1rem;
		grid-template-columns: 1fr 1fr;
		margin-top: 1rem;
	}

	ssk-input-addon {
		border-right: 1px solid #bfbfbf;
	}

	ssk-input {
		--background-color: white;
	}
</style>
