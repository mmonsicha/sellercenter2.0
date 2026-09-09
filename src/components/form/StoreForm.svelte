<script lang="ts">
	import { currentLanguage, i18nKW } from '$stores/i18n';
	import { isUpdatedSettings, setSettingFormatWithIso, setting } from '$stores/settings';
	import { isPrefillStoreData, setPrefillStoreData } from '$stores/store/store';
	import {
		initStoreForm,
		storeFormSchema,
		type IStoreForm
	} from '$utils/form-validation/store-form';
	import { tick } from 'svelte';
	import { ValidationError } from 'yup';

	export let onChange: (c: IStoreForm) => void;
	export let store: any;
	export let hidePrefill: boolean = false;
	export let isValidStore: boolean = false;
	export let testId: string = '';

	let name: string;
	let branchCode: string;
	let phone: string;
	let subPhone: string;
	let brnachCodeTooltip: string;
	let checkboxSameData: string;

	let namePhd: string;
	let phonePhd: string;
	let subPhonePhd: string;
	let branchCodePhd: string;

	async function loadKeywords() {
		name = $i18nKW['patona-sellercenter-store-create-input-label-storename'];
		branchCode = $i18nKW['patona-sellercenter-store-create-input-label-branchcode'];
		phone = $i18nKW['patona-sellercenter-store-create-input-label-phone'];
		subPhone = $i18nKW['patona-sellercenter-store-create-input-label-subphone'];
		brnachCodeTooltip = $i18nKW['patona-sellercenter-store-create-tooltip-branchcode'];
		checkboxSameData = $i18nKW['patona-sellercenter-store-create-input-checkbox-information'];

		namePhd = $i18nKW['patona-sellercenter-store-create-input-placeholder-storename'];
		phonePhd = $i18nKW['patona-sellercenter-store-create-input-placeholder-phone'];
		subPhonePhd = $i18nKW['patona-sellercenter-store-create-input-placeholder-subphone'];
		branchCodePhd = $i18nKW['patona-sellercenter-store-create-input-placeholder-branchcode'];
	}

	$: if ($currentLanguage?.code) {
		loadKeywords();
	}

	$: if (store.address.country?.iso) {
		setSettingFormatWithIso(store.address.country?.iso ?? 'THA');
		(async () => {
			await tick();
			if (form.phone || form.phone2) {
				validateField('phone', form.phone);
				validateField('phone2', form.phone2);
			}
		})();
	}

	$: schema = storeFormSchema($setting?.settings);

	let form: IStoreForm = initStoreForm(store);
	let errors: Record<string, string> = {};

	function validateField(field: keyof IStoreForm, value: any) {
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
		isValidStore = Object.values(errors).every((v) => !v);
	}

	function handleStoreFieldChanged(
		field: keyof IStoreForm,
		op: { shouldTrim?: boolean; onlyNumber?: boolean; setPrefill?: boolean } = {
			shouldTrim: false,
			onlyNumber: false,
			setPrefill: false
		}
	) {
		return (e: Event) => {
			const t = e.target as HTMLInputElement;
			let value = t.value;
			if (op.setPrefill) {
				setPrefillStoreData(false);
			}
			if (op.shouldTrim) {
				value = value.trim();
				t.value = value;
			}
			if (op.onlyNumber) {
				value = value.replace(/[^0-9]/g, '');
				t.value = value;
			}
			if (field === 'code') {
				form.isSystemCode = value === '';
			}
			(form as any)[field] = value;
			validateField(field, value);
			onChange(form);
		};
	}

	$: if ($isPrefillStoreData && !hidePrefill) {
		form.phone = store.phone || '';
		form.phone2 = store.phone2 || '';
		setSettingFormatWithIso(store.address.country?.iso ?? 'THA');
		validateField('phone', form.phone);
		validateField('phone2', form.phone2);
	}
</script>

{#key $isPrefillStoreData}
	<div>
		<ssk-input
			testId={`${testId}.store-name.input`}
			size="md"
			name="name"
			label={name}
			limit="50"
			required
			placeholder={namePhd}
			helperText={!!errors.name ? $i18nKW[errors.name] : ''}
			error={!!errors.name}
			value={form.name}
			on:input={handleStoreFieldChanged('name')}
			on:change={handleStoreFieldChanged('name', { shouldTrim: true })}
		>
		</ssk-input>
		{#if !hidePrefill}
			<ssk-checkbox
				label={checkboxSameData}
				checked={$isPrefillStoreData}
				on:change={setPrefillStoreData(!$isPrefillStoreData)}
				testId={`${testId}.checkbox.info-same-company`}
			></ssk-checkbox>
		{/if}
	</div>
{/key}

<ssk-input
	testId={`${testId}.store-code.input`}
	size="md"
	name="code"
	label={branchCode}
	limit="50"
	placeholder={branchCodePhd}
	helperText={!!errors.code ? $i18nKW[errors.code] : ''}
	error={!!errors.code}
	value={form.isSystemCode ? '' : form.code}
	on:input={handleStoreFieldChanged('code', { shouldTrim: true })}
	on:change={handleStoreFieldChanged('code', { shouldTrim: true })}
>
	<ssk-tooltip
		slot="label"
		size="sm"
		themeColor="white"
		areaPosition="120%"
		placement="top"
		color="currentcolor"
		hideCloseButton={true}
		testId={`${testId}.tooltip.store-code`}
	>
		<div class="tooltip-content" slot="content">
			<ssk-text size="sm"> {brnachCodeTooltip} </ssk-text>
		</div>
		<ssk-icon size="sm" name="outline-information-circle" />
	</ssk-tooltip>
</ssk-input>

<div class="grid">
	<ssk-input
		testId={`${testId}.store-phone.input`}
		name="phone"
		size="md"
		label={phone}
		required
		placeholder={phonePhd}
		helperText={!!errors.phone ? $i18nKW[errors.phone] : ''}
		error={!!errors.phone}
		value={form.phone}
		on:input={handleStoreFieldChanged('phone', { onlyNumber: true, setPrefill: true })}
		on:change={handleStoreFieldChanged('phone', {
			shouldTrim: true,
			onlyNumber: true,
			setPrefill: true
		})}
	>
		<ssk-input-addon slot="prefix" data-testid={`${testId}.text.phone.country-code`}>
			{$setting?.settings?.phoneCode ?? '+66'}
		</ssk-input-addon>
	</ssk-input>
	<ssk-input
		testId={`${testId}.store-phone2`}
		name="phone2"
		size="md"
		label={subPhone}
		placeholder={subPhonePhd}
		helperText={!!errors.phone2 ? $i18nKW[errors.phone2] : ''}
		error={!!errors.phone2}
		value={form.phone2}
		on:input={handleStoreFieldChanged('phone2', { onlyNumber: true, setPrefill: true })}
		on:change={handleStoreFieldChanged('phone2', {
			shouldTrim: true,
			onlyNumber: true,
			setPrefill: true
		})}
	>
		<ssk-input-addon slot="prefix" data-testid={`${testId}.text.phone2.country-code`}>
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
