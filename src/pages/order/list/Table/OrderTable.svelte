<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';

	import { oFilter, setSorting, type Sort } from '$stores/order/filter';
	import { orderList } from '$stores/order/order';
	import { formatPrice } from '$utils/format-number';

	import PaymentChannel from '$components/PaymentChannel.svelte';
	import { currentLanguage } from '$stores/i18n';
	import {
		getBadgeOrderStatus,
		deliveryMethodLabel,
		getOrderRowAction,
		orderDisplayStatus,
		OrderRowActionKind,
		slipStatusTheme,
		totalShippingFee
	} from '$utils/utils-order';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { SaleChannelType, salesChannels, type Order } from '$lib/entities/order/order';
	import { PaymentMethod } from '$lib/entities/payment/payment-method';
	import { navigate, useLocation } from 'svelte-routing';
	import { SlipPaymentState } from '$lib/entities/payment/payment-transaction';
	import {
		slipStatusI18nKey,
		paymentMethodI18nKey,
		orderStatusI18nKey,
		orderDeliveryI18nKey
	} from '$utils/i18n-keys';
	import { toPaymentTransaction } from '$service/payment-adapter';
	import { withCompanyRef } from '$utils/file-url';
	import { openSlipModal, SlipModalType, SlipModalMode } from '$stores/order/slip-modals';
	import { currentCompany } from '$stores/company/current-company';
	import { tryOpenRecordPaymentModal } from '$stores/payment/payment-transaction';
	import { openDeliverModal } from '$stores/order/deliver-modal';

	const i18nStore = getContext<I18nStore>('i18n');
	const location = useLocation();

	export let currentPage: number;
	export let rowsPerPage: number;

	export let canManagePayment = false;
	export let canUpdateOrder = false;

	let sortDirection: Sort = 'desc';
	let totalpages = 1;
	let orderNotFound = '';

	let expanded: Record<string, boolean> = {};

	// Shared with the nested expanded-payment table so its columns align under the parent's.
	const COLS = ['48px', '260px', '1.2fr', '1.4fr', '1fr', '1.4fr', '1.1fr', '1.4fr', '1fr'];

	$: if ($oFilter) sortDirection = $oFilter.sort ?? 'desc';

	$: totalpages = Math.ceil($orderList.totalCount?.total! / rowsPerPage);

	function handleSortChange(event: CustomEvent) {
		sortDirection = event.detail.sortDirection;
		setSorting(sortDirection);
	}

	function handlePageChange(event: CustomEvent) {
		currentPage = event.detail.page;
		expanded = {}; // collapse all when navigating to another page
	}

	function handleRowPerPageChange(event: CustomEvent) {
		rowsPerPage = event.detail.rowsPerPage;
		currentPage = 1;
		expanded = {};
	}

	function onClickCopy(oNumber?: string) {
		navigator.clipboard.writeText(oNumber ?? '');
	}

	function onClickToViewOrder(oId?: string) {
		const encodeBackTo = encodeURIComponent(`${$location.pathname}?${$location.search.toString()}`);
		navigate(`/order/view/${oId}?back_to=${encodeBackTo}`);
	}

	const toggleExpand = (key: string) => (expanded = { ...expanded, [key]: !expanded[key] });

	const txnOf = (order: Order) => toPaymentTransaction(order);

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

	async function handleRowAction(order: Order) {
		const action = getOrderRowAction(order);
		switch (action.kind) {
			case OrderRowActionKind.Pay:
			case OrderRowActionKind.PayMore: {
				// false = legacy order (no SukiPay transaction) → fall back to detail page.
				const handled = await tryOpenRecordPaymentModal(order);
				if (!handled) onClickToViewOrder(order.orderId);
				return;
			}
			case OrderRowActionKind.Deliver:
				openDeliverModal(order);
				return;
			default:
				onClickToViewOrder(order.orderId);
		}
	}
</script>

<ssk-dynamic-table height="100%" columnsWidth={COLS}>
	{#if $orderList.loading}
		<div class="table-placeholder" slot="placeholder">
			<LoadingPage description="loading" height="60dvh" />
		</div>
	{:else if $orderList.totalCount?.total}
		<ssk-header-cell slot="headers" align="left"></ssk-header-cell>
		<ssk-header-cell slot="headers" align="left" data-testid="orders.table-header.order-number">
			<ssk-i18n-translate
				key="patona-sellercenter-myorder-table-header-salesorder"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left" data-testid="orders.table-header.customer-name">
			<ssk-i18n-translate
				key="patona-sellercenter-myorder-table-header-customername"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left" data-testid="orders.table-header.sales-chanel">
			<ssk-i18n-translate
				key="patona-sellercenter-myorder-table-header-saleschannel"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left" data-testid="orders.table-header.total-price">
			<ssk-i18n-translate
				key="patona-sellercenter-myorder-table-header-totalamount"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left" data-testid="orders.table-header.payment-status">
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
			data-testid="orders.table-header.date-created"
		>
			<ssk-i18n-translate
				key="patona-sellercenter-myorder-table-header-createddate"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left" data-testid="orders.table-header.order-status">
			<ssk-i18n-translate
				key="patona-sellercenter-myorder-table-header-orderstatus"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-header-cell>
		<ssk-header-cell slot="headers" align="left"></ssk-header-cell>

		{#each $orderList.data ?? [] as order, idx (order.orderId ?? idx)}
			{@const txn = txnOf(order)}
			{@const rowKey = order.orderId ?? String(idx)}
			{@const rowAction = getOrderRowAction(order)}
			{@const actionBlocked =
				((rowAction.kind === OrderRowActionKind.Pay ||
					rowAction.kind === OrderRowActionKind.PayMore) &&
					!canManagePayment) ||
				(rowAction.kind === OrderRowActionKind.Deliver && !canUpdateOrder)}
			<ssk-table-cell align="left">
				{#if (txn?.payments?.length ?? 0) > 0}
					<div
						class="chevron"
						on:click={() => toggleExpand(rowKey)}
						data-testid={`orders.table-cell.expand.row.${idx}`}
					>
						<ssk-icon
							name={expanded[rowKey] ? 'solid-chevron-up' : 'solid-chevron-down'}
							themecolor="black"
							size="lg"
						></ssk-icon>
					</div>
				{/if}
			</ssk-table-cell>

			<!-- Order serial -->
			<ssk-table-cell align="left">
				<div
					class="order-serial"
					on:click={() => onClickToViewOrder(order.orderId)}
					data-testid={`orders.table-cell.order-number.row.${idx}`}
				>
					<ssk-text color="currentcolor">{order.orderSerial}</ssk-text>
				</div>
				<div
					class="copy-container"
					on:click={() => onClickCopy(order.orderSerial)}
					data-testid={`orders.table-cell.copy.row.${idx}`}
				>
					<ssk-icon name="outline-clipboard-document" themecolor="primary" size="lg"></ssk-icon>
				</div>
			</ssk-table-cell>

			<!-- Customer name -->
			<ssk-table-cell align="left" data-testid={`orders.table-cell.customer-name.row.${idx}`}>
				<ssk-text color="stroke">{order.buyer.name} </ssk-text>
			</ssk-table-cell>

			<!-- Sales channel -->
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
							{salesChannels.find((s) => s.value === order.saleChannel?.saleOrigin)?.label ?? '-'}
						{/if}
					</ssk-text>
					{#if order.saleChannel && order.saleChannel.type === SaleChannelType.Online}
						<ssk-text
							size="xs"
							color="stroke"
							data-testid={`orders.table-cell.sales-chanel.row.${idx}`}
						>
							{deliveryMethodLabel(order)}
						</ssk-text>
					{/if}
				</div>
			</ssk-table-cell>

			<!-- Total price -->
			<ssk-table-cell align="left">
				<div class="total-container">
					<ssk-text color="stroke">฿</ssk-text>
					<ssk-text
						size="md"
						color="gray.800"
						data-testid={`orders.table-cell.total-price.row.${idx}`}
						>{formatPrice(
							(order.buyerStatement.netPrice ?? 0) + totalShippingFee(order)
						)}</ssk-text
					>
				</div>
			</ssk-table-cell>

			<!-- Payment status -->
			<ssk-table-cell align="left">
				<PaymentChannel {order} testid={`orders.table-cell.payment-status.row.${idx}`} />
			</ssk-table-cell>

			<!-- Date created -->
			<ssk-table-cell align="left">
				<ssk-date-display
					date={order.createdAt}
					data-testid={`orders.table-cell.date-created.row.${idx}`}
				/>
			</ssk-table-cell>

			<!-- Order status -->
			<ssk-table-cell align="left">
				<ssk-badge
					variant="subtle"
					size="md"
					themecolor={getBadgeOrderStatus(orderDisplayStatus(order))}
					data-testid={`orders.table-cell.order-status.row.${idx}`}
				>
					<ssk-i18n-translate
						key={orderStatusI18nKey(orderDisplayStatus(order))}
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-badge>
			</ssk-table-cell>

			<!-- Action cell -->
			<ssk-table-cell align="left">
				{#if actionBlocked}
					<!-- Pay/PayMore lacks patona.order.payment.manage, or Deliver lacks
					     patona.order.update → disabled + tooltip -->
					<ssk-tooltip size="xs" themeColor="black" hideCloseButton={true} areaPosition="130%">
						<span slot="content" class="tooltip-content">
							<ssk-text size="xs" color="white">
								<ssk-i18n-translate
									key="common.permission.access_restricted"
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-text>
						</span>
						<ssk-button
							variant="outline"
							size="sm"
							themeColor="primary"
							disabled
							data-testid={`orders.table-cell.action.row.${idx}`}
						>
							<ssk-i18n-translate
								key={rowAction.labelKey}
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-button>
					</ssk-tooltip>
				{:else}
					<ssk-button
						variant="outline"
						size="sm"
						themeColor="primary"
						on:click={() => handleRowAction(order)}
						data-testid={`orders.table-cell.action.row.${idx}`}
					>
						<ssk-i18n-translate
							key={rowAction.labelKey}
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-button>
				{/if}
			</ssk-table-cell>

			<ssk-table-row expanded={expanded[rowKey]} padding="none" borderBottom="none">
				{#if expanded[rowKey]}
					<ssk-dynamic-table
						columnsWidth={COLS}
						height="auto"
						backgroundColor="gray.50"
						data-testid={`orders.payment-dropdown.row.${idx}`}
					>
						{#each txn?.payments ?? [] as p, pIdx}
							<ssk-table-cell align="left"></ssk-table-cell>
							<ssk-table-cell align="left"></ssk-table-cell>
							<ssk-table-cell align="left"></ssk-table-cell>
							<ssk-table-cell align="left"></ssk-table-cell>

							<!-- amount col -->
							<ssk-table-cell align="left">
								<div class="total-container">
									<ssk-text color="stroke">฿</ssk-text>
									<ssk-text size="md" color="gray.800">{formatPrice(p.amount ?? 0)}</ssk-text>
								</div>
							</ssk-table-cell>

							<!-- payment status col -->
							<ssk-table-cell align="left">
								<div class="payment-status-cell">
									<ssk-badge
										variant="subtle"
										size="md"
										themecolor={slipStatusTheme(p.paymentState)}
										data-testid={`orders.payment-status-badge.row.${idx}.${pIdx}`}
									>
										{#if slipStatusI18nKey(p.paymentState)}
											<ssk-i18n-translate
												key={slipStatusI18nKey(p.paymentState)}
												lang={$currentLanguage.code}
												fallbackLang="default"
											/>
										{:else}
											-
										{/if}
									</ssk-badge>
									<ssk-text
										size="xs"
										color="stroke"
										data-testid={`orders.payment-method.row.${idx}.${pIdx}`}
									>
										<ssk-i18n-translate
											key={paymentMethodI18nKey(p.method)}
											lang={$currentLanguage.code}
											fallbackLang="default"
										/>
									</ssk-text>
								</div>
							</ssk-table-cell>

							<!-- slip thumbnail (non-cash only) — click opens slip modal read-only -->
							<ssk-table-cell align="left">
								{#if p.method !== PaymentMethod.CASH}
									<div
										class="slip-thumb"
										class:clickable={!!p.fullImageUrl}
										role={p.fullImageUrl ? 'button' : undefined}
										tabindex={p.fullImageUrl ? 0 : undefined}
										on:click={() =>
											p.fullImageUrl &&
											openSlipModal(SlipModalType.SlipReview, {
												order,
												payment: p,
												mode: SlipModalMode.View
											})}
										on:keydown={(e) => {
											if ((e.key === 'Enter' || e.key === ' ') && p.fullImageUrl) {
												e.preventDefault();
												openSlipModal(SlipModalType.SlipReview, {
													order,
													payment: p,
													mode: SlipModalMode.View
												});
											}
										}}
										data-testid={`orders.payment-slip-thumb.row.${idx}.${pIdx}`}
									>
										{#if p.thumbnailUrl}
											<ssk-image
												src={withCompanyRef(p.thumbnailUrl, $currentCompany?.id)}
												fallbackSrc="/images/default-image.png"
												width="40px"
												height="40px"
												objectFit="cover"
												rounded="sm"
											></ssk-image>
										{:else}
											<ssk-image
												src="/images/default-image.png"
												fallbackSrc="/images/default-image.png"
												width="40px"
												height="40px"
												objectFit="cover"
												rounded="sm"
											></ssk-image>
										{/if}
									</div>
								{/if}
							</ssk-table-cell>
							<ssk-table-cell align="left"></ssk-table-cell>

							<ssk-table-cell align="left">
								{#if p.paymentState === SlipPaymentState.UNDER_REVIEW}
									{#if canManagePayment}
										<ssk-button
											variant="outline"
											size="sm"
											themeColor="primary"
											on:click={() =>
												openSlipModal(SlipModalType.SlipReview, { order, payment: p })}
											data-testid={`orders.payment-action.row.${idx}.${pIdx}`}
										>
											<ssk-i18n-translate
												key="order.payment.review_btn"
												lang={$currentLanguage.code}
												fallbackLang="default"
											/>
										</ssk-button>
									{:else}
										<!-- no patona.order.payment.manage → disabled + tooltip -->
										<ssk-tooltip
											size="xs"
											themeColor="black"
											hideCloseButton={true}
											areaPosition="130%"
										>
											<span slot="content" class="tooltip-content">
												<ssk-text size="xs" color="white">
													<ssk-i18n-translate
														key="common.permission.access_restricted"
														lang={$currentLanguage.code}
														fallbackLang="default"
													/>
												</ssk-text>
											</span>
											<ssk-button
												variant="outline"
												size="sm"
												themeColor="primary"
												disabled
												data-testid={`orders.payment-action.row.${idx}.${pIdx}`}
											>
												<ssk-i18n-translate
													key="order.payment.review_btn"
													lang={$currentLanguage.code}
													fallbackLang="default"
												/>
											</ssk-button>
										</ssk-tooltip>
									{/if}
								{/if}
							</ssk-table-cell>
						{/each}
					</ssk-dynamic-table>
				{/if}
			</ssk-table-row>
		{/each}

		<div class="divider" slot="footer" />
		<ssk-pagination
			slot="footer"
			showrowsperpage
			showBtnPage
			showGoToPage
			dropdownAnchor="top"
			data-testid="orders.pagination"
			{currentPage}
			{totalpages}
			{rowsPerPage}
			pageSize={rowsPerPage}
			on:page-changed={handlePageChange}
			on:rows-per-page-changed={handleRowPerPageChange}
		></ssk-pagination>
	{:else}
		<div class="table-placeholder" slot="placeholder">
			<BlankPage description={orderNotFound} height="60dvh" />
		</div>
	{/if}
</ssk-dynamic-table>

<style lang="css">
	ssk-dynamic-table {
		--table-border-color: var(--ssk-colors-gray-200);
		color: var(--ssk-colors-gray-500);
		border-bottom-left-radius: 8px;
		border-bottom-right-radius: 8px;
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

	.total-container {
		display: flex;
		gap: 0.2rem;
	}

	.divider {
		border-bottom: 1px solid var(--ssk-colors-gray-200);
	}

	.order-serial {
		cursor: pointer;
		color: var(--ssk-colors-black-900);
	}
	.order-serial:hover {
		color: var(--ssk-colors-primary-500);
	}

	.payment-status-cell {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: flex-start;
	}

	.slip-thumb.clickable {
		cursor: pointer;
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
</style>
