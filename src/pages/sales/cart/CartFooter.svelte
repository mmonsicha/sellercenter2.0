<script lang="ts">
	import Modal from '$components/modal/Modal.svelte';

	import type { discountType } from '$stores/cart';
	import {
		calculateDiscount,
		calculateSummary,
		cartListInfo,
		ClearAllItem
	} from '$stores/cart/cart';
	import {
		clearOrderMeta,
		createOrder,
		getOrder,
		makeOrder,
		orderData,
		shippingFee
	} from '$stores/order/order';
	import {
		clearPayment,
		makeAttributesPayment,
		paymentInfo,
		showPaymentModal,
		togglePaymentModal,
		updatePayment,
		updateTaskInfoAndPaymentAmount
	} from '$stores/payment';
	import { currentStore } from '$stores/store/current-store';
	import { formatPriceWithBath } from '$utils/format-number';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext, tick } from 'svelte';
	import { isDiscountValueValid } from './util.cart';
	import { currentCompany } from '$stores/company/current-company';
	import { newPartyInfo, OrderFlow, PaymentType, FullfilmentType } from '$lib/entities/order/order';
	import { currentLanguage } from '$stores/i18n';
	import { configurationStore } from '$stores/configuration';
	import { PaymentMode } from '$lib/entities/configuration/configuration';
	import { resolveOrderFlow } from '$utils/order-flow';
	import {
		openPaymentModal,
		initPaymentTransaction,
		resolveAvailablePaymentMethods,
		showNoPaymentChannelModal
	} from '$stores/payment/payment-transaction';
	import {
		ONLINE_PAYMENT_METHODS,
		OFFLINE_PAYMENT_METHODS,
		type PaymentMethod
	} from '$lib/entities/payment/payment-method';
	import {
		getCustomerByIdWithAccess,
		updateCustomerWithAccess
	} from '../../../service/customer-book-v2-rest';
	import { marketplaceValues, shouldUseSukipayOnline } from '$utils/utils-order';

	export let total: number;
	export let discount: number;
	export let hasItem: boolean;
	export let summary: number;
	export let isDeliveryLater: boolean;
	export let isBuyerValid: boolean;
	export let isOnline: boolean;
	// LINK_BILL sends the buyer a payment link instead of taking payment at the counter.
	// The link endpoint does not exist yet, so the action is visible but inert — better
	// than pretending an order was created.
	export let isLinkBill: boolean = false;
	export let fullfilmentType: string = FullfilmentType.PickupImmediate;
	// Branch the customer will collect a pick-up-later order at. Empty for every other
	// fulfilment type, and the order builder then behaves exactly as before.
	export let pickupStoreId: string = '';

	let isProcessing = false;
	var remark: string = '';

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');
	const helperText = 'รูปแบบไม่ถูกต้อง';
	var isError: boolean = false;
	var value: string = '';
	var dType: discountType = 'percentage';
	var phdValue: string;
	var showClearCartModal: boolean = false;
	// Discount and note moved out of the cart into their own modals; the row keeps two
	// buttons instead of three always-on fields. Each modal edits a draft copy so
	// "ยกเลิก" really cancels — the live `value` / `dType` / `remark` (which the
	// reactive block below turns into the order total) only change on confirm.
	var showDiscountModal: boolean = false;
	var showRemarkModal: boolean = false;
	var draftDType: discountType = 'percentage';
	var draftValue: string = '';
	var draftError: boolean = false;
	var draftRemark: string = '';
	type TOption = {
		value: string;
		key: string;
	};

	const phd = {
		fixed: 'patona-sellercenter-sales-placeholder-fixed',
		percentage: 'patona-sellercenter-sales-placeholder-percentage'
	};
	const options: TOption[] = [
		{ value: 'percentage', key: 'patona-sellercenter-sales-option-percentage' },
		{ value: 'fixed', key: 'patona-sellercenter-sales-option-fixed' }
	];
	let titleClearCart: string;
	let descriptionClearCart: string;

	let tooltipItems: string[] = [];
	let typePayment: string = '';

	cartListInfo.subscribe((c) => {
		summary = c.summaryPrice;

		if (c.data.length === 0) {
			clearDiscountErrorValue();
			clearRemarkValue();
		}
	});

	function _onChangeRemark(e: Event) {
		draftRemark = (e.target as HTMLInputElement).value;
	}

	// ประเภท has exactly two values, so the modal offers them side by side instead of
	// behind a dropdown. Switching clears the draft amount: 50 typed as a percentage
	// must not carry over into a ฿ discount.
	const selectDraftType = (option: string) => {
		const t = option as discountType;
		if (t === draftDType) return;
		draftDType = t;
		draftError = false;
		draftValue = '';
	};

	// Arrow keys move between the two options, as a radiogroup is expected to.
	const onTypeKeydown = async (e: KeyboardEvent) => {
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
		e.preventDefault();
		const next: discountType = draftDType === 'percentage' ? 'fixed' : 'percentage';
		const group = e.currentTarget as HTMLElement;
		selectDraftType(next);
		await tick();
		group.querySelectorAll<HTMLElement>('.type-option')[next === 'percentage' ? 0 : 1]?.focus();
	};

	function _onChangeInput(e: Event) {
		draftValue = (e.target as HTMLInputElement).value.replace(/[^\d.-]/g, '');
		draftError = !isDiscountValueValid(draftValue, draftDType);

		if (draftDType === 'percentage' && +draftValue > 100) {
			draftValue = '100';
		}

		(e.target as HTMLInputElement).value = draftValue;
	}

	const openDiscountModal = () => {
		draftDType = dType;
		draftValue = value;
		draftError = isError;
		showDiscountModal = true;
	};

	const closeDiscountModal = () => (showDiscountModal = false);

	const applyDiscount = () => {
		if (draftError) return;
		dType = draftDType;
		value = draftValue;
		isError = false;
		showDiscountModal = false;
	};

	const clearDraftDiscount = () => {
		draftValue = '';
		draftError = false;
	};

	const openRemarkModal = () => {
		draftRemark = remark;
		showRemarkModal = true;
	};

	const closeRemarkModal = () => (showRemarkModal = false);

	const applyRemark = () => {
		remark = draftRemark;
		showRemarkModal = false;
	};

	// Label the buttons with what they hold, so the row states the order's extras
	// without opening anything.
	$: discountLabel =
		+value > 0 && !isError
			? dType === 'percentage'
				? `ส่วนลด ${value}%`
				: `ส่วนลด ${formatPriceWithBath(+value)}`
			: 'เพิ่มส่วนลด';
	$: hasDiscount = +value > 0 && !isError;

	function toggleClearCartModal() {
		showClearCartModal = !showClearCartModal;
	}

	function clearData() {
		clearDiscountErrorValue();
		clearRemarkValue();
		ClearAllItem();
		$orderData.buyer = newPartyInfo();
		clearOrderMeta();
	}

	function isValidPaymentType(type?: string): boolean {
		const ignoredPlatformTypes = ['unknown', ...marketplaceValues];
		return !!type && type.trim() !== '' && !ignoredPlatformTypes.includes(type);
	}

	async function handleOrder({
		flow,
		beforeMakeOrder,
		onSuccess
	}: {
		flow: OrderFlow;
		beforeMakeOrder?: () => void;
		onSuccess?: () => void;
	}) {
		if (isProcessing) return;
		isProcessing = true;

		try {
			beforeMakeOrder?.();

			await makeOrder(
				$cartListInfo,
				+value,
				$currentStore.id!,
				$currentCompany.id!,
				$orderData.buyer,
				flow,
				$orderData.saleChannel!,
				remark,
				pickupStoreId
			);

			await createOrder($orderData, $currentStore.id!);
			onSuccess?.();

			if (isValidPaymentType($orderData.paymentType)) {
				typePayment = $orderData.paymentType ?? '';
			}

			toastStore.addToast({
				message: 'บันทึกสำเร็จ',
				type: 'success',
				timeout: 5000
			});
		} catch (error) {
			toastStore.addToast({
				message: 'เกิดข้อผิดพลาดกรุณาลองใหม่อีกครั้ง',
				type: 'error',
				timeout: 5000
			});
		} finally {
			isProcessing = false;
		}
	}

	// Appends this order to the buyer's Customer Book v2 order history.
	// Payment-agnostic — safe for any flow (does NOT touch payment-task attributes).
	async function appendOrderToCustomer() {
		if (!$orderData.buyer.refId) return;

		const customer = await getCustomerByIdWithAccess(
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

	// Legacy (non-sukipay) online linkage: writes the legacy payment-task attributes
	// (payment_ref/payment_note/payment_type) then appends the order to the customer.
	// NOTE: only valid for legacy flows — the sukipay flow's payments task rejects these
	// attributes, so the sukipay path uses appendOrderToCustomer() directly instead.
	async function linkOrderToCustomer() {
		if (!$orderData.buyer.refId) return;

		if (isValidPaymentType(typePayment)) {
			updatePayment({
				type: typePayment,
				total: summary
			});

			let attributes = makeAttributesPayment($paymentInfo);
			await updateTaskInfoAndPaymentAmount(
				$currentStore.id!,
				$orderData?.orderId!,
				attributes,
				$orderData!
			);
		}

		await appendOrderToCustomer();
	}

	async function _onClickOnlineSave() {
		const companyId = $currentCompany?.id ?? '';
		const storeId = $currentStore?.id ?? '';
		const cfg = $configurationStore.data.companies[companyId];
		// SukiPay online is used ONLY when the chosen payment method is bank transfer;
		// any other method falls back to the legacy POS_ONLINE flow (no payment modal).
		const useSukipay = shouldUseSukipayOnline(cfg?.paymentMode, $orderData.paymentType);

		if (useSukipay) {
			// Resolved before creating the order so we can bail out early when the store
			// has no usable payment channel, and drive the modal's tabs from real config.
			let availableMethods: PaymentMethod[] = [];
			if (storeId) {
				availableMethods = await resolveAvailablePaymentMethods(
					companyId,
					storeId,
					ONLINE_PAYMENT_METHODS
				);
				if (availableMethods.length === 0) {
					showNoPaymentChannelModal();
					return;
				}
			}

			await handleOrder({
				flow: OrderFlow.POS_ONLINE_SUKIPAY_V1,
				onSuccess: async () => {
					const orderId = $orderData.orderId ?? '';
					// createOrder returns only the orderId — fetch the order to get its
					// serial (running number) so the modal title shows it, not '-'.
					try {
						await getOrder(storeId, orderId);
					} catch (err) {
						console.warn('[payment] fetch order for serial failed:', err);
					}

					// SukiPay owns payment for this flow — open the modal + init the
					// transaction. Do NOT write legacy payment-task attributes here
					// (payment_ref/note/type): POS-ONLINE-SUKIPAY-V1's payments task
					// rejects them, which previously threw before the modal could open.
					openPaymentModal({
						orderId,
						orderSerial: $orderData.orderSerial ?? '',
						totalAmount: summary,
						methods: availableMethods
					});
					try {
						await initPaymentTransaction({ storeId, orderId });
					} catch (err) {
						// Error already surfaced via store; modal will show 'failed' state
						console.warn('[payment] init transaction failed:', err);
					}

					// Best-effort customer-book linkage — must run before clearData (needs
					// buyer/order ids) and must not block the payment modal on failure.
					try {
						await appendOrderToCustomer();
					} catch (err) {
						console.warn('[order] append to customer book failed:', err);
					}

					clearData();
					clearPayment();
					typePayment = '';
				}
			});
			return;
		}

		// non-sukipay online: unchanged legacy path
		await handleOrder({
			flow: OrderFlow.POS_ONLINE,
			onSuccess: async () => {
				await getOrder($currentStore.id!, $orderData.orderId!);

				await linkOrderToCustomer();

				clearData();
				clearPayment();
				typePayment = '';
			}
		});
	}

	async function _onClickPayment() {
		const companyId = $currentCompany?.id ?? '';
		const storeId = $currentStore?.id ?? '';
		const cfg = $configurationStore.data.companies[companyId];
		const isSukipay = cfg?.paymentMode === PaymentMode.Sukipay;

		// Resolved before creating the order so we can bail out early when the store
		// has no usable payment channel, and drive the modal's tabs from real config.
		let availableMethods: PaymentMethod[] = [];
		if (isSukipay && storeId) {
			const contextMethods = isOnline ? ONLINE_PAYMENT_METHODS : OFFLINE_PAYMENT_METHODS;
			availableMethods = await resolveAvailablePaymentMethods(companyId, storeId, contextMethods);
			if (availableMethods.length === 0) {
				showNoPaymentChannelModal();
				return;
			}
		}

		const flow = resolveOrderFlow({
			isSukipay,
			isOnline,
			fullfilmentType: fullfilmentType as FullfilmentType,
			hasBuyer: !!$orderData.buyer?.refId,
			isDeliveryLater
		});

		await handleOrder({
			flow,
			beforeMakeOrder: () => {
				updatePayment({
					type: PaymentType.Cash,
					total: summary
				});
			},
			onSuccess: async () => {
				if (isSukipay) {
					const orderId = $orderData.orderId ?? '';
					// createOrder returns only the orderId — fetch the order to get its
					// serial (running number) so the modal title shows it, not '-'.
					try {
						await getOrder(storeId, orderId);
					} catch (err) {
						console.warn('[payment] fetch order for serial failed:', err);
					}
					openPaymentModal({
						orderId,
						orderSerial: $orderData.orderSerial ?? '',
						totalAmount: summary,
						methods: availableMethods
					});
					try {
						await initPaymentTransaction({ storeId, orderId });
					} catch (err) {
						// Error already surfaced via store; modal will show 'failed' state
						console.warn('[payment] init transaction failed:', err);
					}
				} else {
					togglePaymentModal($showPaymentModal);
				}
			}
		});
	}

	function _onClearCartOK() {
		showClearCartModal = false;
		clearDiscountErrorValue();
		clearRemarkValue();
		ClearAllItem();
		toastStore.addToast({
			message: 'นำสินค้าออกสำเร็จ',
			type: 'success',
			timeout: 5000
		});
	}

	function _onBlur() {
		if (value === '') isError = false;
	}

	function clearDiscountErrorValue() {
		value = '';
		isError = false;
	}

	$: {
		if ($cartListInfo.data.length === 0) {
			value = '';
			remark = '';
		}

		if (!isError || !value) {
			calculateDiscount(total, dType, +value);
			calculateSummary(total, discount);
		}
	}

	const loadKeywords = async () => {
		const covertKey = await i18nStore.get(
			'patona-sellercenter-sales-tooltip',
			$currentLanguage.code,
			'default'
		);
		tooltipItems = covertKey
			.split('\n')
			.map((t) => t.trim())
			.filter(Boolean);

		titleClearCart = await i18nStore.get(
			'patona-sellercenter-sales-modal-clear-title-clearcart',
			$currentLanguage.code,
			'default'
		);
		descriptionClearCart = await i18nStore.get(
			'patona-sellercenter-sales-modal-clear-description-clearcart',
			$currentLanguage.code,
			'default'
		);
		descriptionClearCart = descriptionClearCart.replace(/\n/g, '<br />');
	};

	function clearRemarkValue() {
		remark = '';
	}

	$: if ($currentLanguage.code) {
		loadKeywords();
	}

	// The field's placeholder follows the *draft* type — the old afterUpdate read the
	// committed dType, so it labelled the input one confirm behind what was selected.
	const loadPlaceholder = async (t: discountType) => {
		phdValue = await i18nStore.get(
			phd[t as 'fixed' | 'percentage'],
			$currentLanguage.code,
			'default'
		);
	};
	$: if ($currentLanguage.code) loadPlaceholder(draftDType);
</script>

<!-- Discount, in a modal. The fields are the same ones that used to sit in the cart;
     they bind to the draft copy, so closing without confirming changes nothing. -->
<Modal
	toggleModal={closeDiscountModal}
	id="discount"
	ShowModal={showDiscountModal}
	title="ส่วนลด"
	hPosition="left"
	width="min(23rem, calc(100vw - 2.5rem))"
>
	<div class="modal-fields" slot="body">
		<!-- Type and amount each own a full-width row: the two controls line up, the
		     amount field is as wide as the modal, and no option list can cover the hint
		     below the way the dropdown menu did. -->
		<div
			class="type-toggle"
			role="radiogroup"
			tabindex="-1"
			aria-label="ประเภทส่วนลด"
			on:keydown={onTypeKeydown}
		>
			{#each options as o}
				<button
					type="button"
					class="type-option"
					class:active={draftDType === o.value}
					role="radio"
					aria-checked={draftDType === o.value}
					tabindex={draftDType === o.value ? 0 : -1}
					on:click={() => selectDraftType(o.value)}
					data-testid={`sales.cart.discount.type.${o.value}`}
				>
					<span class="type-symbol">{o.value === 'percentage' ? '%' : '฿'}</span>
					<ssk-i18n-translate key={o.key} lang={$currentLanguage.code} fallbackLang="default" />
				</button>
			{/each}
		</div>
		{#key draftDType}
			<ssk-input
				class="discount-value"
				value={draftValue}
				size="sm"
				placeholder={phdValue}
				error={draftError}
				autoComplete="off"
				helperText={draftError ? helperText : ''}
				on:input={_onChangeInput}
				on:change={_onChangeInput}
				data-testid="sales.cart.discount.input"
			>
				<!-- One addon: the DS pins each postfix addon to the right edge, so a second
				     one lands on top of the first. Unit and clear share this one instead. -->
				<ssk-input-addon slot="postfix">
					<span class="postfix-group">
						<span class="unit">{draftDType === 'percentage' ? '%' : 'บาท'}</span>
						{#if draftValue}
							<button
								type="button"
								class="clear-value"
								aria-label="ล้างส่วนลด"
								on:click={clearDraftDiscount}
							>
								<ssk-icon name="outline-x-circle"></ssk-icon>
							</button>
						{/if}
					</span>
				</ssk-input-addon>
			</ssk-input>
		{/key}
		<div class="modal-hint">
			<ssk-text size="xs" color="gray.500">
				{#each tooltipItems as item}
					<div>{item}</div>
				{/each}
			</ssk-text>
		</div>
	</div>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={closeDiscountModal}
		data-testid="sales.cart.discount.cancel"
	>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-add-button-cancel"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button
		slot="modal-footer-right"
		width="full"
		disabled={draftError}
		on:click={applyDiscount}
		data-testid="sales.cart.discount.apply"
	>
		ใช้ส่วนลด
	</ssk-button>
</Modal>

<!-- Note, in a modal. -->
<Modal
	toggleModal={closeRemarkModal}
	id="remark"
	ShowModal={showRemarkModal}
	title="หมายเหตุ"
	hPosition="left"
	width="min(23rem, calc(100vw - 2.5rem))"
>
	<div class="modal-fields" slot="body">
		<ssk-input
			size="sm"
			placeholder="ระบุหมายเหตุ"
			limit={255}
			value={draftRemark}
			on:input={_onChangeRemark}
			on:change={_onChangeRemark}
			data-testid="sales.cart.remark.input"
		>
			{#if draftRemark}
				<ssk-input-addon slot="postfix" on:click={() => (draftRemark = '')}>
					<ssk-icon name="outline-x-circle"></ssk-icon>
				</ssk-input-addon>
			{/if}
		</ssk-input>
	</div>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={closeRemarkModal}
		data-testid="sales.cart.remark.cancel"
	>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-add-button-cancel"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button
		slot="modal-footer-right"
		width="full"
		on:click={applyRemark}
		data-testid="sales.cart.remark.apply"
	>
		บันทึกหมายเหตุ
	</ssk-button>
</Modal>

<Modal
	toggleModal={toggleClearCartModal}
	id="clear-cart"
	icon="outline-exclamation-circle"
	iconColor="#d97706"
	ShowModal={showClearCartModal}
	title={titleClearCart}
	body="<center>{descriptionClearCart}</center>"
>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={async () => {
			showClearCartModal = false;
		}}
	>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-clear-button-close"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button width="full" slot="modal-footer-right" on:click={_onClearCartOK}>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-clear-button-clearcart"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</Modal>

<div class="summary">
	<!-- Two buttons instead of three standing fields: both extras live in modals now,
	     and each button states whether it is holding anything (filled = has content,
	     matching the reference). -->
	<div class="quick-actions">
		<ssk-button
			size="sm"
			width="full"
			variant={hasDiscount ? 'solid' : 'outline'}
			themeColor={hasDiscount ? 'primary' : 'button'}
			disabled={!hasItem}
			on:click={openDiscountModal}
			data-testid="sales.cart.discount.open"
		>
			<ssk-icon
				slot="prefix"
				name="outline-receipt-percent"
				themeColor={hasDiscount ? 'white' : 'stroke'}
			></ssk-icon>
			<ssk-text slot="prefix" size="sm" color={hasDiscount ? 'white' : 'gray.800'}>
				{discountLabel}
			</ssk-text>
		</ssk-button>
		<ssk-button
			size="sm"
			width="full"
			variant={remark ? 'solid' : 'outline'}
			themeColor={remark ? 'primary' : 'button'}
			on:click={openRemarkModal}
			data-testid="sales.cart.remark.open"
		>
			<ssk-icon slot="prefix" name="outline-document-text" themeColor={remark ? 'white' : 'stroke'}
			></ssk-icon>
			<ssk-text slot="prefix" size="sm" color={remark ? 'white' : 'gray.800'}>
				{remark ? 'แนบหมายเหตุแล้ว' : 'เพิ่มหมายเหตุ'}
			</ssk-text>
		</ssk-button>
	</div>

	<!-- The block the resize handle borrows from: the totals shrink and scroll so the
	     item list can grow, while the two terminal buttons below never move. -->
	<div class="detail" data-flex-give="totals">
		<div>
			<ssk-text>
				<ssk-i18n-translate
					key="patona-sellercenter-sales-summary-totalprice"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
		</div>
		<div class="right"><ssk-text>{formatPriceWithBath(total)}</ssk-text></div>
		{#if value}
			<div>
				<ssk-text>
					<ssk-i18n-translate
						key="patona-sellercenter-sales-summary-discount"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
			</div>
			<div class="right"><ssk-text color="rose.600">{formatPriceWithBath(discount)}</ssk-text></div>
		{/if}
		{#if isOnline}
			<div>
				<ssk-text>
					<ssk-i18n-translate
						key="patona-sellercenter-sales-summary-shippingfee"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
			</div>
			<div class="right">
				<ssk-text>{formatPriceWithBath($shippingFee)}</ssk-text>
			</div>
		{/if}
		<div>
			<ssk-text fontWeight="medium">
				<ssk-i18n-translate
					key="patona-sellercenter-sales-summary-grandtotal"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
		</div>
		<div class="right">
			<ssk-text color="primary">{formatPriceWithBath(summary + $shippingFee)}</ssk-text>
		</div>
	</div>
	<div class="footer">
		<!-- The two terminal actions keep the DS default size: they are the last thing a
		     cashier should have to aim at, and they sit side by side so they match. -->
		<ssk-button
			disabled={!hasItem}
			on:click={toggleClearCartModal}
			variant="outline"
			themeColor="secondary"
			width="full"
		>
			<ssk-i18n-translate
				key="patona-sellercenter-sales-button-clearcart"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		{#if isLinkBill}
			<ssk-button
				width="full"
				disabled
				title="รอ endpoint สร้างลิงก์ชำระเงินจากฝั่ง backend"
				data-testid="sales.cart.linkbill.generate"
			>
				สร้างลิงก์ชำระเงิน
			</ssk-button>
		{:else if isOnline}
			<ssk-button
				width="full"
				disabled={!hasItem || isProcessing || (isOnline && !isBuyerValid)}
				on:click={_onClickOnlineSave}
			>
				บันทึก
			</ssk-button>
		{:else}
			<ssk-button
				width="full"
				disabled={!hasItem || isError || isProcessing || (isDeliveryLater && !isBuyerValid)}
				on:click={_onClickPayment}
			>
				<ssk-i18n-translate
					key="patona-sellercenter-sales-button-checkout"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-button>
		{/if}
	</div>
</div>

<style>
	.summary {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		/* Never grows (the leftover space belongs to the item list, flex: 1 1 0 there)
		   but must be allowed to SHRINK: that is how the pressure from a dragged list
		   reaches the totals below, the block that yields. With `flex: 0 0 auto` the
		   panel just overflowed by the amount the list grew. */
		flex: 0 1 auto;
		min-height: 0;
		/* Pin the whole block — totals and the two terminal buttons — to the bottom of
		   the panel. Shortening the item list then opens a gap above the totals, not a
		   dead band under the pay button. */
		margin-top: auto;
	}
	/* Two equal buttons, one row — the whole discount block used to be ~106px here. */
	.quick-actions {
		display: flex;
		gap: 0.5rem;
		flex: 0 0 auto;
	}

	/* Equal halves. `width="full"` alone leaves each button at content width, because
	   the host is a flex item whose base size is its content. */
	.quick-actions ssk-button {
		flex: 1 1 0;
		min-width: 0;
	}

	.modal-fields {
		display: grid;
		gap: 0.625rem;
		/* The DS modal centres its body slot, so a grid here sizes to max-content —
		   i.e. to the longest line of the hint. Fill the body instead, or the fields
		   end up ~210px wide inside a 368px modal. */
		width: 100%;
		box-sizing: border-box;
		padding: 0.25rem 0 0;
	}

	.modal-hint {
		display: grid;
		gap: 0.125rem;
	}

	/* Segmented ประเภท picker: two equal cells in a tray, the active one lifted. */
	.type-toggle {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.25rem;
		padding: 0.1875rem;
		box-sizing: border-box;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		background: var(--ssk-colors-gray-50);
	}

	.type-option {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-height: 2rem;
		padding: 0 0.5rem;
		/* transparent border on the base so selecting one does not shift the row */
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
		line-height: 1.3;
		color: var(--ssk-colors-gray-600);
		cursor: pointer;
	}

	.type-option:hover:not(.active) {
		background: var(--ssk-colors-gray-100);
	}

	.type-option.active {
		background: #fff;
		border-color: var(--ssk-colors-gray-300);
		color: var(--ssk-colors-gray-800);
		font-weight: 500;
		box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
	}

	/* The unit glyph carries the selected state in colour, so the picked cell reads
	   as picked at a glance and not just as a slightly lighter box. */
	.type-option.active .type-symbol {
		color: var(--ssk-colors-primary-500);
	}

	.type-symbol {
		font-size: var(--ssk-font-size-sm);
		font-weight: 600;
	}

	.postfix-group {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.clear-value {
		display: inline-flex;
		align-items: center;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ssk-colors-gray-400);
		cursor: pointer;
	}

	.clear-value:hover {
		color: var(--ssk-colors-gray-600);
	}

	.unit {
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-500);
		white-space: nowrap;
	}

	.footer {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		/* The last thing a cashier aims at never shrinks. */
		flex: 0 0 auto;
	}

	.discount-value {
		display: block;
		width: 100%;
	}

	/* Totals and the button row never shrink — they are the last thing a cashier may
	   lose sight of. */
	.detail {
		/* Shrinkable + scrollable: this is what yields when the item list is dragged
		   taller, which keeps .footer (clear + pay) at full height at all times. */
		flex: 0 1 auto;
		min-height: 1.75rem;
		overflow-y: auto;
		background-color: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		color: var(--ssk-colors-gray-500);
		padding: 1rem;
		gap: 0.5rem;
		display: grid;
		grid-template-columns: auto auto;
		margin-bottom: 0.25rem;
	}

	.right {
		text-align: right;
	}
</style>
