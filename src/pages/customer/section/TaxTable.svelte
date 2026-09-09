<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import type { Country } from '$lib/entities/address/address';
	import type { TaxInformation } from '$lib/entities/customer/customer';
	import { generateEmptyTax } from '$lib/entities/customer/generator';
	import { customerTaxSchema } from '$lib/entities/customer/validator';
	import { type StringKey } from '$lib/types';
	import { setAction, setUnsavedChanges } from '$stores/saved-changes';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { ValidationError } from 'yup';

	import ConfirmModal from '$components/modal/ConfirmModal.svelte';
	import { currentLanguage } from '$stores/i18n';
	import AddressForm from '$components/form/AddressForm.svelte';

	export let taxes: TaxInformation[] = [];
	export let formTouched: boolean = false;

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	const FORM_NAME = 'tax';

	let tax: Partial<TaxInformation> | undefined = undefined;
	let taxIdx: number = -1;
	let validationError: Record<string, string> = {};
	let currentCountry: Country | undefined;
	let taxIdxToDelete: number = -1;
	let taxTouched: boolean = false;
	let noTaxAddress: string = '';
	let fullNameLabel: string = '';
	let fullNamePlaceholder: string = '';
	let phoneLabel: string = '';
	let phonePlaceholder: string = '';
	let emailLabel: string = '';
	let emailPlaceholder: string = '';
	let taxNumberLabel: string = '';
	let taxNumberPlaceholder: string = '';
	let branchCodeLabel: string = '';
	let branchCodePlaceholder: string = '';
	let companyNameLabel: string = '';
	let companyNamePlaceholder: string = '';
	let deleteModalTitle: string = '';
	let deleteModalDescription: string = '';
	let toastAddTaxAddressSuccess: string = '';
	let toastEditTaxAddressSuccess: string = '';
	let toastDeleteTaxAddressSuccess: string = '';
	let isValid: boolean = false;

	const taxKinds: {
		kind: TaxInformation['kind'];
		label: string;
	}[] = [
		{
			kind: 'individual',
			label: 'patona-sellercenter-customerbook-modal-taxinvoice-radio-individual'
		},
		{
			kind: 'juristic',
			label: 'patona-sellercenter-customerbook-modal-taxinvoice-radio-corporateentity'
		}
	];

	$: disabledTaxSubmit = (() => {
		if (!tax || !taxTouched || !isValid) return true;

		try {
			customerTaxSchema(currentCountry).validateSync(tax);
			return false;
		} catch (error) {
			return true;
		}
	})();

	const handleTaxFieldChanged = (
		field: StringKey<TaxInformation>,
		op: { onlyNumber?: boolean } = { onlyNumber: false }
	) => {
		return async (e: CustomEvent) => {
			if (!field) return;

			if (!tax) tax = {} as TaxInformation;

			setUnsavedChanges(true, FORM_NAME);

			const target = e.target as HTMLInputElement;
			if (op.onlyNumber) {
				target.value = target.value.replace(/[^0-9]/g, '');
			}
			tax[field] = target.value as any;

			try {
				customerTaxSchema(currentCountry).validateSyncAt(field, tax);
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

			taxTouched = true;
		};
	};

	const handleRadioChanged = (kind: TaxInformation['kind']) => {
		return () => {
			if (!tax) tax = {} as TaxInformation;
			tax.kind = kind;
		};
	};

	const handleSetTax = () => {
		if (taxIdx === -1) {
			taxes = [...taxes, tax as TaxInformation];
		} else {
			taxes[taxIdx] = tax as TaxInformation;
		}
		tax = undefined;
		formTouched = true;

		toastStore.addToast({
			message: taxIdx === -1 ? toastAddTaxAddressSuccess : toastEditTaxAddressSuccess,
			type: 'success',
			timeout: 3000,
			testId: 'customer-address.toast.success'
		});

		setUnsavedChanges(false, FORM_NAME);
	};

	const handleCancelModal = () => {
		setAction(() => (tax = undefined), FORM_NAME);
	};

	const loadKeywords = async () => {
		noTaxAddress = await i18nStore.get(
			'patona-sellercenter-customerbook-notaxaddress',
			$currentLanguage.code,
			'default'
		);

		fullNameLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-label-fullname',
			$currentLanguage.code,
			'default'
		);
		fullNamePlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-placeholder-fullname',
			$currentLanguage.code,
			'default'
		);

		taxNumberLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-label-taxid',
			$currentLanguage.code,
			'default'
		);
		taxNumberPlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-placeholder-taxid',
			$currentLanguage.code,
			'default'
		);
		phoneLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-label-phone',
			$currentLanguage.code,
			'default'
		);
		phonePlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-placeholder-phone',
			$currentLanguage.code,
			'default'
		);
		emailLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-label-email',
			$currentLanguage.code,
			'default'
		);
		emailPlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-placeholder-email',
			$currentLanguage.code,
			'default'
		);

		deleteModalTitle = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-deletetax-title',
			$currentLanguage.code,
			'default'
		);
		deleteModalDescription = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-deletetax-body',
			$currentLanguage.code,
			'default'
		);

		branchCodeLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-label-branchcode',
			$currentLanguage.code,
			'default'
		);
		branchCodePlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-placeholder-branchcode',
			$currentLanguage.code,
			'default'
		);

		companyNameLabel = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-label-companyname',
			$currentLanguage.code,
			'default'
		);
		companyNamePlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-modal-taxinvoice-placeholder-companyname',
			$currentLanguage.code,
			'default'
		);

		toastAddTaxAddressSuccess = await i18nStore.get(
			'patona-sellercenter-customerbook-toast-addtaxaddress-success',
			$currentLanguage.code,
			'default'
		);
		toastEditTaxAddressSuccess = await i18nStore.get(
			'patona-sellercenter-customerbook-toast-edittaxaddress-success',
			$currentLanguage.code,
			'default'
		);
		toastDeleteTaxAddressSuccess = await i18nStore.get(
			'patona-sellercenter-customerbook-toast-deletetaxaddress-success',
			$currentLanguage.code,
			'default'
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

<ConfirmModal
	onClose={() => (taxIdxToDelete = -1)}
	show={taxIdxToDelete !== -1}
	icon="outline-trash"
	iconColor="#ef4444"
	title={deleteModalTitle}
	description={deleteModalDescription}
>
	<ssk-button
		width="full"
		slot="footer-left"
		variant="outline"
		themeColor="button"
		on:click={() => (taxIdxToDelete = -1)}
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
			taxes = taxes.filter((_, i) => i !== taxIdxToDelete);
			taxIdxToDelete = -1;

			formTouched = true;
			toastStore.addToast({
				message: toastDeleteTaxAddressSuccess,
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

<ssk-modal show={!!tax} width="641px" hideDivider={false} on:close={handleCancelModal}>
	<ssk-text size="xl" slot="header">
		{#if taxIdx === -1}
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-modal-tax-title-addtax"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		{:else}
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-modal-tax-title-edittax"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		{/if}
	</ssk-text>

	<div class="modal-body" slot="body">
		<div class="form-group">
			{#each taxKinds as tk}
				<div class={`radio-group ${tax?.kind === tk.kind ? 'active' : ''}`}>
					<ssk-radio
						checked={tax?.kind === tk.kind}
						name="kind"
						value={tk.kind}
						on:change={handleRadioChanged(tk.kind)}
					/>
					<ssk-text size="md" color="gray.800">
						<ssk-i18n-translate
							key={tk.label}
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>
				</div>
			{/each}
		</div>
		{#if tax?.kind === 'juristic'}
			<ssk-input
				size="md"
				label={companyNameLabel}
				placeholder={companyNamePlaceholder}
				required
				name="fullName"
				on:input={handleTaxFieldChanged('fullName')}
				value={tax?.fullName}
				helperText={validationError.fullName}
				error={!!validationError.fullName}
			/>

			<ssk-input
				size="md"
				label={branchCodeLabel}
				placeholder={branchCodePlaceholder}
				required
				name="branchName"
				on:input={handleTaxFieldChanged('branchName')}
				value={tax?.branchName}
				helperText={validationError.branchName}
				error={!!validationError.branchName}
			/>
		{:else}
			<ssk-input
				size="md"
				label={fullNameLabel}
				placeholder={fullNamePlaceholder}
				required
				name="fullName"
				on:input={handleTaxFieldChanged('fullName')}
				value={tax?.fullName}
				helperText={validationError.fullName}
				error={!!validationError.fullName}
			/>
		{/if}

		<ssk-input
			size="md"
			label={taxNumberLabel}
			placeholder={taxNumberPlaceholder}
			required
			name="taxNumber"
			on:input={handleTaxFieldChanged('taxNumber')}
			value={tax?.taxNumber}
			helperText={validationError.taxNumber}
			error={!!validationError.taxNumber}
		/>

		<div class="form-group">
			<ssk-input
				size="md"
				label={phoneLabel}
				placeholder={phonePlaceholder}
				required
				name="phone"
				on:input={handleTaxFieldChanged('phone', { onlyNumber: true })}
				value={tax?.phone}
				helperText={validationError.phone}
				error={!!validationError.phone}
			>
				<ssk-input-addon slot="prefix">
					{currentCountry?.phoneCode}
				</ssk-input-addon></ssk-input
			>

			<ssk-input
				size="md"
				label={emailLabel}
				placeholder={emailPlaceholder}
				name="email"
				on:input={handleTaxFieldChanged('email')}
				value={tax?.email}
				helperText={validationError.email}
				error={!!validationError.email}
				limit="254"
			/>
		</div>

		<AddressForm
			bind:address={tax}
			bind:validationError
			bind:currentCountry
			bind:formTouched={taxTouched}
			bind:isValid
			formName={FORM_NAME}
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
		<ssk-button disabled={disabledTaxSubmit} on:click={handleSetTax}>
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-button-save"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	</div>
</ssk-modal>

<div class="tax-container">
	{#if taxes?.length}
		<div class="tax-table">
			<ssk-dynamic-table
				height="auto"
				columnsWidth={['auto', '2fr', '2fr', '3fr', '3fr', '3fr', 'auto']}
				backgroundColor="#fff"
				borderColor="#ccc"
			>
				<ssk-header-cell slot="headers"></ssk-header-cell>
				<ssk-header-cell slot="headers" align="left">
					<ssk-i18n-translate
						key="patona-sellercenter-customerbook-taxaddress-table-header-type"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-header-cell>
				<ssk-header-cell slot="headers" align="left">
					<ssk-i18n-translate
						key="patona-sellercenter-customerbook-taxaddress-table-header-name"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-header-cell>
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
				<ssk-header-cell slot="headers"></ssk-header-cell>

				{#each taxes ?? [] as t, i}
					<ssk-table-cell align="left">
						<ssk-text color="gray.800">{i + 1}</ssk-text>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-text color="gray.800"
							>{t.kind === 'individual' ? 'บุคคลธรรมดา' : 'นิติบุคคล'}</ssk-text
						>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-text color="gray.800">{t.fullName}</ssk-text>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-text color="gray.800">{t.taxNumber}</ssk-text>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-text color="gray.800">{t.email || '-'}</ssk-text>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-text color="gray.800" class="street-detail">{t.street}</ssk-text>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-dropdown themeColor="gray" optionsWidth="auto">
							<ssk-icon slot="selected" name="outline-ellipsis-vertical" size="md" />
							<ssk-dropdown-option
								on:click={() => {
									tax = { ...t };
									taxIdx = i;
									validationError = {};
									taxTouched = false;
								}}
							>
								<ssk-i18n-translate
									key="patona-sellercenter-customerbook-table-body-menu-edit"
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-dropdown-option>
							<ssk-dropdown-option
								on:click={() => {
									taxIdxToDelete = i;
								}}
							>
								<ssk-i18n-translate
									key="patona-sellercenter-customerbook-table-body-menu-delete"
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-dropdown-option>
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
				tax = generateEmptyTax();
				taxIdx = -1;
				validationError = {};
			}}
		>
			<ssk-icon slot="prefix" name="solid-plus" />
			<ssk-i18n-translate
				key="patona-sellercenter-customerbook-button-addtaxaddress"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	{:else}
		<div class="tax-table table-empty">
			<BlankPage description={noTaxAddress} height="auto" />
			<ssk-button
				width="auto"
				themeColor="sky"
				variant="outline"
				on:click={() => {
					tax = generateEmptyTax();
					taxIdx = -1;
					validationError = {};
				}}
			>
				<ssk-icon slot="prefix" name="solid-plus" />
				<ssk-i18n-translate
					key="patona-sellercenter-customerbook-button-addtaxaddress"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-button>
		</div>
	{/if}
</div>

<style lang="css">
	.tax-container {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		background-color: #fff;
		gap: 24px;
	}

	.tax-table {
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

	.tax-table.table-empty {
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

	.form-group {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.radio-group {
		display: flex;
		gap: 16px;
		padding: 8px;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		align-items: anchor-center;
	}

	.radio-group.active {
		border-color: var(--ssk-colors-primary-500);
	}

	.street-detail {
		/* max 2 lines */
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
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
		border-radius: 8px;
	}
</style>
