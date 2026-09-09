<script lang="ts">
	import { listOrder, orderList, type Tasks } from '$stores/order/order';

	import { currentLanguage } from '$stores/i18n';
	import { ErrorCode } from '$lib/entities/error/error';
	import {
		convertFilterToQueryParams,
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
	import { OrderStatus } from './filterHandler';
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

	let statuses: string[] = [];
	let activeTab: OrderStatus = OrderStatus.all,
		currentPage: number = 1,
		rowsPerPage: number = 10;

	let orderCounter: Record<OrderStatus, number> = {
		all: 0,
		processing: 0,
		completed: 0,
		cancel: 0
	};

	let tasks: Tasks[] = [];
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

	type Tab = {
		orderStatus: OrderStatus;
		i18nHeaderKey: string;
		testIdHeader: string;
		testIdCounter: string;
		badgeColor: string;
		showCounter?: boolean;
	};

	let tabs: Tab[] = [
		{
			orderStatus: OrderStatus.all,
			i18nHeaderKey: 'patona-sellercenter-myorder-tab-all',
			testIdHeader: 'orders.tab.total',
			testIdCounter: 'orders.total.text.counter',
			badgeColor: 'primary'
		},
		{
			orderStatus: OrderStatus.process,
			i18nHeaderKey: 'patona-sellercenter-myorder-tab-inprogress',
			testIdHeader: 'orders.tab.inprogress',
			testIdCounter: 'orders.inprogress.text.counter',
			badgeColor: 'sky',
			showCounter: true
		},
		{
			orderStatus: OrderStatus.completed,
			i18nHeaderKey: 'patona-sellercenter-myorder-tab-completed',
			testIdHeader: 'orders.tab.success',
			testIdCounter: 'orders.success.text.counter',
			badgeColor: 'success'
		},
		{
			orderStatus: OrderStatus.cancel,
			i18nHeaderKey: 'patona-sellercenter-myorder-tab-canceled',
			testIdHeader: 'orders.tab.cancel',
			testIdCounter: 'orders.cancel.text.counter',
			badgeColor: 'gray',
			showCounter: true
		}
	];

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
			activeTab: stringQuery<OrderStatus>({
				key: 'tab',
				fallback: OrderStatus.all,
				emptyAsFallback: true
			}),
			total: numberQuery({ key: 'total', fallback: 0 }),
			paymentStatus: delimitedQuery({ key: 'paymentStatus' }),
			paymentType: delimitedQuery({ key: 'paymentType' }),
			salesChannels: delimitedQuery({ key: 'salesChannels' }),
			couriers: delimitedQuery({ key: 'couriers', decode: true })
		});

		search = parsed.search;
		currentPage = parsed.currentPage;
		rowsPerPage = parsed.rowsPerPage;
		sDate = parsed.startDate;
		eDate = parsed.endDate;
		sortDirection = parsed.sortDirection;
		activeTab = parsed.activeTab;

		$oFilter.total = parsed.total;
		$oFilter.search = search || undefined;
		$oFilter.sort = sortDirection || undefined;

		if (parsed.startDate && parsed.endDate) {
			$oFilter.createdDate = { start: parsed.startDate, end: parsed.endDate };
		} else {
			$oFilter.createdDate = undefined;
		}

		if (parsed.paymentStatus || parsed.paymentType) {
			$oFilter.payment = {
				status: parsed.paymentStatus,
				type: parsed.paymentType
			};
		} else {
			$oFilter.payment = undefined;
		}

		$oFilter.salesChannels = parsed.salesChannels;

		$oFilter.couriers = parsed.couriers;
	};

	const getDefaultParams = () => ({
		search: '',
		page: '1',
		rows: '10',
		startDate: '',
		endDate: '',
		dir: 'desc',
		tab: activeTab,
		total: '0',
		paymentStatus: '',
		paymentType: '',
		salesChannels: '',
		couriers: ''
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
			statuses = getStatusesByTabIndex(activeTab);

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
					payment: $oFilter.payment,
					salesChannels: $oFilter.salesChannels,
					couriers: $oFilter.couriers
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

	function getStatusesByTabIndex(ot: OrderStatus): string[] {
		switch (ot) {
			case OrderStatus.process:
				return ['pending', 'processing'];
			case OrderStatus.completed:
				return ['completed'];
			case OrderStatus.cancel:
				return ['canceled'];
			default:
				return [];
		}
	}

	async function fetchOrders(page: number, rowsPerPage: number) {
		if (!$currentStore?.id) return;

		await checkPermission();
		if (!canView) return;
		tasks = [];
		let queryParams: Record<string, string> = {};

		if ($oFilter.payment) {
			tasks.push({ name: 'payment', ...$oFilter.payment });
			queryParams['paymentStatus'] = $oFilter.payment.status?.length
				? $oFilter.payment.status.join(',')
				: '';

			queryParams['paymentType'] = $oFilter.payment.type?.length
				? $oFilter.payment.type.join(',')
				: '';
		} else {
			queryParams['paymentStatus'] = '';
			queryParams['paymentType'] = '';
		}

		if ($oFilter.salesChannels) {
			queryParams['salesChannels'] = $oFilter.salesChannels.length
				? $oFilter.salesChannels.join(',')
				: '';
		} else {
			queryParams['salesChannels'] = '';
		}

		if ($oFilter.couriers) {
			queryParams['couriers'] = $oFilter.couriers.length ? $oFilter.couriers.join(',') : '';
		} else {
			queryParams['couriers'] = '';
		}

		if ($oFilter.createdDate) {
			sDate = $oFilter.createdDate.start;
			eDate = $oFilter.createdDate.end;
			queryParams['startDate'] = sDate || '';
			queryParams['endDate'] = eDate || '';
		} else {
			queryParams['startDate'] = '';
			queryParams['endDate'] = '';
		}

		if ($oFilter.search) {
			search = $oFilter.search;
			queryParams['search'] = search || '';
		} else {
			queryParams['search'] = '';
		}

		if ($oFilter.sort) {
			sortDirection = $oFilter.sort;
			queryParams['dir'] = sortDirection || '';
		} else {
			queryParams['dir'] = '';
		}

		queryParams['total'] = $oFilter.total.toString();
		queryParams['page'] = page.toString();
		queryParams['rows'] = rowsPerPage.toString();

		setQueryParams(queryParams);

		try {
			await listOrder(
				$currentStore?.id,
				(page - 1) * rowsPerPage,
				rowsPerPage,
				sortDirection,
				statuses,
				tasks,
				search,
				sDate,
				eDate,
				$oFilter.salesChannels ?? [],
				$oFilter.couriers ?? []
			);
		} catch (error) {
			if (error instanceof AxiosError) {
				if (error.response?.data?.error === ErrorCode.PermissionDenied) {
					canView = false;
					return;
				}
			}
		}

		const { totalCount } = get(orderList);
		orderCounter = {
			all: totalCount?.total ?? 0,
			processing: (totalCount?.totalProcessing ?? 0) + (totalCount?.totalPending ?? 0),
			cancel: totalCount?.totalCanceled ?? 0,
			completed: totalCount?.totalCompleted ?? 0
		};
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
			canView = data[EntityPermission.ORDERVIEW];
			canManagePayment = !!data[EntityPermission.ORDERPAYMENTMANAGE];
			canUpdateOrder = !!data[EntityPermission.ORDERUPDATE];
		} catch (error) {
			canView = false;
			canManagePayment = false;
			canUpdateOrder = false;
		}
	}

	const handleTabButtonClick = (tabIdx: OrderStatus) => {
		return () => {
			if (activeTab === tabIdx) return;
			activeTab = tabIdx;

			currentPage = 1;
			rowsPerPage = 10;

			// reset filter option
			setDefaultOrderFilter();
			if ($oFilter.search && $oFilter.search != '') setIsClearSearchOrderFilter(true);
			setQueryParams(getDefaultParams());
		};
	};

	const shouldShowBadge = (
		currentTab: OrderStatus,
		tab: OrderStatus,
		count: number,
		showCounter: boolean = false,
		filter: OrderFilter
	): boolean => {
		if (!count) return false;

		if (filter.search || filter.createdDate || filter.payment) {
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
								{#each tabs as t}
									<ssk-tab-button
										active={activeTab === t.orderStatus}
										on:click={handleTabButtonClick(t.orderStatus)}
										data-testid={t.testIdHeader}
										size="md"
										align="left"
										color="primary"
										buttonwidth="auto"
									>
										<ssk-i18n-translate key={t.i18nHeaderKey} lang={$currentLanguage.code} />
										<ssk-badge
											hidden={!shouldShowBadge(
												activeTab,
												t.orderStatus,
												orderCounter[t.orderStatus],
												t.showCounter,
												$oFilter
											)}
											variant="subtle"
											themecolor={t.badgeColor}
											data-testid={t.testIdCounter}
										>
											{formatAbbreviatedNumber(orderCounter[t.orderStatus])}
										</ssk-badge>
									</ssk-tab-button>
								{/each}
							{/key}
						</ssk-tab-header>

						<OrderSearch oType={activeTab} />
					</div>

					{#key activeTab}
						<OrderTable bind:currentPage bind:rowsPerPage {canManagePayment} {canUpdateOrder} />
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
</style>
