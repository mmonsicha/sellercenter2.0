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
						<ssk-input placeholder={phdSearch} value={keyword} on:input={onSearchInputChange}>
							<ssk-input-addon slot="prefix">
								<ssk-icon name="outline-magnifying-glass" size="md"></ssk-icon>
							</ssk-input-addon>
						</ssk-input>
						<ssk-tabs
							id="tabs-sales"
							variant="button"
							widthtab="true"
							labels={tabLabels}
							activeIndex={activeTabIndex}
							on:change={handleTabClick}
						>
							<div class="card-scroll" slot="content-slot-0">
								<SaleList {loadMore} />
							</div>
							<div class="card-scroll" slot="content-slot-1">
								<SaleList {loadMore} />
							</div>
							<div class="card-scroll" slot="content-slot-2">
								<SaleList {loadMore} />
							</div>
							<div class="card-scroll" slot="content-slot-3">
								<SaleList {loadMore} />
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
