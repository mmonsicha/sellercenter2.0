<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';

	import {
		oFilter,
		resetFilterOptions,
		setIsClearSearchOrderFilter,
		setSorting,
		type Sort
	} from '$stores/order/filter';
	import { oms2OrderList } from '$stores/order/oms2-order-list';
	import { formatPrice } from '$utils/format-number';
	import { currentLanguage } from '$stores/i18n';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { navigate, useLocation } from 'svelte-routing';
	import {
		Oms2RowAction,
		StockState,
		type Oms2OrderRow
	} from '$lib/entities/order/oms2-order-list';
	import {
		CHANNEL_GROUP_ICON,
		channelColor,
		fulfillmentBadges,
		stockKey,
		stockTheme,
		orderStatusKey,
		orderStatusTheme,
		paymentStatusKey,
		paymentStatusTheme,
		rowActionKey
	} from '../order-tab';

	const i18nStore = getContext<I18nStore>('i18n');
	const location = useLocation();

	export let currentPage: number;
	export let rowsPerPage: number;

	export let canManagePayment = false;
	export let canUpdateOrder = false; // kept for API parity; no Deliver action in OMS 2.0
	export let onRetry: () => void = () => {};

	const SKELETON_ROWS = 8;
	$: hasActiveFilter = !!$oFilter.search || $oFilter.total > 0;

	function clearAllFilters() {
		resetFilterOptions();
		if ($oFilter.search) setIsClearSearchOrderFilter(true);
	}

	let sortDirection: Sort = 'desc';
	let totalpages = 1;
	let orderNotFound = '';

	let expanded: Record<string, boolean> = {};
	// Per-row "+N" fulfillment disclosure (tap to expand / collapse).
	let fulfillOpen: Record<string, boolean> = {};
	const toggleFulfill = (key: string) =>
		(fulfillOpen = { ...fulfillOpen, [key]: !fulfillOpen[key] });

	// Shared with the nested expanded-payment table so its columns align under the parent's.
	// expand | serial | customer | channel | fulfillment | total | payment | stock | created | status | action
	// Fixed minimums so badges never wrap mid-word; the wrapper scrolls on narrow screens.
	const COLS = [
		'48px',
		'minmax(170px, 1fr)', // serial — smaller text now
		'minmax(140px, 1fr)',
		'minmax(190px, 1fr)', // channel badge, one line (e.g. "LINE SHOPPING")
		'minmax(270px, 1fr)', // fulfillment pills + toggle (longest: จัดส่งเข้าระบบ (ดิจิทัล))
		'minmax(120px, 1fr)',
		'minmax(190px, 1fr)', // payment badge, one line (e.g. "รอเก็บเงินปลายทาง")
		'minmax(140px, 1fr)', // stock badge
		'minmax(130px, 1fr)',
		'minmax(150px, 1fr)',
		'minmax(150px, 1fr)'
	];

	$: if ($oFilter) sortDirection = $oFilter.sort ?? 'desc';

	$: totalpages = Math.max(1, Math.ceil($oms2OrderList.total / rowsPerPage));

	function handleSortChange(event: CustomEvent) {
		sortDirection = event.detail.sortDirection;
		setSorting(sortDirection);
	}

	function handlePageChange(event: CustomEvent) {
		currentPage = event.detail.page;
		expanded = {}; // collapse all when navigating to another page
		fulfillOpen = {};
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

	// Actions come from the BE (mocked). Everything but View needs payment.manage.
	const primaryAction = (o: Oms2OrderRow): Oms2RowAction => o.actions[0] ?? Oms2RowAction.View;
	const isBlocked = (a: Oms2RowAction) => a !== Oms2RowAction.View && !canManagePayment;

	// API bypassed: payment/COD/slip modals need the full Order entity, which the mock
	// list row doesn't carry. Until the real API lands every action opens the detail page.
	function handleRowAction(order: Oms2OrderRow) {
		onClickToViewOrder(order.id);
	}
</script>

{#if $oms2OrderList.loading}
	<!-- Skeleton keeps the table's footprint so the page doesn't jump when data lands -->
	<div class="state skeleton" aria-busy="true" data-testid="orders.table.skeleton">
		{#each Array(SKELETON_ROWS) as _, i (i)}
			<div class="skeleton-row">
				<ssk-skeleton size="sm" width="24px"></ssk-skeleton>
				<ssk-skeleton size="sm" width="140px"></ssk-skeleton>
				<ssk-skeleton size="sm" width="120px"></ssk-skeleton>
				<ssk-skeleton size="sm" width="90px"></ssk-skeleton>
				<ssk-skeleton size="sm" width="110px"></ssk-skeleton>
				<ssk-skeleton size="sm" width="70px"></ssk-skeleton>
				<ssk-skeleton size="sm" width="100px"></ssk-skeleton>
				<ssk-skeleton size="sm" width="90px"></ssk-skeleton>
			</div>
		{/each}
	</div>
{:else if $oms2OrderList.error}
	<div class="state message" role="alert" data-testid="orders.table.error">
		<ssk-icon name="outline-exclamation-circle" themecolor="error" size="xl"></ssk-icon>
		<ssk-text size="lg" color="gray.800" fontweight="medium">
			<ssk-i18n-translate
				key="oms.order.state.error_title"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<ssk-text size="sm" color="gray.500">
			<ssk-i18n-translate
				key="oms.order.state.error_desc"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<ssk-button
			variant="outline"
			size="sm"
			themeColor="primary"
			on:click={onRetry}
			data-testid="orders.table.retry"
		>
			<ssk-i18n-translate
				key="oms.order.state.retry"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	</div>
{:else if !$oms2OrderList.total && hasActiveFilter}
	<div class="state message" data-testid="orders.table.no-match">
		<ssk-icon name="outline-funnel" themecolor="gray" size="xl"></ssk-icon>
		<ssk-text size="lg" color="gray.800" fontweight="medium">
			<ssk-i18n-translate
				key="oms.order.state.no_match_title"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<ssk-text size="sm" color="gray.500">
			<ssk-i18n-translate
				key="oms.order.state.no_match_desc"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<ssk-button
			variant="outline"
			size="sm"
			themeColor="primary"
			on:click={clearAllFilters}
			data-testid="orders.table.clear-filters"
		>
			<ssk-i18n-translate
				key="patona-sellercenter-myorder-button-clearall"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	</div>
{:else if !$oms2OrderList.total}
	<div class="state" data-testid="orders.table.empty">
		<BlankPage description={orderNotFound} height="60dvh" />
	</div>
{:else}
	<!-- Horizontal scroll on tablet/mobile instead of crushing 11 columns -->
	<div class="table-scroll">
		<ssk-dynamic-table height="100%" columnsWidth={COLS}>
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
			<ssk-header-cell slot="headers" align="left" data-testid="orders.table-header.fulfillment">
				<ssk-i18n-translate
					key="oms.order.header.fulfillment"
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
			<ssk-header-cell slot="headers" align="left" data-testid="orders.table-header.stock">
				<ssk-i18n-translate
					key="oms.order.header.stock"
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

			{#each $oms2OrderList.rows as order, idx (order.id)}
				{@const rowKey = order.id}
				{@const action = primaryAction(order)}
				{@const fBadges = fulfillmentBadges(order.fulfillment)}
				{@const fOpen = !!fulfillOpen[rowKey]}
				<ssk-table-cell align="left">
					{#if order.payments.length > 0}
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
						on:click={() => onClickToViewOrder(order.id)}
						data-testid={`orders.table-cell.order-number.row.${idx}`}
					>
						<ssk-text size="sm" color="currentcolor">{order.serial}</ssk-text>
					</div>
					<div
						class="copy-container"
						on:click={() => onClickCopy(order.serial)}
						data-testid={`orders.table-cell.copy.row.${idx}`}
					>
						<ssk-icon name="outline-clipboard-document" themecolor="primary" size="lg"></ssk-icon>
					</div>
				</ssk-table-cell>

				<!-- Customer name -->
				<ssk-table-cell align="left" data-testid={`orders.table-cell.customer-name.row.${idx}`}>
					<ssk-text color="stroke">{order.customerName}</ssk-text>
				</ssk-table-cell>

				<!-- Sales channel — same pill as fulfillment, tinted with the channel's colour
				     (brand colour for online sub-channels). Name always from data. -->
				<ssk-table-cell align="left">
					<span
						class="channel-pill"
						style={`--ch: ${channelColor(order.channel)}`}
						data-testid={`orders.table-cell.sales-chanel.row.${idx}`}
					>
						<span class="channel-dot">
							{#if order.channel.logo}
								<img class="channel-logo" src={order.channel.logo} alt="" width="14" height="14" />
							{:else}
								<ssk-icon
									name={CHANNEL_GROUP_ICON[order.channel.group]}
									size="xs"
									color="currentcolor"
								></ssk-icon>
							{/if}
						</span>
						<ssk-text size="sm" color="gray.800" fontweight="medium">{order.channel.name}</ssk-text>
					</span>
				</ssk-table-cell>

				<!-- Fulfillment — single type / หลายวิธี (N) / จัดส่งตามที่อยู่ (N กลุ่ม) -->
				<!-- Pill style (like role badges): collapsed = one pill with stacked method icons
				     + "หลายวิธี (N)"; round button beside it expands one pill per method. Tap only. -->
				<ssk-table-cell align="left" data-testid={`orders.table-cell.fulfillment.row.${idx}`}>
					{#if fBadges.length === 0}
						<ssk-text color="stroke">—</ssk-text>
					{:else}
						<div class="fulfill-wrap" class:open={fOpen}>
							{#if fBadges.length > 1 && !fOpen}
								<span class="fulfill-pill" data-testid={`orders.fulfillment-summary.row.${idx}`}>
									<span class="icon-stack">
										{#each fBadges as b (b.type)}
											<span class="icon-dot"
												><ssk-icon name={b.icon} size="xs" color="gray.700"></ssk-icon></span
											>
										{/each}
									</span>
									<ssk-text size="sm" color="gray.800" fontweight="medium">
										<ssk-i18n-translate
											key="oms.order.fulfillment.multi"
											lang={$currentLanguage.code}
											fallbackLang="default"
										/>
										({fBadges.length})
									</ssk-text>
								</span>
							{:else}
								<div class="fulfill-pills">
									{#each fBadges as b (b.type)}
										<span
											class="fulfill-pill"
											data-testid={`orders.fulfillment-badge.row.${idx}.${b.type}`}
										>
											<span class="icon-dot"
												><ssk-icon name={b.icon} size="xs" color="gray.700"></ssk-icon></span
											>
											<ssk-text size="sm" color="gray.800" fontweight="medium">
												<ssk-i18n-translate
													key={b.key}
													lang={$currentLanguage.code}
													fallbackLang="default"
												/>
												{#if b.groups}
													({b.groups}&nbsp;<ssk-i18n-translate
														key="oms.order.fulfillment.groups_unit"
														lang={$currentLanguage.code}
														fallbackLang="default"
													/>)
												{/if}
											</ssk-text>
										</span>
									{/each}
								</div>
							{/if}
							{#if fBadges.length > 1}
								<button
									type="button"
									class="fulfill-toggle"
									aria-expanded={fOpen}
									aria-label={fOpen
										? 'ย่อวิธีรับสินค้า'
										: `ดูวิธีรับสินค้าทั้ง ${fBadges.length} วิธี`}
									on:click={() => toggleFulfill(rowKey)}
									data-testid={`orders.fulfillment-toggle.row.${idx}`}
								>
									<ssk-icon
										name={fOpen ? 'outline-eye-slash' : 'outline-eye'}
										size="sm"
										color="gray.600"
									></ssk-icon>
								</button>
							{/if}
						</div>
					{/if}
				</ssk-table-cell>

				<!-- Total price -->
				<ssk-table-cell align="left">
					<div class="total-container">
						<ssk-text color="stroke">฿</ssk-text>
						<ssk-text
							size="md"
							color="gray.800"
							data-testid={`orders.table-cell.total-price.row.${idx}`}
							>{formatPrice(order.total)}</ssk-text
						>
					</div>
				</ssk-table-cell>

				<!-- Payment status -->
				<ssk-table-cell align="left">
					<ssk-badge
						variant="subtle"
						size="md"
						themecolor={paymentStatusTheme(order.paymentStatus)}
						data-testid={`orders.table-cell.payment-status.row.${idx}`}
					>
						<ssk-i18n-translate
							key={paymentStatusKey(order.paymentStatus)}
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-badge>
				</ssk-table-cell>

				<!-- Stock -->
				<ssk-table-cell align="left" data-testid={`orders.table-cell.stock.row.${idx}`}>
					{#if order.stock === StockState.None}
						<ssk-text color="stroke">—</ssk-text>
					{:else}
						<ssk-badge variant="subtle" size="md" themecolor={stockTheme(order.stock)}>
							<ssk-i18n-translate
								key={stockKey(order.stock)}
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-badge>
					{/if}
				</ssk-table-cell>

				<!-- Date created -->
				<ssk-table-cell align="left">
					<ssk-date-display
						date={order.createdAt}
						data-testid={`orders.table-cell.date-created.row.${idx}`}
					/>
				</ssk-table-cell>

				<!-- Order status — straight from data -->
				<ssk-table-cell align="left">
					<ssk-badge
						variant="subtle"
						size="md"
						themecolor={orderStatusTheme(order.status)}
						data-testid={`orders.table-cell.order-status.row.${idx}`}
					>
						<ssk-i18n-translate
							key={orderStatusKey(order.status)}
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-badge>
				</ssk-table-cell>

				<!-- Action cell -->
				<ssk-table-cell align="left">
					{#if isBlocked(action)}
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
									key={rowActionKey(action)}
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
								key={rowActionKey(action)}
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
							{#each order.payments as p, pIdx (p.id)}
								<ssk-table-cell align="left"></ssk-table-cell>
								<ssk-table-cell align="left"></ssk-table-cell>
								<ssk-table-cell align="left"></ssk-table-cell>
								<ssk-table-cell align="left"></ssk-table-cell>
								<ssk-table-cell align="left"></ssk-table-cell>
								<ssk-table-cell align="left">
									<div class="total-container">
										<ssk-text color="stroke">฿</ssk-text>
										<ssk-text size="md" color="gray.800">{formatPrice(p.amount)}</ssk-text>
									</div>
								</ssk-table-cell>
								<ssk-table-cell align="left">
									<div class="payment-status-cell">
										<ssk-badge
											variant="subtle"
											size="md"
											themecolor={paymentStatusTheme(p.status)}
											data-testid={`orders.payment-status-badge.row.${idx}.${pIdx}`}
										>
											<ssk-i18n-translate
												key={paymentStatusKey(p.status)}
												lang={$currentLanguage.code}
												fallbackLang="default"
											/>
										</ssk-badge>
										<ssk-text
											size="xs"
											color="stroke"
											data-testid={`orders.payment-method.row.${idx}.${pIdx}`}
										>
											<ssk-i18n-translate
												key={`oms.order.payment_method.${p.method}`}
												lang={$currentLanguage.code}
												fallbackLang="default"
											/>
										</ssk-text>
									</div>
								</ssk-table-cell>
								<ssk-table-cell align="left"></ssk-table-cell>
								<ssk-table-cell align="left">
									<ssk-date-display date={p.paidAt} />
								</ssk-table-cell>
								<ssk-table-cell align="left"></ssk-table-cell>
								<ssk-table-cell align="left"></ssk-table-cell>
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
		</ssk-dynamic-table>
	</div>
{/if}

<style lang="css">
	/* width:0 + min-width:100% stops the wide table from stretching the page card;
	   only this wrapper scrolls sideways. */
	.table-scroll {
		width: 0;
		min-width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.table-scroll > ssk-dynamic-table {
		display: block;
		min-width: 1700px;
	}

	/* ssk-badge sets white-space:normal inside its shadow root, so nowrap on the host is
	   overridden — apply it to the slotted content instead (one line, never wraps). */
	ssk-badge,
	ssk-badge > :global(*) {
		white-space: nowrap;
	}

	/* Fulfillment pills — same language as the role badges in user management:
	   outlined pill, circular icon(s) on the left, round action button beside it. */
	/* Channel pill: same shape as .fulfill-pill, tinted by --ch (set per row). */
	.channel-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 12px 3px 4px;
		border: 1px solid color-mix(in srgb, var(--ch) 45%, white);
		border-radius: 999px;
		background: color-mix(in srgb, var(--ch) 8%, white);
		white-space: nowrap;
	}
	.channel-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--ssk-colors-white, #fff);
		color: var(--ch);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ch) 30%, white);
	}
	.channel-logo {
		width: 14px;
		height: 14px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.fulfill-wrap {
		display: flex;
		align-items: center;
		gap: var(--spacing-2, 8px);
	}
	.fulfill-wrap.open {
		align-items: flex-end;
	}

	.fulfill-pills {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-1, 4px);
	}

	.fulfill-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 12px 3px 4px;
		border: 1px solid var(--ssk-colors-gray-300);
		border-radius: 999px;
		background: var(--ssk-colors-white, #fff);
		white-space: nowrap;
	}

	.icon-stack {
		display: inline-flex;
	}
	.icon-stack .icon-dot + .icon-dot {
		margin-left: -8px; /* overlap like an avatar stack */
	}

	.icon-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--ssk-colors-gray-100);
		box-shadow: 0 0 0 2px var(--ssk-colors-white, #fff);
	}

	/* Round icon button, 32px min touch target */
	.fulfill-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid var(--ssk-colors-gray-300);
		border-radius: 50%;
		background: var(--ssk-colors-white, #fff);
		cursor: pointer;
	}
	.fulfill-toggle[aria-expanded='true'] {
		border-color: var(--ssk-colors-primary-300);
		background: var(--ssk-colors-primary-50);
	}
	.fulfill-toggle:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-400);
		outline-offset: 2px;
	}

	.state {
		border-top: 1px solid var(--ssk-colors-gray-200);
	}

	.state.message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-2, 8px);
		min-height: 40dvh;
		padding: var(--spacing-6, 24px) var(--spacing-4, 16px);
		text-align: center;
	}

	.state.message ssk-button {
		margin-top: var(--spacing-2, 8px);
	}

	.skeleton-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-6, 24px);
		padding: var(--spacing-4, 16px) var(--spacing-6, 24px);
		border-bottom: 1px solid var(--ssk-colors-gray-100);
		overflow: hidden;
	}

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

	.chevron,
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
