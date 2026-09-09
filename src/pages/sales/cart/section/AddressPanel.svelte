<script lang="ts">
	import AddressForm from '$components/form/AddressForm.svelte';
	import type { Country } from '$lib/entities/address/address';
	import type { Address } from '$lib/entities/customer/customer';
	import { customerAddressSchema } from '$lib/entities/customer/validator';
	import { type StringKey } from '$lib/types';
	import { currentLanguage } from '$stores/i18n';
	import { setUnsavedChanges } from '$stores/saved-changes';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { ValidationError } from 'yup';

	const i18nStore = getContext<I18nStore>('i18n');

	export let address: Partial<Address> | undefined = undefined;
	export let formName: string = '';
	export let disabledAddressSubmit: boolean = true;
	export let shouldreset: boolean = false;

	let validationError: Record<string, string> = {};
	let currentCountry: Country | undefined;
	let addressTouched: boolean = false;
	let isValid: boolean = false;
	let contactNameEl: HTMLElement;
	let phoneEl: HTMLElement;

	const getFieldEl = (field: string): HTMLElement | null => {
		switch (field) {
			case 'contactName':
				return contactNameEl;
			case 'phone':
				return phoneEl;
			default:
				return null;
		}
	};

	const focusInput = (el: HTMLElement) => {
		(el?.shadowRoot?.querySelector('input') as HTMLInputElement)?.focus();
	};

	$: disabledAddressSubmit = (() => {
		if (!address || !addressTouched || !isValid) return true;

		try {
			customerAddressSchema(currentCountry).validateSync(address);
			return false;
		} catch (error) {
			return true;
		}
	})();

	$: if (shouldreset) {
		resetAddressState();
		shouldreset = false;
	}

	function resetAddressState() {
		validationError = {};
		addressTouched = false;
	}

	const handleAddressFieldChanged = (
		field: StringKey<Address>,
		op: { shouldTrim?: boolean; onlyNumber?: boolean } = { shouldTrim: false, onlyNumber: false }
	) => {
		return async (e: CustomEvent) => {
			if (!field) return;

			if (!address) address = {} as Address;

			setUnsavedChanges(true, formName);

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

			address[field] = value;

			try {
				address[field] = customerAddressSchema(currentCountry).validateSyncAt(field, address);
				target.value = address[field]!;
				validationError[field] = '';
			} catch (error) {
				if (error instanceof ValidationError) {
					const translatedError = await i18nStore.get(
						error.errors?.[0],
						$currentLanguage.code,
						'default'
					);
					validationError[field] = translatedError;
				}
			}

			addressTouched = true;
		};
	};

	const handleClearField = (field: 'contactName' | 'phone') => async () => {
		if (!address) return;
		address[field] = '';
		addressTouched = true;
		setUnsavedChanges(true, formName);
		try {
			customerAddressSchema(currentCountry).validateSyncAt(field, address);
			validationError[field] = '';
		} catch (error) {
			if (error instanceof ValidationError) {
				validationError[field] = await i18nStore.get(
					error.errors?.[0],
					$currentLanguage.code,
					'default'
				);
			}
		}
		const el = getFieldEl(field);
		if (el) focusInput(el);
	};
</script>

<div class="form-container">
	<ssk-input
		bind:this={contactNameEl}
		size="md"
		label="ชื่อ-นามสกุล"
		placeholder="ระบุชื่อ-นามสกุล"
		required
		name="contactName"
		on:input={handleAddressFieldChanged('contactName')}
		on:change={handleAddressFieldChanged('contactName', { shouldTrim: true })}
		value={address?.contactName}
		helperText={validationError.contactName}
		error={!!validationError.contactName}
	>
		{#if address?.contactName}
			<ssk-input-addon slot="postfix" class="button" on:click={handleClearField('contactName')}>
				<ssk-icon name="outline-x-mark" themeColor="gray"></ssk-icon>
			</ssk-input-addon>
		{/if}
	</ssk-input>
	<ssk-input
		bind:this={phoneEl}
		size="md"
		label="เบอร์โทรศัพท์"
		placeholder="ระบุเบอร์โทรศัพท์"
		required
		name="phone"
		on:input={handleAddressFieldChanged('phone', { shouldTrim: true, onlyNumber: true })}
		on:change={handleAddressFieldChanged('phone', { shouldTrim: true, onlyNumber: true })}
		value={address?.phone}
		helperText={validationError.phone}
		error={!!validationError.phone}
	>
		<ssk-input-addon slot="prefix">
			{currentCountry?.phoneCode}
		</ssk-input-addon>
		{#if address?.phone}
			<ssk-input-addon slot="postfix" class="button" on:click={handleClearField('phone')}>
				<ssk-icon name="outline-x-mark" themeColor="gray"></ssk-icon>
			</ssk-input-addon>
		{/if}
	</ssk-input>
	<AddressForm
		bind:address
		bind:validationError
		bind:currentCountry
		bind:formTouched={addressTouched}
		bind:isValid
		{formName}
	/>
</div>

<style lang="css">
	.form-container {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		height: auto;
		width: 100%;
		padding: 32px;
		box-sizing: border-box;
		gap: 24px;
	}

	.button {
		cursor: pointer;
	}
</style>
