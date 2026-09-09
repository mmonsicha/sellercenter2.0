<script lang="ts">
	import { getContext } from 'svelte';
	import BlankPage from '$components/BlankPage.svelte';
	import type { Customer } from '$lib/entities/customer/customer';
	import { currentLanguage } from '$stores/i18n';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { currentCompany } from '$stores/company/current-company';
	import { addressToShort } from '$utils/format-address';
	import {
		getCustomerByIdWithAccess,
		listCustomersWithAccess
	} from '../../../../service/customer-book-v2-rest';

	export let onClickSelectCustomer: (c: Customer) => void;
	export let shouldLoadCustomer: boolean = false;
	/** Customer already on the order — the row for it says so instead of offering "เลือก". */
	export let selectedCustomerId: string = '';
	/** Address already on the order, for when the list payload carries no addresses. */
	export let selectedAddressLine: string = '';

	// The cashier picks a customer to ship or hand goods to, so each row states where
	// that customer is — not just their name and phone.
	const primaryAddress = (c: Customer) => c.addresses?.find((a) => a.isDefault) ?? c.addresses?.[0];
	$: selectedKey = selectedCustomerId ?? '';
	const addressLine = (c: Customer, key: string, fallback: string) => {
		const a = primaryAddress(c);
		if (a) return addressToShort(a);
		return key && String(c.id) === key ? fallback : '';
	};

	let customers: Customer[] = [];
	let search: string = '';
	let isLoading: boolean = false;
	let currentPage = 1;
	let rowsPerPage = 12;
	let totalCustomer = 0;
	let noCustomers: string = '';

	$: if (shouldLoadCustomer) {
		resetCustomerList();
		listCustomer();
		shouldLoadCustomer = false;
	}

	const i18nStore = getContext<I18nStore>('i18n');
	const loadKeywords = async () => {
		noCustomers = await i18nStore.get(
			'patona-sellercenter-customerbook-table-blank-nocustomer',
			$currentLanguage.code,
			'default'
		);
	};

	const resetCustomerList = () => {
		customers = [];
		search = '';
		currentPage = 1;
		totalCustomer = 0;
	};

	const listCustomer = async () => {
		if ($currentCompany) {
			isLoading = true;

			try {
				const result = await listCustomersWithAccess(
					`sellsuki.company:${$currentCompany.id}`,
					search,
					rowsPerPage,
					currentPage,
					'latest_order',
					'desc'
				);

				if (currentPage === 1) {
					customers = result.customers;
				} else {
					customers = [...customers, ...result.customers];
				}

				totalCustomer = result.total;
			} catch (e) {
				console.error('Error fetching customers:', e);
			} finally {
				isLoading = false;
			}
		}
	};
	const onSearchInputChange = async (e: Event) => {
		search = (e.target as HTMLInputElement).value.trim();
		currentPage = 1;
		customers = [];
		await listCustomer();
	};

	const onClickClearSearch = async () => {
		search = '';
		await listCustomer();
	};

	const getCustomerAndAddress = async (cId: string) => {
		if (!$currentCompany) return;

		getCustomerByIdWithAccess(cId, `sellsuki.company:${$currentCompany.id}`).then((resp) => {
			onClickSelectCustomer(resp);
		});
	};

	function handleScrollEnd() {
		if (isLoading) return;

		const hasMore = customers.length < totalCustomer;
		if (hasMore) {
			currentPage += 1;
			listCustomer();
		}
	}

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

<ssk-input placeholder="ชื่อหรือเบอร์โทรศัพท์" value={search} on:input={onSearchInputChange}>
	<ssk-input-addon slot="prefix">
		<ssk-icon name="outline-magnifying-glass" size="md"></ssk-icon>
	</ssk-input-addon>

	{#if search}
		<ssk-input-addon slot="postfix" on:click={onClickClearSearch}>
			<ssk-icon name="outline-x-circle" />
		</ssk-input-addon>
	{/if}
</ssk-input>

<div class="table">
	<ssk-dynamic-table
		height="100%"
		columnsWidth={['minmax(180px, 1.7fr)', 'minmax(96px, 0.8fr)', 'min-content']}
		on:scrollend={handleScrollEnd}
	>
		<ssk-header-cell slot="headers" align="left">ชื่อลูกค้า</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left">เบอร์โทร</ssk-header-cell>
		<ssk-header-cell slot="headers" align="center"></ssk-header-cell>

		{#each customers ?? [] as customer}
			<div
				class="table-row"
				class:selected={!!selectedKey && String(customer.id) === selectedKey}
				on:click={() => customer.id && getCustomerAndAddress(customer.id.toString())}
				data-testid={`sales.customer.row.${customer.id}`}
			>
				<ssk-table-cell align="left">
					<div class="customer-info">
						<ssk-tooltip
							size="sm"
							themeColor="white"
							placement="topleft"
							color="currentcolor"
							hideCloseButton={true}
						>
							<span slot="content" class="tooltip-content">
								<ssk-text size="xs">{customer.firstName} {customer.lastName}</ssk-text>
							</span>
							<ssk-text>
								<span class="ellipsis">{customer.firstName} {customer.lastName}</span>
							</ssk-text>
						</ssk-tooltip>
						{#if customer.email}
							<div class="sub-name">
								<ssk-tooltip
									size="sm"
									themeColor="white"
									placement="topleft"
									color="currentcolor"
									hideCloseButton={true}
								>
									<span slot="content" class="tooltip-content">
										<ssk-text size="xs">{customer.email}</ssk-text>
									</span>
									<ssk-text size="sm" color="gray.500">
										<span class="ellipsis">{customer.email}</span>
									</ssk-text>
								</ssk-tooltip>
							</div>
						{/if}
						{#if addressLine(customer, selectedKey, selectedAddressLine)}
							<div
								class="address-line"
								title={addressLine(customer, selectedKey, selectedAddressLine)}
							>
								<ssk-icon name="outline-map-pin" size="xs" themeColor="stroke"></ssk-icon>
								<span class="ellipsis">
									{addressLine(customer, selectedKey, selectedAddressLine)}
								</span>
								{#if (customer.addresses?.length ?? 0) > 1}
									<span class="address-more">+{(customer.addresses?.length ?? 0) - 1}</span>
								{/if}
							</div>
						{/if}
					</div>
				</ssk-table-cell>
				<ssk-table-cell align="left">
					<ssk-text>{customer.phone}</ssk-text>
				</ssk-table-cell>
				<ssk-table-cell align="center">
					{#if !!selectedKey && String(customer.id) === selectedKey}
						<span class="picked">
							<ssk-icon name="outline-check-circle" size="sm" themeColor="primary"></ssk-icon>
							เลือกอยู่
						</span>
					{:else}
						<ssk-text color="sky.600" underline>เลือก</ssk-text>
					{/if}
				</ssk-table-cell>
			</div>
		{/each}

		{#if isLoading}
			<div class="table-loadding" slot="placeholder">
				<ssk-spinner size="sm" color="sky"></ssk-spinner>
				กำลังโหลดข้อมูล
			</div>
		{/if}

		{#if customers.length === 0 && !isLoading}
			<div slot="placeholder">
				{#if search}
					<BlankPage description="ไม่พบรายชื่อลูกค้า" />
				{:else}
					<BlankPage description={noCustomers} />
				{/if}
			</div>
		{/if}
	</ssk-dynamic-table>
</div>

<style>
	ssk-input {
		--background-color: white;
		--border-color: var(--ssk-colors-gray-200);
		--gap: 0.5rem;
		padding-bottom: 0.5rem;
	}

	ssk-input-addon {
		padding-left: 0.5rem;
	}

	ssk-dynamic-table {
		/* DS default is 16px 24px, which on a three-line row makes 100px per customer —
		   four rows to a screen. The rows carry their own spacing now. */
		--table-padding: 10px 16px;
		--table-border-color: var(--ssk-colors-gray-200);
		color: var(--ssk-colors-gray-500);
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		--table-background-color: none;
	}

	ssk-header-cell {
		z-index: 1;
		white-space: nowrap;
		position: sticky;
	}

	ssk-table-cell {
		min-height: 68px;
	}

	.table {
		height: calc(100vh - 215px);
		padding-top: 0.75rem;
	}

	.table-loadding {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 100%;

		padding: 2rem 0;
		gap: 8px;
		box-sizing: border-box;
	}

	.table-row {
		display: contents;
	}

	.table-row:hover ssk-table-cell {
		background-color: var(--ssk-colors-stroke-50);
		cursor: pointer;
	}

	.table-row:hover ssk-table-cell {
		background-color: var(--ssk-colors-stroke-50);
		cursor: pointer;
	}

	.customer-info {
		display: grid;
		row-gap: 0.125rem;
		min-width: 0;
		width: 100%;
	}

	/* display: contents on the row means the cells carry the row's background, the
	   same way the hover rule above does. */
	.table-row.selected ssk-table-cell {
		background-color: var(--ssk-colors-primary-50, #fdf0ea);
	}

	.address-line {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
	}

	.address-more {
		flex: 0 0 auto;
		color: var(--ssk-colors-gray-400);
	}

	.picked {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		color: var(--ssk-colors-primary-500);
		white-space: nowrap;
	}

	.tooltip-content {
		padding: 2px 4px;
		max-width: 20rem;
		word-wrap: break-word;
		white-space: normal;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ellipsis {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.sub-name {
		display: flex;
		gap: 0.25rem;
		min-width: 0;
	}
</style>
