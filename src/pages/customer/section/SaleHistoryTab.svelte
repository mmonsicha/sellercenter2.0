<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import {
		SaleChannelType,
		salesChannels,
		type Order,
		type TotalCount
	} from '$lib/entities/order/order';
	import { formatAbbreviatedNumber, formatPrice } from '$utils/format-number';
	import { getContext, onMount } from 'svelte';
	import { storeListOrder } from '../../../service/management-rest';
	import PaymentChannel from '$components/PaymentChannel.svelte';
	import { currentLanguage } from '$stores/i18n';
	import { getBadgeOrderStatus, getDeliveryMethod, orderDisplayStatus } from '$utils/utils-order';
	import { orderStatusI18nKey, orderDeliveryI18nKey } from '$utils/i18n-keys';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';

	export let customerId: string;
	export let storeId: string;

	const i18nStore = getContext<I18nStore>('i18n');

	let statuses: string[] = [];
	let sortDirection: 'asc' | 'desc' = 'desc';
	let orderNotFound: string = '';
	let tabLabels: string[] = [
		'patona-sellercenter-myorder-tab-all',
		'patona-sellercenter-myorder-tab-inprogress',
		'patona-sellercenter-myorder-tab-completed',
		'patona-sellercenter-myorder-tab-canceled'
	];

	let activeTabIndex = 0,
		processingTotal = 0,
		canceledTotal = 0,
		currentPage: number = 1,
		rowsPerPage: number = 10;

	let orders: Order[];
	let total: TotalCount;

	const handleTabClick = (index: number) => {
		if (activeTabIndex !== index) {
			activeTabIndex = index;
			currentPage = 1;
			rowsPerPage = 10;
		}
	};

	onMount(() => {
		if (customerId && storeId) {
			loadOrder(currentPage, rowsPerPage);
		}
	});

	$: {
		if (storeId || activeTabIndex !== undefined) {
			statuses = getStatusesByTabIndex(activeTabIndex);

			loadOrder(currentPage, rowsPerPage);
		}
	}

	function getStatusesByTabIndex(index: number): string[] {
		switch (index) {
			case 1:
				return ['pending', 'processing'];
			case 2:
				return ['completed'];
			case 3:
				return ['canceled'];
			default:
				return [];
		}
	}

	async function loadOrder(page: number, rowsPerPage: number) {
		const res = await storeListOrder(
			storeId,
			(page - 1) * rowsPerPage,
			rowsPerPage,
			sortDirection,
			'',
			statuses,
			'',
			'',
			[],
			[],
			[],
			customerId,
			'',
			'',
			[],
			[]
		);

		orders = res.data;
		total = res.total;
		processingTotal = total.totalPending + total.totalProcessing || 0;
		canceledTotal = total.totalCanceled || 0;
	}

	const handleSortChange = () => {
		sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		loadOrder(currentPage, rowsPerPage);
	};

	function onClickToViewOrder(oId?: string) {
		window.open(`/order/view/${oId}`, '_blank');
	}

	function onClickCopy(oNumber?: string) {
		navigator.clipboard.writeText(oNumber ?? '');
	}

	function handlePageChange(event: CustomEvent) {
		currentPage = event.detail.page;
	}

	function handleRowPerPageChange(event: CustomEvent) {
		rowsPerPage = event.detail.rowsPerPage;
		currentPage = 1;
	}

	const loadKeywords = async () => {
		orderNotFound = await i18nStore.get(
			'patona-sellercenter-myorder-subtitle-ordersfound',
			$currentLanguage.code,
			'default'
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

<div class="container">
	<ssk-tab-header variant="inline" size="md" align="left" buttonwidth="auto">
		{#each tabLabels as tab, index}
			<ssk-tab-button
				active={index === activeTabIndex}
				variant="inline"
				align="left"
				color="primary"
				buttonwidth="auto"
				width="auto"
				on:click={() => handleTabClick(index)}
			>
				<ssk-i18n-translate key={tab} lang={$currentLanguage.code} />

				{#if index === 1 && processingTotal != 0}
					<ssk-badge variant="subtle" themecolor="sky">
						{formatAbbreviatedNumber(processingTotal)}
					</ssk-badge>
				{/if}

				{#if index === 3 && canceledTotal != 0}
					<ssk-badge variant="subtle" themecolor="gray">
						{formatAbbreviatedNumber(canceledTotal)}
					</ssk-badge>
				{/if}
			</ssk-tab-button>
		{/each}
	</ssk-tab-header>
	{#key activeTabIndex}
		<ssk-dynamic-table
			height="100%"
			columnsWidth={['260px', 'auto', 'auto', 'auto', 'auto', 'auto']}
		>
			<ssk-header-cell slot="headers" align="left">
				<ssk-i18n-translate
					key="patona-sellercenter-myorder-table-header-salesorder"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-header-cell>
			<ssk-header-cell slot="headers" align="left">
				<ssk-i18n-translate
					key="patona-sellercenter-myorder-table-header-saleschannel"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-header-cell>
			<ssk-header-cell slot="headers" align="left">
				<ssk-i18n-translate
					key="patona-sellercenter-myorder-table-header-totalamount"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-header-cell>
			<ssk-header-cell slot="headers" align="left">
				<ssk-i18n-translate
					key="patona-sellercenter-myorder-table-header-paymentstatus"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-header-cell>
			<ssk-header-cell
				slot="headers"
				align="left"
				sortable
				{sortDirection}
				on:sort-changed={handleSortChange}
			>
				<ssk-i18n-translate
					key="patona-sellercenter-myorder-table-header-createddate"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-header-cell>
			<ssk-header-cell slot="headers" align="left">
				<ssk-i18n-translate
					key="patona-sellercenter-myorder-table-header-orderstatus"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-header-cell>

			{#if total && total.total}
				{#each orders as order, idx}
					<ssk-table-cell align="left">
						<div class="order-serial" on:click={() => onClickToViewOrder(order.orderId)}>
							<ssk-text color="currentcolor">{order.orderSerial}</ssk-text>
						</div>
						<div class="copy-container" on:click={() => onClickCopy(order.orderSerial)}>
							<ssk-icon name="outline-clipboard-document" themecolor="primary" size="lg"></ssk-icon>
						</div>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<div>
							<ssk-text color="stroke">
								{#if order.saleChannel && order.saleChannel.type === SaleChannelType.Offline}
									{@const deliveryKey = orderDeliveryI18nKey(order.saleChannel?.saleOrigin)}
									{#if deliveryKey}
										<ssk-i18n-translate
											key={deliveryKey}
											lang={$currentLanguage.code}
											fallbackLang="default"
										/>
									{/if}
								{:else}
									{salesChannels.find((s) => s.value === order.saleChannel?.saleOrigin)?.label ??
										'-'}
								{/if}
							</ssk-text>
							{#if order.saleChannel && order.saleChannel.type === SaleChannelType.Online}
								<ssk-text
									size="xs"
									color="stroke"
									data-testid={`orders.table-cell.sales-chanel.row.${idx}`}
								>
									{getDeliveryMethod(order)?.label ?? '-'}
								</ssk-text>
							{/if}
						</div>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<div class="total-container">
							<ssk-text color="stroke">฿</ssk-text>
							<ssk-text size="md" color="gray.800">
								{formatPrice(
									(order.buyerStatement.netPrice ?? 0) + (order.deliveries?.[0]?.shippingFee ?? 0)
								)}
							</ssk-text>
						</div>
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<PaymentChannel {order} />
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-date-display date={order.createdAt} />
					</ssk-table-cell>
					<ssk-table-cell align="left">
						<ssk-badge variant="subtle" size="md" themecolor={getBadgeOrderStatus(orderDisplayStatus(order))}>
							<ssk-i18n-translate
								key={orderStatusI18nKey(orderDisplayStatus(order))}
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-badge>
					</ssk-table-cell>
				{/each}
				<ssk-pagination
					slot="footer"
					showrowsperpage
					showBtnPage
					dropdownAnchor="top"
					{currentPage}
					totalpages={Math.ceil(total.total / rowsPerPage)}
					{rowsPerPage}
					pageSize={rowsPerPage}
					on:page-changed={handlePageChange}
					on:rows-per-page-changed={handleRowPerPageChange}
				></ssk-pagination>
			{:else}
				<div slot="placeholder">
					<BlankPage description={orderNotFound} />
				</div>
			{/if}
		</ssk-dynamic-table>
	{/key}
</div>

<style lang="css">
	.container {
		width: 100%;
		height: 100%;

		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}

	.total-container {
		display: flex;
		gap: 0.2rem;
	}
	ssk-dynamic-table {
		--table-border-color: var(--ssk-colors-gray-200);
		color: var(--ssk-colors-gray-500);
	}

	ssk-header-cell {
		z-index: 1;
		white-space: nowrap;
		position: inherit;
	}

	ssk-table-cell {
		width: 100%;
	}

	.copy-container {
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.order-serial {
		cursor: pointer;
		color: var(--ssk-colors-black-900);
	}
	.order-serial:hover {
		color: var(--ssk-colors-primary-500);
	}
</style>
