<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';
	import PermissionDenied from '$components/PermissionDenied.svelte';
	import MenuDropdown from '$components/dropdown/MenuDropdown.svelte';
	import type { Customer } from '$lib/entities/customer/customer';
	import { ErrorCode } from '$lib/entities/error/error';
	import { currentCompany } from '$stores/company/current-company';
	import { debounced } from '$utils/debounce';
	import {
		getVarFromQuery as extractQueryParams,
		numberQuery,
		stringQuery
	} from '$utils/queryParams';
	import { Link, navigate, useLocation } from 'svelte-routing';
	import { listCustomers } from '../../service/customer-book-v2-rest';
	import { currentLanguage } from '$stores/i18n';
	import { getContext } from 'svelte';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { AxiosError } from 'axios';
	import { checkPermissionsEach } from '$utils/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { currentStore } from '$stores/store/current-store';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';

	const location = useLocation();
	const i18nStore = getContext<I18nStore>('i18n');

	let customers: Customer[] = [];
	let total = 0;
	let isLoading: boolean = false;
	let currentPage = 1;
	let rowsPerPage = 10;
	let sortDirection: 'asc' | 'desc' = 'desc';
	let sortField: 'latest_order' | 'order_count' = 'latest_order';
	let search: string = '';
	let searchPlaceholder: string = '';
	let noCustomers: string = '';
	let previousCompanyId: string | null = null;
	let isForbidden = false;
	let loadPromise: Promise<void> | null = null;
	let lastLoadKey = '';
	let lastQueryKey = '';

	// Permissions
	let canView = false;
	let canEdit = false;
	let canCreate = false;

	const applyQueryParams = (searchParams: URLSearchParams) => {
		const parsed = extractQueryParams(searchParams, {
			search: stringQuery(),
			currentPage: numberQuery({ key: 'page', fallback: 1 }),
			rowsPerPage: numberQuery({ key: 'rows', fallback: 10 }),
			sortField: stringQuery<'latest_order' | 'order_count'>({
				key: 'sort',
				fallback: 'latest_order',
				emptyAsFallback: true
			}),
			sortDirection: stringQuery<'asc' | 'desc'>({
				key: 'dir',
				fallback: 'desc',
				emptyAsFallback: true
			})
		});

		search = parsed.search;
		currentPage = parsed.currentPage;
		rowsPerPage = parsed.rowsPerPage;
		sortField = parsed.sortField;
		sortDirection = parsed.sortDirection;
	};

	$: queryKey = [currentPage, rowsPerPage, sortField, sortDirection, search].join('|');

	$: {
		const baseKey = [$currentCompany?.id ?? '', $currentStore?.id ?? ''].join('|');
		if ($currentCompany && $currentStore && baseKey !== lastLoadKey) {
			lastLoadKey = baseKey;
			lastQueryKey = queryKey;
			loadPromise = fetchCustomers();
		}
	}

	$: {
		if ($currentCompany && $currentStore && queryKey !== lastQueryKey) {
			lastQueryKey = queryKey;
			void fetchCustomers();
		}
	}

	async function fetchCustomers() {
		if (!$currentCompany?.id || !$currentStore?.id) return;

		isLoading = true;
		isForbidden = false;
		await checkPermission();
		if (!canView) {
			isLoading = false;
			return;
		}
		customers = [];
		total = 0;

		try {
			const response = await listCustomers(
				`sellsuki.company:${$currentCompany?.id}`,
				search,
				rowsPerPage,
				currentPage,
				sortField,
				sortDirection
			);
			customers = response.customers;
			total = response.total;
		} catch (error) {
			if (error instanceof AxiosError) {
				if (error.response?.data?.error === ErrorCode.PermissionDenied) {
					isForbidden = true;
					return;
				}
			}
		} finally {
			isLoading = false;
		}
	}

	const setQueryParams = (q: Record<string, string>) => {
		let searchParams = new URLSearchParams($location.search);
		for (const [key, value] of Object.entries(q)) {
			searchParams.set(key, value);
		}

		$location.search = searchParams.toString();

		history.replaceState(null, '', `${$location.pathname}?${searchParams.toString()}`);
	};

	$: {
		const newCompanyId = $currentCompany?.id ?? null;
		if (previousCompanyId !== null && newCompanyId && newCompanyId !== previousCompanyId) {
			if (currentPage !== 1) {
				currentPage = 1;
				setQueryParams({ page: '1' });
			}
		}
		if (newCompanyId !== null) {
			previousCompanyId = newCompanyId;
		}
	}

	function handlePageChange(event: CustomEvent) {
		setQueryParams({ page: event.detail.page.toString() });
	}

	function handleRowPerPageChange(event: CustomEvent) {
		setQueryParams({ rows: event.detail.rowsPerPage.toString(), page: '1' });
	}

	const onChangeSeach = (event: Event) => {
		search = (event.target as HTMLInputElement).value;
		setQueryParams({ search: search, page: '1' });
	};

	const handleSortChange = (field: 'latest_order' | 'order_count') =>
		function (event: CustomEvent) {
			if (sortField === field) {
				setQueryParams({ dir: sortDirection === 'asc' ? 'desc' : 'asc' });
			} else {
				setQueryParams({ sort: field, dir: 'asc' });
			}
		};

	applyQueryParams(new URLSearchParams(window.location.search));
	setQueryParams({
		search: search,
		page: currentPage.toString(),
		rows: rowsPerPage.toString(),
		sort: sortField,
		dir: sortDirection
	});
	location.subscribe((l) => {
		let searchParams = new URLSearchParams(l.search);
		applyQueryParams(searchParams);
	});

	const loadKeywords = async () => {
		searchPlaceholder = await i18nStore.get(
			'patona-sellercenter-customerbook-placeholder-search',
			$currentLanguage.code,
			'default'
		);

		noCustomers = await i18nStore.get(
			'patona-sellercenter-customerbook-table-blank-nocustomer',
			$currentLanguage.code,
			'default'
		);
	};

	function onClickToViewCustomer(cId?: number) {
		// NOTE: Keep all customer list query params when navigate to /customers/view/{id}
		const encodeBackTo = encodeURIComponent(`${$location.pathname}?${$location.search.toString()}`);
		navigate(`/customers/view/${cId}?back_to=${encodeBackTo}`);
	}

	$: if ($currentLanguage.code) {
		loadKeywords();
	}

	async function checkPermission() {
		if (!$currentCompany?.id || !$currentStore?.id) return;
		await waitForDialogPermissionReady($currentCompany?.id);
		try {
			const data = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
				EntityPermission.CUSTOMERVIEW,
				EntityPermission.CUSTOMERCREATE,
				EntityPermission.CUSTOMERUPDATE
			]);
			canView = data[EntityPermission.CUSTOMERVIEW];
			canCreate = data[EntityPermission.CUSTOMERCREATE];
			canEdit = data[EntityPermission.CUSTOMERUPDATE];
		} catch (error) {
			canView = false;
			canCreate = false;
			canEdit = false;
		}
	}
</script>

{#if $currentStore?.id}
	{#await loadPromise}
		<LoadingPage description="loading" />
	{:then}
		{#if isForbidden || !canView}
			<PermissionDenied />
		{:else}
			<div class={`container ${customers.length > 0 ? 'with-contents' : ''}`}>
				<div class="header">
					<ssk-text size="2xl">
						<ssk-i18n-translate
							key="patona-sellercenter-customerbook-title-customerbook"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>

					<Link to="/customers/new">
						{#if !canCreate}
							<ssk-tooltip size="xs" themeColor="black" hideCloseButton={true} placement="bottom">
								<span slot="content" class="tooltip-content">
									<ssk-text size="xs" color="white"> จำกัดสิทธิ์การเข้าถึง </ssk-text>
								</span>
								<ssk-button disabled={!canCreate}>
									<ssk-icon name="outline-plus" />
									<ssk-i18n-translate
										key="patona-sellercenter-customerbook-button-addcustomer"
										lang={$currentLanguage.code}
										fallbackLang="default"
									/>
								</ssk-button>
							</ssk-tooltip>
						{:else}
							<ssk-button>
								<ssk-icon name="outline-plus" />
								<ssk-i18n-translate
									key="patona-sellercenter-customerbook-button-addcustomer"
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-button>
						{/if}
					</Link>
				</div>
				<div class="actions">
					<ssk-input
						placeholder={searchPlaceholder}
						value={search}
						on:input={debounced(onChangeSeach, 1000)}
						width="full"
					>
						<ssk-input-addon slot="prefix">
							<ssk-icon name="outline-magnifying-glass" size="md"></ssk-icon>
						</ssk-input-addon>

						{#if search}
							<ssk-input-addon
								slot="postfix"
								on:click={() => {
									setQueryParams({ search: '', page: '1' });
								}}
							>
								<ssk-icon name="outline-x-circle"></ssk-icon>
							</ssk-input-addon>
						{/if}
					</ssk-input>
				</div>
				<ssk-dynamic-table
					height="100%"
					columnsWidth={['minmax(200px, 1fr)', 'minmax(200px, 1fr)', '142px', '200px', '80px']}
					backgroundColor="#fff"
					borderColor="#ccc"
				>
					{#if isLoading}
						<div class="table-placeholder" slot="placeholder">
							<LoadingPage description="loading" />
						</div>
					{:else}
						<ssk-header-cell slot="headers" align="left">
							<ssk-i18n-translate
								key="patona-sellercenter-customerbook-table-header-customername"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-header-cell>
						<ssk-header-cell slot="headers" align="left">
							<ssk-i18n-translate
								key="patona-sellercenter-customerbook-table-header-phone"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-header-cell>
						<ssk-header-cell
							slot="headers"
							align="left"
							sortDirection={sortField === 'order_count' ? sortDirection : undefined}
							sortable
							on:sort-changed={handleSortChange('order_count')}
						>
							<ssk-i18n-translate
								key="patona-sellercenter-customerbook-table-header-totalorder"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-header-cell>
						<ssk-header-cell
							slot="headers"
							align="left"
							sortDirection={sortField === 'latest_order' ? sortDirection : undefined}
							sortable
							on:sort-changed={handleSortChange('latest_order')}
						>
							<ssk-i18n-translate
								key="patona-sellercenter-customerbook-table-header-latestorder"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-header-cell>
						<ssk-header-cell slot="headers"></ssk-header-cell>

						{#each customers ?? [] as customer}
							<ssk-table-cell align="left">
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
									<ssk-text on:click={() => onClickToViewCustomer(customer.id)}>
										<span class="ellipsis text-hover">{customer.firstName} {customer.lastName}</span
										>
									</ssk-text>
								</ssk-tooltip>
							</ssk-table-cell>
							<ssk-table-cell align="left">
								<ssk-text>{customer.phone}</ssk-text>
							</ssk-table-cell>
							<ssk-table-cell align="right">
								<ssk-text>{customer.orderList?.length ?? 0}</ssk-text>
							</ssk-table-cell>
							<ssk-table-cell align="left">
								{#if customer.latestOrder}
									<ssk-date-display date={customer.latestOrder} />
								{:else}
									<ssk-text>-</ssk-text>
								{/if}
							</ssk-table-cell>
							<ssk-table-cell align="left">
								<!-- Kebab -->
								<MenuDropdown enableOptionHover={true}>
									<ssk-icon slot="trigger" name="outline-ellipsis-vertical" size="md" />
									<svelte:fragment slot="menu" let:close>
										<div class="menu-dropdown-options-container">
											<div
												class="menu-dropdown-option"
												on:click={() => {
													onClickToViewCustomer(customer.id);
													close();
												}}
											>
												<ssk-i18n-translate
													key="patona-sellercenter-customerbook-table-body-menu-view"
													lang={$currentLanguage.code}
													fallbackLang="default"
												/>
											</div>
											{#if !canEdit}
												<ssk-tooltip
													size="xs"
													themeColor="black"
													hideCloseButton={true}
													placement="bottom"
												>
													<span slot="content" class="tooltip-content">
														<ssk-text size="xs" color="white"> จำกัดสิทธิ์การเข้าถึง </ssk-text>
													</span>

													<div class="menu-dropdown-option disabled" aria-disabled={!canEdit}>
														<ssk-i18n-translate
															key="patona-sellercenter-customerbook-table-body-menu-editdata"
															lang={$currentLanguage.code}
															fallbackLang="default"
														/>
													</div>
												</ssk-tooltip>
											{:else}
												<div
													class="menu-dropdown-option"
													on:click={() => {
														navigate(`/customers/edit/${customer.id}`);
														close();
													}}
												>
													<ssk-i18n-translate
														key="patona-sellercenter-customerbook-table-body-menu-editdata"
														lang={$currentLanguage.code}
														fallbackLang="default"
													/>
												</div>
											{/if}
										</div>
									</svelte:fragment>
								</MenuDropdown>
							</ssk-table-cell>
						{/each}
						{#if customers.length > 0}
							<ssk-pagination
								slot="footer"
								showrowsperpage
								showBtnPage
								dropdownAnchor="top"
								{currentPage}
								totalpages={Math.ceil(total / rowsPerPage)}
								{rowsPerPage}
								pageSize={rowsPerPage}
								on:page-changed={handlePageChange}
								on:rows-per-page-changed={handleRowPerPageChange}
							></ssk-pagination>{/if}
					{/if}
					{#if customers.length === 0 && !isLoading}
						<div class="table-placeholder" slot="placeholder">
							<BlankPage description={noCustomers} />
						</div>
					{/if}
				</ssk-dynamic-table>
			</div>
		{/if}
	{/await}
{/if}

<style lang="css">
	.container {
		display: grid;
		grid-template-rows: max-content auto 1fr;
		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.container.with-contents {
		height: max-content;
		max-height: auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		padding: 24px 24px;
		border-bottom: 1px solid var(--ssk-colors-gray-200);
	}

	.actions {
		display: grid;
		grid-template-columns: 368px auto;
		padding: 20px 24px;
		border-bottom: 1px solid var(--ssk-colors-gray-200);
	}

	ssk-dynamic-table {
		border-bottom-left-radius: 8px;
		border-bottom-right-radius: 8px;
		--table-overflow-y: unset;
	}

	ssk-header-cell {
		z-index: 1;
		white-space: nowrap;
		position: sticky;
	}

	ssk-table-cell {
		height: 101px;
	}

	.tooltip-content {
		width: auto;
		padding: 2px 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ellipsis {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;

		@supports (-webkit-line-clamp: 2) {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: initial;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
		}
	}

	.text-hover {
		cursor: pointer;
		color: var(--ssk-colors-black-900);
	}
	.text-hover:hover {
		color: var(--ssk-colors-primary-500);
	}
</style>
