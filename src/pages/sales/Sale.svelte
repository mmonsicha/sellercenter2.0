<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';
	import PermissionDenied from '$components/PermissionDenied.svelte';
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import { ErrorCode } from '$lib/entities/error/error';
	import { FullfilmentType } from '$lib/entities/order/order';
	import { makeOrderReceiptData } from '$lib/paper-template/template-handler';
	import { AddCartItem, UpdateCartItem } from '$stores/cart/cart';
	import { cartItemInfo, currentCartId } from '$stores/cart/cart-item';
	import { currentCompany } from '$stores/company/current-company';
	import { configurationStore } from '$stores/configuration';
	import { currentLanguage } from '$stores/i18n';
	import { getOrder, orderData } from '$stores/order/order';
	import { paymentInfo, showPaymentModal } from '$stores/payment';
	import {
		loadSales,
		mappingTabsTitle,
		resetSalesProductList,
		salesProductList,
		search
	} from '$stores/sales/sales';
	import { currentStore } from '$stores/store/current-store';
	import {
		printerConfig,
		refreshPairedPrintersStatus,
		thermalPrinterPrint
	} from '$stores/thermal-printer';
	import { selectedProductInfo, setVariantValue } from '$stores/variant/variant';
	import {
		isUpdate,
		setIsUpdate,
		showAddVariantModal,
		showEditVariantModal,
		toggleAddVariantModal,
		toggleEditVariantModal
	} from '$stores/variant/variant-handler-modal';
	import { validationSchema as validatePaymentForm } from '$utils/form-validation/payment-form';
	import { formatPriceWithBath } from '$utils/format-number';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext, onDestroy } from 'svelte';
	import { useLocation } from 'svelte-routing';
	import { getCustomerById, updateCustomerWithAccess } from '../../service/customer-book-v2-rest';
	import Cart from './cart/Cart.svelte';
	import CartOrder from './cart/CartOrder.svelte';
	import SaleList from './SaleList.svelte';
	import ProductStackCard from './variant/ProductStackCard.svelte';
	import Variant from './variant/Variant.svelte';
	import PaymentSuccessModal from './modals/PaymentSuccessModal.svelte';
	import PaymentSelectedMethodModal from './modals/SelectedPaymentMethodModal.svelte';
	import SimplifiedPaymentSuccessModal from './modals/SimplifiedPaymentSuccessModal.svelte';
	import OrderPaymentModal from './modals/OrderPaymentModal.svelte';
	import NoPaymentChannelModal from './modals/NoPaymentChannelModal.svelte';
	import SettingsPrinterDetail from './modals/SettingsPrinterDetailModal.svelte';
	import { openModal } from '$stores/sales/modals';
	import { getSelectedPrinter } from '$stores/sales/selected-printer';
	import Order from '$pages/order/view/Order.svelte';
	import { AxiosError } from 'axios';
	import { debounced } from '$utils/debounce';
	import { checkPermissionsEach } from '$utils/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';

	const i18nStore = getContext<I18nStore>('i18n');
	const location = useLocation();
	const GRID_COLUMNS_KEY = 'pos.grid.columns';
	const gridColumnOptions = [3, 4, 5] as const;

	function loadGridColumns(): 3 | 4 | 5 {
		try {
			const stored = Number(localStorage.getItem(GRID_COLUMNS_KEY));
			if (gridColumnOptions.includes(stored as 3 | 4 | 5)) return stored as 3 | 4 | 5;
		} catch {
			// ignore storage access errors (private mode, etc.)
		}
		return 3;
	}

	function setGridColumns(n: 3 | 4 | 5) {
		gridColumns = n;
		try {
			localStorage.setItem(GRID_COLUMNS_KEY, String(n));
		} catch {
			// ignore storage access errors (private mode, etc.)
		}
	}

	let gridColumns: 3 | 4 | 5 = loadGridColumns();
	let tabLabels: string[] = [];
	let typeProduct: string = '';
	let activeTabIndex = 0;
	let keyword: string;
	let qty: number = 0;
	let currentCompanyId: string = $configurationStore.data?.user?.selectedCompanyId;
	let currentStoreId: string = $configurationStore.data?.user?.selectedStoreId;
	var _okText: string = 'patona-sellercenter-sales-modal-edit-button-updateitem';
	let isPaymentValid: boolean = false;
	let phdSearch = '';
	let productNotFound = '';
	let fullfilmentType: string = FullfilmentType.PickupImmediate;
	let isForbidden = false;
	let loadPromise: Promise<void> | null = null;
	let lastLoadKey = '';
	let canView = false;
	let canManagePayment = false;

	const unsubscribeCompany = currentCompany.subscribe((c) => {
		if (c?.id) {
			currentCompanyId = c.id;
			typeProduct = '';
		}
	});

	const unsubscribeStore = currentStore.subscribe((s) => {
		if (s?.id) {
			currentStoreId = s.id;
			activeTabIndex = 0;
			typeProduct = '';
		}
	});

	const loadMore = () => {
		// Combine result data only loadMore
		const isCombine: boolean = true;
		void runSearch(typeProduct, keyword, isCombine);
	};

	function setScrollToTop() {
		const cardScroll = document.querySelectorAll('.card-scroll')[activeTabIndex];
		if (cardScroll) {
			cardScroll.scrollTo({ top: 0, behavior: 'auto' });
		}
	}

	function setSales(isTabs: boolean = false) {
		keyword = '';
		void runLoadSales(typeProduct, isTabs);
	}

	const onSearchInputChange = async (e: Event) => {
		keyword = (e.target as HTMLInputElement).value.trim();
		debouncedSearch(typeProduct, keyword);
		setScrollToTop();
	};

	const handleTabClick = (e: any) => {
		const { index } = e.detail;
		activeTabIndex = index;
		const selectedType: string = mappingTabsTitle[index].value;

		if (typeProduct != selectedType) {
			typeProduct = selectedType;
			setSales(true);
			setScrollToTop();
		}
	};

	const debouncedSearch = debounced((type: string, newKeyword: string) => {
		void runSearch(type, newKeyword);
	}, 1000);

	const handlePermissionError = (error: unknown): boolean => {
		if (error instanceof AxiosError) {
			const errorCode = error.response?.data?.error;
			if (errorCode === ErrorCode.PermissionDenied) {
				isForbidden = true;
				return true;
			}
		}

		return false;
	};

	const loadInitialSales = async () => {
		isForbidden = false;
		await checkPermission();
		if (!canView) return;
		await runLoadSales(typeProduct);
	};

	const runLoadSales = async (type: string, isTabs: boolean = false) => {
		isForbidden = false;
		if (!canView) return;
		try {
			await loadSales(type, isTabs);
		} catch (error) {
			handlePermissionError(error);
		}
	};

	const runSearch = async (type: string, newKeyword: string, isCombine: boolean = false) => {
		isForbidden = false;
		if (!canView) return;
		try {
			await search(type, newKeyword, isCombine);
		} catch (error) {
			handlePermissionError(error);
		}
	};

	function _onOk() {
		if ($showAddVariantModal) return addProductWithOptionsToCart();
		if ($showEditVariantModal) return editProductWithOptionsToCart();
	}

	function _onCancel() {
		if ($showAddVariantModal) {
			toggleAddVariantModal($showAddVariantModal);
			return;
		}

		if ($showEditVariantModal) {
			setIsUpdate(false);
			setVariantValue([]);
			toggleEditVariantModal($showEditVariantModal);
			return;
		}
	}

	function addProductWithOptionsToCart() {
		AddCartItem($cartItemInfo);
		toggleAddVariantModal($showAddVariantModal);
	}

	function editProductWithOptionsToCart() {
		setVariantValue([]);
		setIsUpdate(false);
		UpdateCartItem($currentCartId, $cartItemInfo);
		toggleEditVariantModal($showEditVariantModal);
	}

	async function createAndGetOrder() {
		await getOrder($currentStore.id!, $orderData.orderId!);

		if ($orderData.buyer.refId) {
			const customer = await getCustomerById(
				$orderData.buyer.refId,
				`sellsuki.company:${$currentCompany.id}`
			);

			customer.orderList = customer.orderList ?? [];
			customer.latestOrder = $orderData.createdAt ? new Date($orderData.createdAt) : undefined;

			if (!customer.orderList.includes($orderData.orderId!)) {
				customer.orderList.push($orderData.orderId!);
			}

			await updateCustomerWithAccess(customer);
		}
	}

	async function printOrderReceipt() {
		// refresh printer state
		await refreshPairedPrintersStatus($printerConfig.pairedPrinters);

		if ($orderData) {
			const email = $currentCompany.email ? $currentCompany.email : undefined;
			const logo = $currentCompany.logo ? $currentCompany.logo : undefined;
			const storeCode = !$currentStore.isSystemCode ? $currentStore.code : undefined;

			const oReceipt = makeOrderReceiptData($orderData, email, logo, storeCode);

			const defaultPrinter = getSelectedPrinter();
			if (defaultPrinter?.online) {
				await thermalPrinterPrint<Order[]>(defaultPrinter, [oReceipt]);
			} else {
				openModal('simplified-payment-success');
			}
		}
	}

	async function checkPermission() {
		if (!$currentStore?.id) {
			canView = false;
			canManagePayment = false;
			return;
		}
		await waitForDialogPermissionReady(currentCompanyId);
		try {
			const data = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
				EntityPermission.ORDERCREATE,
				EntityPermission.ORDERPAYMENTMANAGE
			]);
			canView = data[EntityPermission.ORDERCREATE];
			canManagePayment = !!data[EntityPermission.ORDERPAYMENTMANAGE];
		} catch (error) {
			canView = false;
			canManagePayment = false;
		}
	}

	$: {
		qty = isNaN($cartItemInfo.qty) ? 0 : $cartItemInfo.qty;
		if ($showAddVariantModal) {
			_okText = 'patona-sellercenter-sales-modal-add-button-addcart';
		}
		if ($showEditVariantModal) {
			_okText = 'patona-sellercenter-sales-modal-edit-button-updateitem';
		}

		if ($showPaymentModal) {
			createAndGetOrder();
		}
	}

	paymentInfo.subscribe((v) => {
		validatePaymentForm(v).then((isValid) => {
			isPaymentValid = isValid;
		});
	});

	const loadKeywords = async () => {
		const lang = $currentLanguage.code;
		const fallback = 'default';

		phdSearch = await i18nStore.get('patona-sellercenter-sales-placeholder-search', lang, fallback);
		productNotFound = await i18nStore.get(
			'patona-sellercenter-sales-subtitle-productsfound',
			lang,
			fallback
		);
		tabLabels = await Promise.all(
			mappingTabsTitle.map((t) => i18nStore.get(t.key, lang, fallback))
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}

	$: {
		const loadKey = `${$location.pathname}|${currentCompanyId}|${currentStoreId}`;
		if (loadKey !== lastLoadKey) {
			lastLoadKey = loadKey;
			if ($location.pathname === '/sales' && currentCompanyId && currentStoreId) {
				resetSalesProductList();
				loadPromise = loadInitialSales();
			}
		}
	}

	onDestroy(() => {
		unsubscribeCompany();
		unsubscribeStore();
	});
</script>

<!-- 2in1 modal: add varient and edit variant -->
<!-- svelte-ignore missing-declaration -->
<ModalWithDivider
	modalWidth="40vw"
	toggleModal={() =>
		$showAddVariantModal
			? toggleAddVariantModal($showAddVariantModal)
			: toggleEditVariantModal($showEditVariantModal)}
	id="variant"
	ShowModal={$showAddVariantModal || $showEditVariantModal}
	hPosition="left"
>
	<div slot="title">
		<ssk-text size="2xl">
			<ssk-i18n-translate
				key={$showAddVariantModal
					? 'patona-sellercenter-sales-modal-add-title-additem'
					: 'patona-sellercenter-sales-modal-edit-title-edititem'}
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<ssk-text color="gray">
			<ssk-i18n-translate
				key={$showAddVariantModal
					? 'patona-sellercenter-sales-modal-add-subtitle-reviewitems'
					: 'patona-sellercenter-sales-modal-edit-subtitle-reviewitems'}
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
	</div>
	<div slot="body" class="scroll-body">
		<ProductStackCard
			product_name={$cartItemInfo.product_name ?? ''}
			img={$cartItemInfo.image}
			price={formatPriceWithBath($cartItemInfo.price)}
			qty={$cartItemInfo.qty}
		/>
		<Variant
			bind:price={$cartItemInfo.price}
			variant={$selectedProductInfo.variant ?? []}
			customerInput={$selectedProductInfo.customerInput}
			productInfo={$cartItemInfo}
		/>
	</div>
	<div class="footer" slot="footer">
		<ssk-button variant="outline" themeColor="gray" width="full" on:click={_onCancel}>
			<ssk-i18n-translate
				key={$showAddVariantModal
					? 'patona-sellercenter-sales-modal-add-button-cancel'
					: 'patona-sellercenter-sales-modal-edit-button-cancel'}
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button width="full" on:click={_onOk} disabled={$showAddVariantModal ? false : !$isUpdate}>
			<ssk-i18n-translate key={_okText} lang={$currentLanguage.code} fallbackLang="default" />
			{formatPriceWithBath($cartItemInfo.price * qty)}
		</ssk-button>
	</div>
</ModalWithDivider>

<PaymentSelectedMethodModal bind:fullfilmentType bind:isPaymentValid onPrint={printOrderReceipt} />

<OrderPaymentModal {canManagePayment} />

<NoPaymentChannelModal />

<PaymentSuccessModal onPrint={printOrderReceipt} />
<SimplifiedPaymentSuccessModal />
<SettingsPrinterDetail />

{#await loadPromise}
	<LoadingPage description="กำลังโหลดข้อมูล..." />
{:then}
	{#if !currentCompanyId || !currentStoreId}
		<LoadingPage description="กำลังโหลดข้อมูล..." />
	{:else if isForbidden || !canView}
		<PermissionDenied />
	{:else}
		{#key currentCompanyId}
			<div class="container">
				<div class="left-section">
					{#if $salesProductList.total > 0}
						<div class="search-row">
							<ssk-input placeholder={phdSearch} value={keyword} on:input={onSearchInputChange}>
								<ssk-input-addon slot="prefix">
									<ssk-icon name="outline-magnifying-glass" size="md"></ssk-icon>
								</ssk-input-addon>
							</ssk-input>
							<div class="grid-density" role="group" aria-label="จำนวนสินค้าต่อแถว">
								{#each gridColumnOptions as n}
									<button
										type="button"
										class="grid-density-option"
										class:active={gridColumns === n}
										data-testid={`sales.grid.density.${n}`}
										aria-pressed={gridColumns === n}
										on:click={() => setGridColumns(n)}
									>
										<span class="bars" aria-hidden="true">
											{#each Array(n + 0) as _}<i></i>{/each}
										</span>
									</button>
								{/each}
							</div>
						</div>
						<ssk-tabs
							id="tabs-sales"
							variant="button"
							widthtab="true"
							labels={tabLabels}
							activeIndex={activeTabIndex}
							on:change={handleTabClick}
						>
							<div class="card-scroll" slot="content-slot-0">
								<SaleList {loadMore} columns={gridColumns} />
							</div>
							<div class="card-scroll" slot="content-slot-1">
								<SaleList {loadMore} columns={gridColumns} />
							</div>
							<div class="card-scroll" slot="content-slot-2">
								<SaleList {loadMore} columns={gridColumns} />
							</div>
							<div class="card-scroll" slot="content-slot-3">
								<SaleList {loadMore} columns={gridColumns} />
							</div>
						</ssk-tabs>
					{:else}
						<BlankPage description={productNotFound} />
					{/if}
				</div>
				{#key currentStoreId}
					<div class="right-section">
						{#if $showPaymentModal}
							<CartOrder orderId={$orderData.orderSerial} />
						{:else}
							<Cart bind:buyer={$orderData.buyer} bind:fullfilmentType />
						{/if}
					</div>
				{/key}
			</div>
		{/key}
	{/if}
{/await}

<style lang="css">
	.container {
		display: flex;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.left-section,
	.right-section {
		padding: 1.2rem;
		background-color: white;
		display: flex;
		flex-direction: column;
	}

	.left-section {
		padding: 1.5rem;
		flex: 2;
		border-right: 1px solid var(--ssk-colors-gray-100);
	}

	.card-scroll {
		display: flex;
		overflow-x: hidden;
		width: 100%;
		max-height: 70vh;
		flex-direction: column;
		box-sizing: border-box;
	}

	/* (assuming 1920x1080 resolution) */
	@media (min-width: 1920px) and (max-width: 2560px) {
		.card-scroll {
			max-height: 80vh;
		}
	}

	/* (assuming 2560x1440 resolution or higher) */
	@media (min-width: 2560px) {
		.card-scroll {
			max-height: 100vh;
		}
	}

	.right-section {
		flex: 1;
		/* The cart is a fixed-height column that divides itself up: the item list and
		   the discount block flex, everything else keeps its natural height. Without
		   min-height/overflow here the children would push past the panel instead of
		   sharing it, which is what made `.cart-item`'s height a suggestion rather
		   than a rule. */
		min-height: 0;
		overflow: hidden;
		/* README-tracked bug: with no floor this panel shrinks to ~115px at 1024px;
		   multi-destination badges/rows are the first feature that can't survive that. */
		min-width: 320px;
	}

	/* Tablet/mobile: left (products) and right (cart) stay SIDE BY SIDE at every
	   width — the cashier wants the same two-pane shape on a tablet till, not a
	   stacked single column. What shrinks instead is the content: padding tightens
	   and the cart's own min-width floor comes down from 320px (which alone would
	   force horizontal overflow on anything narrower than ~left-pane + 320px) to
	   just enough to keep its rows legible. The product grid's own floor shrinks to
	   match in SaleList.svelte/ProductItem.svelte, so the left pane still shows
	   multiple columns of clearly-readable cards instead of one oversized column. */
	@media (max-width: 1024px) {
		.left-section,
		.right-section {
			padding: 0.75rem;
		}

		.right-section {
			min-width: 220px;
		}
	}

	@media (max-width: 480px) {
		.left-section,
		.right-section {
			padding: 0.5rem;
		}

		.right-section {
			min-width: 170px;
		}
	}

	.search-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.search-row ssk-input {
		flex: 1;
	}

	.grid-density {
		display: flex;
		flex-shrink: 0;
		gap: 0.25rem;
		padding: 0.25rem;
		background: var(--ssk-colors-gray-100);
		border-radius: 10px;
	}

	.grid-density-option {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		height: 2rem;
		padding: 0 0.625rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--ssk-colors-gray-400);
		cursor: pointer;
	}

	.grid-density-option.active {
		background: white;
		color: var(--ssk-colors-primary-500, #ec5e2a);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
	}

	.bars {
		display: flex;
		gap: 2px;
	}

	.bars i {
		width: 3px;
		height: 14px;
		border-radius: 1px;
		background: currentColor;
	}

	ssk-input {
		--background-color: white;
		--border-color: var(--ssk-colors-gray-200);
		--gap: 0.5rem;
		padding-bottom: 0.5rem;
	}

	ssk-input-addon {
		padding-left: 0.5rem;
	}

	/* Modal */
	.footer {
		display: flex;
		gap: 0.75rem;
	}
	.scroll-body {
		width: 100%;
		height: 20rem;
		overflow: auto;
	}
</style>
