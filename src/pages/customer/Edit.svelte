<!--  -->
<script lang="ts">
	import type { Customer } from '$lib/entities/customer/customer';
	import { customerSchema } from '$lib/entities/customer/validator';
	import { currentCompany } from '$stores/company/current-company';
	import { countriesList } from '$stores/country';
	import { setAction, setUnsavedChanges } from '$stores/saved-changes';
	import { yupValidationErrorToRecord } from '$utils/yup';
	import { AxiosError } from 'axios';
	import { type I18nStore, type ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { navigate } from 'svelte-routing';
	import { getCustomerById, updateCustomer } from '../../service/customer-book-v2-rest';
	import AddressTable from './section/AddressTable.svelte';
	import Container from './section/Container.svelte';
	import TaxTable from './section/TaxTable.svelte';
	import CustomerForm from '$components/form/CustomerForm.svelte';
	import { currentLanguage } from '$stores/i18n';
	import { currentStore } from '$stores/store/current-store';
	import PermissionDenied from '$components/PermissionDenied.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';
	import { checkPermissionsEach } from '$utils/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';

	export let customerId: string;

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	let customer: Partial<Customer> = {};
	let formTouched: boolean = false;
	let customerInfoTitle: string = '';
	let shippingAddress: string = '';
	let taxInfoAddress: string = '';
	let toastDuplicateCustomer: string = '';
	let toastSaveCustomerSuccess: string = '';
	let toastSaveFailed: string = '';
	let canEdit = false;
	let lastPermissionStoreId = '';
	let loadPromise: Promise<void> | null = null;

	const setCustomer = (c: Customer) => {
		customer = c;
	};

	$: if (customerId && $currentCompany) {
		getCustomerById(customerId, `sellsuki.company:${$currentCompany.id}`).then((resp) => {
			setCustomer(resp);
		});
	}

	$: currentCountry = $countriesList.data?.find((c) => c.iso === customer.countryCode);

	let validationError: Record<string, string> = {};

	$: disabledSubmit = (() => {
		if (!customer || !$currentCompany?.id || !formTouched) return true;

		try {
			customerSchema(currentCountry).validateSync(customer);
			return false;
		} catch (error) {
			return true;
		}
	})();

	const handleSubmit = async () => {
		if (!customer) return;

		try {
			customerSchema(currentCountry).validateSync(customer, { abortEarly: false });
		} catch (error) {
			validationError = yupValidationErrorToRecord(error);
			toastStore.addToast({
				message: `${validationError}`,
				type: 'error',
				timeout: 3000
			});
			return;
		}

		try {
			await updateCustomer(customer as Customer);
		} catch (error) {
			if (error instanceof AxiosError) {
				const err = error.response?.data?.error ?? '';
				if (err.includes('duplicate')) {
					toastStore.addToast({
						message: toastDuplicateCustomer,
						type: 'error',
						timeout: 3000,
						testId: 'customer.toast.failed'
					});
				} else {
					toastStore.addToast({
						message: toastSaveFailed,
						type: 'error',
						timeout: 3000,
						testId: 'customer.toast.failed'
					});
				}
			} else {
				toastStore.addToast({
					message: `${error}`,
					title: 'เกิดข้อผิดพลาด',
					type: 'error',
					timeout: 3000,
					testId: 'customer.toast.failed'
				});
			}

			return;
		}

		toastStore.addToast({
			message: toastSaveCustomerSuccess,
			type: 'success',
			timeout: 3000,
			testId: 'customer.toast.success'
		});

		navigate('/customers');

		setUnsavedChanges(false);
	};

	const handleExitForm = () => {
		setAction(() => navigate('/customers'));
	};

	const loadKeywords = async () => {
		customerInfoTitle = await i18nStore.get(
			'patona-sellercenter-customerbook-add-title-information',
			$currentLanguage.code,
			'default'
		);

		shippingAddress = await i18nStore.get(
			'patona-sellercenter-customerbook-shippingaddress',
			$currentLanguage.code,
			'default'
		);
		taxInfoAddress = await i18nStore.get(
			'patona-sellercenter-customerbook-taxaddress',
			$currentLanguage.code,
			'default'
		);

		toastDuplicateCustomer = await i18nStore.get(
			'patona-sellercenter-customerbook-toast-duplicatecustomer',
			$currentLanguage.code,
			'default'
		);
		toastSaveCustomerSuccess = await i18nStore.get(
			'patona-sellercenter-customerbook-toast-editcustomer-success',
			$currentLanguage.code,
			'default'
		);
		toastSaveFailed = await i18nStore.get(
			'patona-sellercenter-customerbook-toast-unablesave',
			$currentLanguage.code,
			'default'
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}

	async function checkPermission() {
		if (!$currentStore?.id) {
			canEdit = false;
			return;
		}
		await waitForDialogPermissionReady($currentCompany?.id);
		try {
			const data = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
				EntityPermission.CUSTOMERUPDATE
			]);
			canEdit = data[EntityPermission.CUSTOMERUPDATE];
		} catch (error) {
			canEdit = false;
		}
	}

	$: {
		if ($currentStore?.id && $currentStore.id !== lastPermissionStoreId) {
			lastPermissionStoreId = $currentStore.id;
			loadPromise = checkPermission();
		}
	}
</script>

{#if $currentStore?.id}
	{#await loadPromise}
		<LoadingPage description="loading" />
	{:then}
		{#if !canEdit}
			<PermissionDenied />
		{:else}
			<div class="container">
				<div class="header">
					<ssk-text size="2xl">
						<ssk-i18n-translate
							key="patona-sellercenter-customerbook-edit-title-editcustomer"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>
					<div class="header-actions">
						<ssk-button variant="outline" on:click={handleExitForm}>
							<ssk-i18n-translate
								key="patona-sellercenter-customerbook-button-cancel"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-button>
						<ssk-button variant="solid" disabled={disabledSubmit} on:click={handleSubmit}>
							<ssk-i18n-translate
								key="patona-sellercenter-customerbook-button-save"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-button>
					</div>
				</div>

				<Container title={customerInfoTitle}>
					<CustomerForm bind:customer bind:validationError bind:currentCountry bind:formTouched />
				</Container>

				<Container title={shippingAddress}>
					<AddressTable bind:addresses={customer.addresses} bind:formTouched />
				</Container>

				<Container title={taxInfoAddress}>
					<TaxTable bind:taxes={customer.taxInformation} bind:formTouched />
				</Container>
			</div>
		{/if}
	{/await}
{/if}

<style lang="css">
	.container {
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

	.header {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		padding: 1.5rem 0 0;
	}
</style>
