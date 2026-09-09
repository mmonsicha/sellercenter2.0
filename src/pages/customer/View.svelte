<script lang="ts">
	import { navigate, useLocation } from 'svelte-routing';
	import AddressTab from './section/AddressTab.svelte';
	import SaleHistoryTab from './section/SaleHistoryTab.svelte';
	import InvoiceTab from './section/InvoiceTab.svelte';
	import { currentCompany } from '$stores/company/current-company';
	import { getCustomerById } from '../../service/customer-book-v2-rest';
	import type { Customer } from '$lib/entities/customer/customer';
	import { formatDate } from '$utils/format-date';
	import { currentStore } from '$stores/store/current-store';
	import { currentLanguage } from '$stores/i18n';
	import { getContext } from 'svelte';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import PermissionDenied from '$components/PermissionDenied.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';
	import { checkPermissionsEach } from '$utils/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';

	export let customerId: string;

	const location = useLocation();
	const i18nStore = getContext<I18nStore>('i18n');
	let storeId: string;
	let customer: Partial<Customer> = {};
	let activeTabIndex = 0;
	let salesHistoryTab: string = '';
	let shippingAddressTab: string = '';
	let taxInvoiceAddressTab: string = '';
	let tabLabels: string[] = [];
	let canView = false;
	let lastPermissionStoreId = '';
	let permissionPromise: Promise<void> | null = null;

	const setCustomer = (c: Customer) => {
		customer = c;
	};

	$: if ($currentStore) {
		storeId = $currentStore.id!;
	}

	$: if (customerId && $currentCompany && canView) {
		getCustomerById(customerId, `sellsuki.company:${$currentCompany.id}`).then((resp) => {
			setCustomer(resp);
		});
	}

	function back() {
		let redirectUrl = '/customers';
		const params = new URLSearchParams($location.search);
		const backTo = params.get('back_to');

		if (!!backTo) {
			// NOTE: Restore query params when navigate back from /customers/view/{id} to /customers
			redirectUrl = backTo;
		}
		navigate(redirectUrl);
	}

	const loadKeywords = async () => {
		salesHistoryTab = await i18nStore.get(
			'patona-sellercenter-customerbook-detail-tab-saleshistory',
			$currentLanguage.code,
			'default'
		);
		shippingAddressTab = await i18nStore.get(
			'patona-sellercenter-customerbook-detail-tab-shippingaddress',
			$currentLanguage.code,
			'default'
		);
		taxInvoiceAddressTab = await i18nStore.get(
			'patona-sellercenter-customerbook-detail-tab-taxaddress',
			$currentLanguage.code,
			'default'
		);
		tabLabels = [salesHistoryTab, shippingAddressTab, taxInvoiceAddressTab];
	};
	$: if ($currentLanguage.code) {
		loadKeywords();
	}

	async function checkPermission() {
		if (!$currentStore?.id) {
			canView = false;
			return;
		}
		canView = false;
		await waitForDialogPermissionReady($currentCompany?.id);
		try {
			const data = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
				EntityPermission.CUSTOMERVIEW
			]);
			canView = data[EntityPermission.CUSTOMERVIEW];
		} catch (error) {
			canView = false;
		}
	}

	$: {
		if ($currentStore?.id && $currentStore.id !== lastPermissionStoreId) {
			lastPermissionStoreId = $currentStore.id;
			permissionPromise = checkPermission();
		}
	}
</script>

{#if $currentStore?.id}
	{#await permissionPromise}
		<LoadingPage description="กำลังโหลดข้อมูล..." />
	{:then}
		{#if !canView}
			<PermissionDenied />
		{:else}
			<div class="container">
				{#if customerId}
					<div class="content">
						<div class="header">
							<div class="left-section">
								<div class="breadcrumb">
									<div class="back" on:click={back}>
										<ssk-icon name="outline-chevron-left" size="sm" />
									</div>
									<div class="badge">
										<ssk-text size="sm" color="gray.800">
											<ssk-i18n-translate
												key="patona-sellercenter-customerbook-detail-badge-customerdetail"
												lang={$currentLanguage.code}
												fallbackLang="default"
											/>
										</ssk-text>
									</div>
								</div>
								<div class="customer-title">
									<div class="customer-name-badge">
										<ssk-text size="2xl" color="gray.800">
											{customer.firstName}
											{customer.lastName}
										</ssk-text>
										<ssk-badge variant="subtle" themeColor="primary">
											<ssk-icon name="outline-phone" />
											{customer.phone}
										</ssk-badge>
									</div>
									<ssk-text size="md" color="gray">
										<ssk-i18n-translate
											key="patona-sellercenter-customerbook-detail-customersince"
											lang={$currentLanguage.code}
											fallbackLang="default"
										/>
										{customer.createAt ? formatDate(customer.createAt, $currentLanguage.code) : ''}
									</ssk-text>
								</div>
							</div>
							<div class="right-section">
								<ssk-button variant="solid-light" themeColor="gray">
									<ssk-i18n-translate
										key="patona-sellercenter-customerbook-table-body-menu-editdata"
										lang={$currentLanguage.code}
										fallbackLang="default"
									/>
								</ssk-button>
							</div>
						</div>
						<div class="divider" />
						<div class="body">
							<div class="tab-header-wrapper">
								<ssk-tab-header variant="button" size="md" align="left" buttonwidth="auto">
									{#each tabLabels as tab, index}
										<ssk-tab-button
											active={index === activeTabIndex}
											variant="button"
											align="left"
											color="primary"
											buttonwidth="auto"
											width="auto"
											on:click={() => (activeTabIndex = index)}
										>
											{tab}
										</ssk-tab-button>
									{/each}
								</ssk-tab-header>
							</div>
							{#if activeTabIndex === 0 && storeId}
								<SaleHistoryTab bind:customerId bind:storeId />
							{:else if activeTabIndex === 1}
								<AddressTab bind:data={customer.addresses} />
							{:else if activeTabIndex === 2}
								<InvoiceTab bind:data={customer.taxInformation} />
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/await}
{/if}

<style lang="css">
	.container {
		width: 100%;
		height: 100%;

		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}

	.content {
		padding: 2rem;
	}

	.header {
		display: flex;
		justify-content: space-between;

		align-items: flex-start;
		gap: 0.5rem;
	}

	.header > .left-section,
	.customer-title {
		display: grid;
		gap: 0.5rem;
	}

	.customer-title {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.customer-name-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header > .right-section {
		display: flex;
		align-items: flex-start;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.badge {
		border: 1px solid var(--ssk-colors-gray-300);
		border-radius: 999px;
		padding: 2px 9px;
	}

	.divider {
		border-bottom: 1px solid var(--ssk-colors-gray-200);
		margin: 1.5rem 0;
	}

	.body {
		display: block;
		width: 100%;
	}

	.tab-header-wrapper {
		padding-bottom: 1.5rem;
	}

	.back {
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
