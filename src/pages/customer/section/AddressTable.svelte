<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import type { Country } from '$lib/entities/address/address';
	import type { Address } from '$lib/entities/customer/customer';
	import { generateEmptyAddress } from '$lib/entities/customer/generator';
	import { customerAddressSchema } from '$lib/entities/customer/validator';
	import { type StringKey } from '$lib/types';
	import { setAction, setUnsavedChanges } from '$stores/saved-changes';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { ValidationError } from 'yup';

	import ConfirmModal from '$components/modal/ConfirmModal.svelte';
	import { currentLanguage } from '$stores/i18n';
	import AddressForm from '$components/form/AddressForm.svelte';

	export let addresses: Address[] = [];
	export let formTouched: boolean = false;

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	const FORM_NAME = 'address';

	let address: Partial<Address> | undefined = undefined;
	let addrIdx: number = -1;
	let validationError: Record<string, string> = {};
	let currentCountry: Country | undefined;
	let addrIdxToDelete: number = -1;
	let addressTouched: boolean = false;
	let noShippingAddress: string = '';
	let deleteShippingAddressTitle: string = '';
	let deleteShippingAddressDescription: string = '';
	let fullNameLabel: string = '';
	let phoneLabel: string = '';
	let fullNamePlaceholder: string = '';
	let phonePlaceholder: string = '';
	let toastEditShippingAddressSuccess: string = '';
	let toastAddShippingAddressSuccess: string = '';
	let toastDeleteShippingAddressSuccess: string = '';
	let isValid: boolean = false;

	$: disabledAddressSubmit = (() => {
		if (!address || !addressTouched || !isValid) return true;

		try {
			customerAddressSchema(currentCountry).validateSync(address);
			return false;
		} catch (error) {
			return true;
		}
	})();

	const handleAddressFieldChanged = (
		field: StringKey<Address>,
		op: { onlyNumber?: boolean } = { onlyNumber: false }
	) => {
		return async (e: CustomEvent) => {
			if (!field) return;

			if (!address) address = {} as Address;

			setUnsavedChanges(true, FORM_NAME);

			const target = e.target as HTMLInputElement;
			let value = target.value;
			if (op.onlyNumber) {
				value = value.replace(/[^0-9]/g, '');
				target.value = value;
			}

			address[field] = value;

			try {
				customerAddressSchema(currentCountry).validateSyncAt(field, address);
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

	const handleSetAddress = () => {
		if (!address) return;

		if (addrIdx === -1) {
			if (addresses.length === 0) {
				address.isDefault = true;
			}

			addresses = [...addresses, address as Address];
		} else {
			addresses[addrIdx] = address as Address;
		}

		address = undefined;
		formTouched = true;

		toastStore.addToast({
			message: addrIdx === -1 ? toastAddShippingAddressSuccess : toastEditShippingAddressSuccess,
			type: 'success',
			timeout: 3000,
			testId: 'customer-address.toast.success'
		});

		setUnsavedChanges(false, FORM_NAME);
	};

	const handleDefaultAddressRadioChanged = (idx: number) => {
		return () => {
			addresses = addresses.map((a, i) => ({
				...a,
				isDefault: i === idx
			}));
			formTouched = true;
		};
	};

	const handleCancelModal = () => {
		setAction(() => (address = undefined), FORM_NAME);
	};

	const loadKeywords = async () => {
		const language = $currentLanguage.code;
		const fallback = 'default';
		noShippingAddress = await i18nStore.get(
			'patona-sellercenter-customerbook-noshippingaddress',
			language,
			fallback
		);
		deleteShippingAddressTitle = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-deleteshipping-title',
			language,
			fallback
		);

		deleteShippingAddressDescription = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-deleteshipping-body',
			language,
			fallback
		);

		fullNameLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-shipping-label-fullname',
			language,
			fallback
		);
		fullNamePlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-shipping-placeholder-fullname',
			language,
			fallback
		);

		phoneLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-shipping-label-phone',
			language,
			fallback
		);
		phonePlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-shipping-placeholder-phone',
			language,
			fallback
		);

		toastEditShippingAddressSuccess = await i18nStore.get(
			'patona-sellercenter-customerbook-toast-editshipping-success',
			language,
			fallback
		);
		toastAddShippingAddressSuccess = await i18nStore.get(
			'patona-sellercenter-customerbook-toast-addshipping-success',
			language,
			fallback
		);

		toastDeleteShippingAddressSuccess = await i18nStore.get(
			'patona-sellercenter-customerbook-toast-deleteshipping-success',
			language,
			fallback
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

<ConfirmModal
	onClose={() => (addrIdxToDelete = -1)}
	show={addrIdxToDelete !== -1}
	icon="outline-trash"
	iconColor="#ef4444"
	title={deleteShippingAddressTitle}
	description={deleteShippingAddressDescription}
>
	<ssk-button
		width="full"
		slot="footer-left"
		variant="outline"
		themeColor="button"
		on:click={() => (addrIdxToDelete = -1)}
	>
		<ssk-text>
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-button-cancel"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
	</ssk-button>
	<ssk-button
		width="full"
		themeColor="error"
		slot="footer-right"
		on:click={() => {
			addresses = addresses.filter((_, i) => i !== addrIdxToDelete);
			addrIdxToDelete = -1;
			formTouched = true;

			toastStore.addToast({
				message: toastDeleteShippingAddressSuccess,
				type: 'success',
				timeout: 3000,
				testId: 'customer-address.toast.success'
			});
		}}
	>
		<ssk-i18n-translate
			key="patona-sellercenter-customerbook-button-delete"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</ConfirmModal>

<ssk-modal show={!!address} width="641px" hideDivider={false} on:close={handleCancelModal}>
	<ssk-text size="xl" slot="header">
		{#if addrIdx === -1}
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-modal-shipping-title-addshipping"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		{:else}
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-modal-shipping-title-editshipping"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		{/if}
	</ssk-text>

	<div class="modal-body" slot="body">
		<ssk-input
			size="md"
			label={fullNameLabel}
			placeholder={fullNamePlaceholder}
			required
			name="contactName"
			on:input={handleAddressFieldChanged('contactName')}
			value={address?.contactName}
			helperText={validationError.contactName}
			error={!!validationError.contactName}
		/>
		<ssk-input
			size="md"
			label={phoneLabel}
			placeholder={phonePlaceholder}
			required
			name="phone"
			on:input={handleAddressFieldChanged('phone', { onlyNumber: true })}
			value={address?.phone}
			helperText={validationError.phone}
			error={!!validationError.phone}
		>
			<ssk-input-addon slot="prefix">
				{currentCountry?.phoneCode}
			</ssk-input-addon></ssk-input
		>

		<AddressForm
			bind:address
			bind:validationError
			bind:currentCountry
			bind:formTouched={addressTouched}
			bind:isValid
			formName="address"
		/>
	</div>

	<div class="modal-footer" slot="footer">
		<ssk-button themeColor="gray" variant="outline" on:click={handleCancelModal}>
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-button-cancel"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button disabled={disabledAddressSubmit} on:click={handleSetAddress}>
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-button-save"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	</div>
</ssk-modal>

<div class="address-container">
	{#if addresses?.length}
		<div class="address-table">
			<ssk-dynamic-table
				width="full"
				height="auto"
				columnsWidth={['auto', '3fr', '2fr', '4fr', 'auto', 'auto']}
				backgroundColor="#fff"
				borderColor="#ccc"
			>
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
				<ssk-header-cell slot="headers" align="left">
					<ssk-i18n-translate
						key="patona-sellercenter-customerbook-shippingaddress-table-header-primaryaddress"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-header-cell>
				<ssk-header-cell slot="headers"></ssk-header-cell>

				{#each addresses ?? [] as addr, i}
					<ssk-table-cell align="left">
						<ssk-text color="gray.800">{i + 1}</ssk-text>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-text color="gray.800">{addr.contactName}</ssk-text>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-text color="gray.800">{addr.phone}</ssk-text>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-text color="gray.800">{addr.street}</ssk-text>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-radio
							on:change={handleDefaultAddressRadioChanged(i)}
							checked={addr.isDefault}
							size="xl"
							themeColor="sky"
						/>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-dropdown themeColor="gray" optionsWidth="auto">
							<ssk-icon slot="selected" name="outline-ellipsis-vertical" size="md" />
							<ssk-dropdown-option
								on:click={() => {
									address = { ...addr };
									addrIdx = i;
									validationError = {};
									addressTouched = false;
								}}
							>
								<ssk-i18n-translate
									key="patona-sellercenter-customerbook-table-body-menu-edit"
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-dropdown-option>
							{#if !addr.isDefault}
								<ssk-dropdown-option
									on:click={() => {
										addrIdxToDelete = i;
									}}
								>
									<ssk-i18n-translate
										key="patona-sellercenter-customerbook-table-body-menu-delete"
										lang={$currentLanguage.code}
										fallbackLang="default"
									/>
								</ssk-dropdown-option>
							{/if}
						</ssk-dropdown>
					</ssk-table-cell>
				{/each}
			</ssk-dynamic-table>
			<div class="table-border-overlay" />
		</div>

		<ssk-button
			width="auto"
			themeColor="sky"
			variant="outline"
			on:click={() => {
				address = generateEmptyAddress();
				addrIdx = -1;
				validationError = {};
			}}
		>
			<ssk-icon slot="prefix" name="solid-plus" />
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-button-addshippingaddress"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	{:else}
		<div class="address-table table-empty">
			<BlankPage description={noShippingAddress} height="auto" />
			<ssk-button
				width="auto"
				themeColor="sky"
				variant="outline"
				on:click={() => {
					address = generateEmptyAddress();
					addrIdx = -1;
					validationError = {};
				}}
			>
				<ssk-icon slot="prefix" name="solid-plus" />
				<ssk-i18n-translate
					key="patona-sellercenter-customerbook-button-addshippingaddress"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-button>
		</div>
	{/if}
</div>

<style lang="css">
	.address-container {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		background-color: #fff;
		gap: 24px;
	}

	.address-table {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 24px;
		background-color: #fff;
		width: 100%;
		box-sizing: border-box;
	}

	.address-table.table-empty {
		background-color: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		padding: 24px 0;
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	ssk-dynamic-table {
		width: 100%;
		color: var(--ssk-colors-gray-500);
		--table-overflow-y: unset;
	}

	ssk-header-cell {
		z-index: 1;
		white-space: nowrap;
		position: inherit;
	}

	.table-border-overlay {
		position: absolute;
		pointer-events: none;
		width: 100%;
		height: 100%;
		border: 1px solid var(--ssk-colors-gray-200);
		border-bottom-width: 0;
		border-radius: 8px;
	}
</style>
