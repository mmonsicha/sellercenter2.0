<script lang="ts">
	import { loadOms2Orders, oms2OrderList } from '$stores/order/oms2-order-list';
	import {
		FulfillmentType,
		Oms2OrderStatus,
		Oms2PaymentStatus,
		Oms2Tab,
		StockState
	} from '$lib/entities/order/oms2-order-list';
	import { ORDER_TABS, toOms2Tab } from './order-tab';

	import { currentLanguage } from '$stores/i18n';
	import { ErrorCode } from '$lib/entities/error/error';
	import {
		convertFilterToQueryParams,
		countActiveFilters,
		FILTER_QUERY_KEYS,
		hasFilterChanged,
		oFilter,
		setDefaultOrderFilter,
		setIsClearSearchOrderFilter,
		type OrderFilter,
		type Sort
	} from '$stores/order/filter';
	import { currentStore } from '$stores/store/current-store';
	import { formatAbbreviatedNumber } from '$utils/format-number';
	import { onDestroy } from 'svelte';
	import { navigate, useLocation } from 'svelte-routing';
	import { get } from 'svelte/store';
	import OrderSearch from './OrderSearch.svelte';
	import OrderTable from './Table/OrderTable.svelte';
	import {
		delimitedQuery,
		getVarFromQuery as extractQueryParams,
		numberQuery,
		stringQuery
	} from '$utils/queryParams';
	import { AxiosError } from 'axios';
	import PermissionDenied from '$components/PermissionDenied.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';
	import { checkPermissionsEach } from '$utils/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';
	import SlipReviewModal from '$components/order/SlipReviewModal.svelte';
	import EditPaymentModal from '$components/order/EditPaymentModal.svelte';
	import RejectPaymentModal from '$components/order/RejectPaymentModal.svelte';
	import ApproveConfirmModal from '$components/order/ApproveConfirmModal.svelte';
	import OrderPaymentModal from '$pages/sales/modals/OrderPaymentModal.svelte';
	import NoPaymentChannelModal from '$pages/sales/modals/NoPaymentChannelModal.svelte';
	import DeliverConfirmModal from '$components/order/DeliverConfirmModal.svelte';
	import { setOrderRefresher, clearOrderRefresher } from '$stores/order/order-refresh';

	const location = useLocation();

	let activeTab: Oms2Tab = Oms2Tab.All,
		currentPage: number = 1,
		rowsPerPage: number = 10;

	// Tab counts + unknown-status count come straight from the list source.
	$: orderCounter = $oms2OrderList.tabCounts;
	$: unknownCount = $oms2OrderList.unknownCount;

	let search: string = '';
	let sDate: string = '';
	let eDate: string = '';
	let sortDirection: Sort = 'desc';
	let canView = false;
	let canManagePayment = false;
	let canUpdateOrder = false;
	let loadPromise: Promise<void> | null = null;
	let lastInitialKey = '';
	let lastQueryKey = '';

	// Pre-OMS2 filter keys — stripped from the URL so old bookmarks don't linger.
	const LEGACY_QUERY_KEYS = ['paymentType', 'salesChannels', 'couriers'];

	// Drop values that aren't valid for the enum (hand-edited / stale URLs).
	const onlyValid = (values: string[] | undefined, allowed: object) => {
		const ok = Object.values(allowed) as string[];
		const v = values?.filter((x) => ok.includes(x));
		return v?.length ? v : undefined;
	};

	const applyQueryParams = (searchParams: URLSearchParams) => {
		const parsed = extractQueryParams(searchParams, {
			search: stringQuery(),
			currentPage: numberQuery({ key: 'page', fallback: 1 }),
			rowsPerPage: numberQuery({ key: 'rows', fallback: 10 }),
			startDate: stringQuery({ key: 'startDate', fallback: '' }),
			endDate: stringQuery({ key: 'endDate', fallback: '' }),
			sortDirection: stringQuery<Sort>({
				key: 'dir',
				fallback: 'desc',
				emptyAsFallback: true
			}),
			activeTab: stringQuery({
				key: 'tab',
				fallback: Oms2Tab.All,
				emptyAsFallback: true
			}),
			channels: delimitedQuery({ key: FILTER_QUERY_KEYS.channels, decode: true }),
			paymentStatuses: delimitedQuery({ key: FILTER_QUERY_KEYS.paymentStatuses }),
			fulfillments: delimitedQuery({ key: FILTER_QUERY_KEYS.fulfillments }),
			statuses: delimitedQuery({ key: FILTER_QUERY_KEYS.statuses }),
			stocks: delimitedQuery({ key: FILTER_QUERY_KEYS.stocks })
		});

		search = parsed.search;
		currentPage = parsed.currentPage;
		rowsPerPage = parsed.rowsPerPage;
		sDate = parsed.startDate;
		eDate = parsed.endDate;
		sortDirection = parsed.sortDirection;
		activeTab = toOms2Tab(parsed.activeTab); // old links (?tab=process/cancel) fall back to All

		$oFilter.search = search || undefined;
		$oFilter.sort = sortDirection || undefined;

		if (parsed.startDate && parsed.endDate) {
			$oFilter.createdDate = { start: parsed.startDate, end: parsed.endDate };
		} else {
			$oFilter.createdDate = undefined;
		}

		$oFilter.channels = parsed.channels?.length ? parsed.channels : undefined;
		$oFilter.paymentStatuses = onlyValid(parsed.paymentStatuses, Oms2PaymentStatus);
		$oFilter.fulfillments = onlyValid(parsed.fulfillments, FulfillmentType);
		$oFilter.statuses = onlyValid(parsed.statuses, Oms2OrderStatus);
		$oFilter.stocks = onlyValid(parsed.stocks, StockState);
		// Badge count is derived, never trusted from the URL.
		$oFilter.total = countActiveFilters($oFilter);
	};

	const getDefaultParams = (): Record<string, string> => ({
		...convertFilterToQueryParams({ total: 0 }),
		...Object.fromEntries(LEGACY_QUERY_KEYS.map((k) => [k, ''])),
		page: '1',
		rows: '10',
		dir: 'desc',
		tab: activeTab
	});

	const setQueryParams = (q: Record<string, string>) => {
		if ($location.pathname !== '/order') return;

		let searchParams = new URLSearchParams($location.search);

		for (const [key, value] of Object.entries(q)) {
			if (value === '' || value === undefined) {
				searchParams.delete(key);
			} else {
				searchParams.set(key, value);
			}
		}

		$location.search = searchParams.toString();
		history.replaceState(null, '', `${$location.pathname}?${searchParams.toString()}`);
	};

	applyQueryParams(new URLSearchParams(window.location.search));
	setQueryParams({
		...convertFilterToQueryParams($oFilter),
		...Object.fromEntries(LEGACY_QUERY_KEYS.map((k) => [k, ''])),
		page: currentPage.toString(),
		rows: rowsPerPage.toString(),
		tab: activeTab.toString()
	});

	const unsubscribeLocation = location.subscribe((l) => {
		// Ignore location changes once we've navigated off the order list — otherwise
		// this keeps reading another route's query into the order state (and re-fetching).
		if (l.pathname !== '/order') return;
		if (get(hasFilterChanged)) {
			currentPage = 1;
		}
		let searchParams = new URLSearchParams(l.search);
		applyQueryParams(searchParams);
	});

	// Register the refresher so slip/payment modals can re-fetch the current page
	// in-place after a mutation instead of reloading the page.
	// The closure captures `currentPage` and `rowsPerPage` by reference so it always
	// uses the latest values at the time of the call.
	const refreshOrderList = () => fetchOrders(currentPage, rowsPerPage);
	setOrderRefresher(refreshOrderList);

	onDestroy(() => {
		setDefaultOrderFilter();
		// Clear only our own registration — during route swaps the new page may have
		// registered before this onDestroy runs.
		clearOrderRefresher(refreshOrderList);
		unsubscribeLocation();
	});

	$: {
		if ($currentStore?.id) {
			if (get(hasFilterChanged) && currentPage !== 1) {
				currentPage = 1;
			}
		}
	}

	$: {
		if ($currentStore?.id) {
			const initialKey = $currentStore.id;
			const nextQueryKey = [
				activeTab,
				currentPage,
				rowsPerPage,
				JSON.stringify({
					search: $oFilter.search,
					sort: $oFilter.sort,
					createdDate: $oFilter.createdDate,
					channels: $oFilter.channels,
					paymentStatuses: $oFilter.paymentStatuses,
					fulfillments: $oFilter.fulfillments,
					statuses: $oFilter.statuses,
					stocks: $oFilter.stocks
				})
			].join('|');
			const isInitialLoad = initialKey !== lastInitialKey;
			if (isInitialLoad) {
				lastInitialKey = initialKey;
				lastQueryKey = nextQueryKey;
				loadPromise = fetchOrders(currentPage, rowsPerPage);
			}

			if (!isInitialLoad && nextQueryKey !== lastQueryKey) {
				lastQueryKey = nextQueryKey;
				void fetchOrders(currentPage, rowsPerPage);
			}
		}
	}

	async function fetchOrders(page: number, rowsPerPage: number) {
		if (!$currentStore?.id) return;

		await checkPermission();
		if (!canView) return;
		search = $oFilter.search ?? '';
		sortDirection = $oFilter.sort ?? 'desc';
		sDate = $oFilter.createdDate?.start ?? '';
		eDate = $oFilter.createdDate?.end ?? '';

		setQueryParams({
			...convertFilterToQueryParams($oFilter),
			page: page.toString(),
			rows: rowsPerPage.toString()
		});

		// API bypassed (DES-2235): mock source filters/paginates client-side.
		try {
			await loadOms2Orders({
				tab: activeTab,
				page,
				rows: rowsPerPage,
				sort: sortDirection,
				search: search || undefined,
				startDate: sDate || undefined,
				endDate: eDate || undefined,
				channels: $oFilter.channels,
				paymentStatuses: $oFilter.paymentStatuses as Oms2PaymentStatus[] | undefined,
				fulfillments: $oFilter.fulfillments as FulfillmentType[] | undefined,
				statuses: $oFilter.statuses as Oms2OrderStatus[] | undefined,
				stocks: $oFilter.stocks as StockState[] | undefined
			});
		} catch (error) {
			if (error instanceof AxiosError) {
				if (error.response?.data?.error === ErrorCode.PermissionDenied) {
					canView = false;
					return;
				}
			}
		}
	}

	async function checkPermission() {
		if (!$currentStore?.id) {
			canView = false;
			return;
		}
		await waitForDialogPermissionReady();
		try {
			const data = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
				EntityPermission.ORDERVIEW,
				EntityPermission.ORDERPAYMENTMANAGE,
				EntityPermission.ORDERUPDATE
			]);
			// Checked on its own: IAM may not know oms.order.view yet, and an unknown key
			// failing the batch would wrongly lock users out (helper turns errors into false).
			const oms = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
				EntityPermission.OMSORDERVIEW
			]);
			canView = !!oms[EntityPermission.OMSORDERVIEW] || !!data[EntityPermission.ORDERVIEW];
			canManagePayment = !!data[EntityPermission.ORDERPAYMENTMANAGE];
			canUpdateOrder = !!data[EntityPermission.ORDERUPDATE];
		} catch (error) {
			canView = false;
			canManagePayment = false;
			canUpdateOrder = false;
		}
	}

	const handleTabButtonClick = (tabIdx: Oms2Tab) => {
		return () => {
			if (activeTab === tabIdx) return;
			activeTab = tabIdx;

			currentPage = 1;
			rowsPerPage = 10;

			// reset filter option (status options differ per tab, so filters never carry over).
			// Read search before resetting — the old order checked it after it was cleared.
			const hadSearch = !!$oFilter.search;
			setDefaultOrderFilter();
			if (hadSearch) setIsClearSearchOrderFilter(true);
			setQueryParams(getDefaultParams());
		};
	};

	const shouldShowBadge = (
		currentTab: Oms2Tab,
		tab: Oms2Tab,
		count: number,
		showCounter: boolean = false,
		filter: OrderFilter
	): boolean => {
		if (!count) return false;

		if (filter.search || filter.total > 0) {
			return tab === currentTab;
		}

		return showCounter;
	};
</script>

{#key $currentStore?.id}
	{#if $currentStore?.id}
		{#await loadPromise}
			<LoadingPage description="กำลังโหลดข้อมูล..." />
		{:then}
			{#if !canView}
				<PermissionDenied />
			{:else}
				<div class="container">
					<div class="header">
						<ssk-text size="2xl" data-testid="orders.header.identifier">
							<ssk-i18n-translate
								key="patona-sellercenter-myorder-title-myorder"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
					</div>
					<div class="orders">
						<ssk-tab-header
							size="md"
							align="left"
							color="primary"
							buttonwidth="auto"
							data-testid="orders.tab-header"
						>
							{#key Object.values(orderCounter).join(',')}
								{#each ORDER_TABS as t}
									<ssk-tab-button
										active={activeTab === t.tab}
										on:click={handleTabButtonClick(t.tab)}
										data-testid={t.testIdHeader}
										size="md"
										align="left"
										color="primary"
										buttonwidth="auto"
									>
										<ssk-i18n-translate key={t.i18nKey} lang={$currentLanguage.code} />
										<ssk-badge
											hidden={!shouldShowBadge(
												activeTab,
												t.tab,
												orderCounter[t.tab],
												t.showCounter,
												$oFilter
											)}
											variant="subtle"
											themecolor={t.badgeColor}
											data-testid={t.testIdCounter}
										>
											{formatAbbreviatedNumber(orderCounter[t.tab])}
										</ssk-badge>
									</ssk-tab-button>
								{/each}
							{/key}
						</ssk-tab-header>

						<OrderSearch tab={activeTab} />
					</div>

					{#if unknownCount > 0 && activeTab === Oms2Tab.All}
						<div class="unknown-banner" role="status" data-testid="orders.banner.unknown-status">
							<ssk-icon name="outline-exclamation-triangle" themecolor="warning" size="md"
							></ssk-icon>
							<ssk-text size="sm" color="gray.800">
								<ssk-i18n-translate
									key="oms.order.banner.unknown"
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
								({unknownCount})
							</ssk-text>
						</div>
					{/if}

					{#key activeTab}
						<OrderTable
							bind:currentPage
							bind:rowsPerPage
							{canManagePayment}
							{canUpdateOrder}
							onRetry={() => fetchOrders(currentPage, rowsPerPage)}
						/>
					{/key}
					<SlipReviewModal {canManagePayment} />
					<EditPaymentModal {canManagePayment} />
					<RejectPaymentModal />
					<ApproveConfirmModal />
					<OrderPaymentModal {canManagePayment} />
					<NoPaymentChannelModal />
					<DeliverConfirmModal />
				</div>
			{/if}
		{/await}
	{/if}
{/key}

<style lang="css">
	.container {
		display: flex;
		flex-direction: column;
		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		height: auto;
		width: 100%;
	}

	.header {
		padding: 1.5rem;
		border-bottom: 1px solid var(--ssk-colors-gray-200);
	}

	/* 5 tabs overflow on narrow screens — scroll the tab strip instead of wrapping */
	.orders {
		min-width: 0;
	}
	.orders > ssk-tab-header {
		display: block;
		overflow-x: auto;
		scrollbar-width: none;
	}

	@media (max-width: 767px) {
		.header {
			padding: 1rem;
		}
		.unknown-banner {
			margin: 0 1rem 1rem;
		}
	}

	.unknown-banner {
		display: flex;
		align-items: center;
		gap: var(--spacing-2, 8px);
		margin: 0 1.5rem 1rem;
		padding: var(--spacing-3, 12px) var(--spacing-4, 16px);
		background: var(--ssk-colors-warning-50);
		border: 1px solid var(--ssk-colors-warning-200);
		border-radius: 8px;
	}
</style>
