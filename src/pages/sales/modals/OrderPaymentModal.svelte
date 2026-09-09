<script lang="ts">
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import { ClearAllItem } from '$stores/cart/cart';
	import { formatPriceWithBath } from '$utils/format-number';
	import {
		paymentModal,
		closePaymentModal,
		submitPayment,
		submitAndApprovePayment,
		continuePayment,
		showNoPaymentChannelModal,
		PaymentModalStatus,
		PAYMENT_PROVIDER
	} from '$stores/payment/payment-transaction';
	import { currentStore } from '$stores/store/current-store';
	import BankTransferFields from '$components/payment/BankTransferFields.svelte';
	import { toBankOptions } from '$components/payment/bank-option';
	import { sanitizeAmount } from '$utils/amount-input';
	import PartialPaymentAlertModal from './PartialPaymentAlertModal.svelte';
	import type { UploadResult } from '$lib/entities/payment/upload';
	import type { SubmitPaymentRequest } from '../../../service/management-rest';
	import { refreshOrders } from '$stores/order/order-refresh';
	import {
		getTransferValidationErrors,
		toRFC3339,
		TRANSFER_DATETIME_ERRORS
	} from '$utils/transfer-datetime';
	import { uploadSlipFiles, type UploadedSlipFiles } from '$utils/slip-upload';
	import { listPaymentChannels } from '../../../service/management-rest';
	import { currentCompany } from '$stores/company/current-company';
	import type { PaymentChannel } from '$lib/entities/payment/payment';
	import { PaymentType } from '$lib/entities/payment/payment';
	import { PaymentMethod, PAYMENT_METHOD_LABEL_KEYS } from '$lib/entities/payment/payment-method';
	import { onMount, tick, getContext } from 'svelte';
	import { openModal } from '$stores/sales/modals';
	import { currentLanguage } from '$stores/i18n';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';

	$: isRecordContext = $paymentModal.context === 'record';

	const i18nStore = getContext<I18nStore>('i18n');
	const toastStore = getContext<ToastStore>('toast');

	// Whether the current operator may approve payments (patona.order.payment.manage).
	// Threaded from the host page; gates the Submit & Approve action.
	export let canManagePayment = false;

	// Keywords resolved imperatively for attribute / JS-string usages
	let cashReceivedLabel = '';
	let amountPlaceholder = '';
	let amountPaidText = '';
	let amountRequiredText = '';
	let slipInvalidText = '';
	let slipTooLargeText = '';
	let bankNoAccountSelectedText = '';
	let bankEmptyStateText = '';
	let bankAmountRequiredText = '';
	let slipUploadFailedText = '';
	let slipRequiredText = '';
	let bankAmountLabel = '';
	let outstandingAmountLabel = '';
	let exactLabel = '';
	let amountSentLabel = '';
	let ofLabel = '';
	let stillOwedLabel = '';
	let processingText = '';
	let errorTitleText = '';
	let tryAgainText = '';
	let methodLabels: Partial<Record<PaymentMethod, string>> = {};

	let dtMsg: Record<string, string> = {};

	async function loadKeywords() {
		const lang = $currentLanguage.code;
		[
			cashReceivedLabel,
			amountPlaceholder,
			amountPaidText,
			amountRequiredText,
			slipInvalidText,
			slipTooLargeText,
			bankNoAccountSelectedText,
			bankEmptyStateText,
			bankAmountRequiredText,
			slipUploadFailedText,
			slipRequiredText,
			bankAmountLabel,
			outstandingAmountLabel,
			exactLabel,
			amountSentLabel,
			ofLabel,
			stillOwedLabel,
			processingText,
			errorTitleText,
			tryAgainText
		] = await Promise.all([
			i18nStore.get('payment.cash.label.received', lang, 'default'),
			i18nStore.get(
				'patona-sellercenter-modal-payment-tab-cash-placeholder-received',
				lang,
				'default'
			),
			i18nStore.get('patona-sellercenter-modal-payment-title-amountpaid', lang, 'default'),
			i18nStore.get('payment.cash.error.required', lang, 'default'),
			i18nStore.get('payment.slip.error.invalid_file', lang, 'default'),
			i18nStore.get('payment.slip.error.too_large', lang, 'default'),
			i18nStore.get('payment.bank_transfer.error.no_account_selected', lang, 'default'),
			i18nStore.get('payment.bank_account.empty_state.message', lang, 'default'),
			i18nStore.get('payment.bank_transfer.error.amount_required', lang, 'default'),
			i18nStore.get('payment.slip.error.upload_failed', lang, 'default'),
			i18nStore.get('payment.slip.error.required', lang, 'default'),
			i18nStore.get('payment.bank_transfer.label.amount', lang, 'default'),
			i18nStore.get('order.payment.label.outstanding_amount', lang, 'default'),
			i18nStore.get('order.payment.shortcut.exact', lang, 'default'),
			i18nStore.get('order.payment.label.amount_sent', lang, 'default'),
			i18nStore.get('order.payment.label.of', lang, 'default'),
			i18nStore.get('order.payment.label.still_owed', lang, 'default'),
			i18nStore.get('order.payment.status.processing', lang, 'default'),
			i18nStore.get('order.payment.error.title', lang, 'default'),
			i18nStore.get('order.payment.error.try_again', lang, 'default')
		]);
		const entries = await Promise.all(
			Object.entries(PAYMENT_METHOD_LABEL_KEYS).map(
				async ([method, key]) => [method, await i18nStore.get(key, lang, 'default')] as const
			)
		);
		methodLabels = Object.fromEntries(entries);
		const dtEntries = await Promise.all(
			Object.values(TRANSFER_DATETIME_ERRORS).map(
				async (key) => [key, await i18nStore.get(key, lang, 'default')] as const
			)
		);
		dtMsg = Object.fromEntries(dtEntries);
	}

	$: if ($currentLanguage.code) void loadKeywords();

	// NOTE: the bank-channel filter below uses legacy PaymentType.BANK_TRANSFER
	// (channel config type) — a different concept from the Sukipay PaymentMethod.
	interface PaymentMethodTab {
		key: PaymentMethod;
		label: string;
	}

	$: availableMethods = $paymentModal.methods;
	$: usedMethods = $paymentModal.usedMethods;
	// Sukipay rule: cash is first-tender-only — once the order has ANY recorded
	// payment, drop cash from the available set on subsequent tenders.
	$: hasPriorPayment = usedMethods.length > 0 || paidAmount > 0;
	$: effectiveMethods = availableMethods.filter(
		(m) => !(m === PaymentMethod.CASH && hasPriorPayment)
	);
	$: paymentMethodTabs = effectiveMethods.map(
		(m): PaymentMethodTab => ({ key: m, label: methodLabels[m] ?? '' })
	);
	$: showMethodTabs = effectiveMethods.length > 1;
	let activeMethod: PaymentMethod = PaymentMethod.CASH;
	$: if (effectiveMethods.length && !effectiveMethods.includes(activeMethod)) {
		activeMethod = effectiveMethods[0];
	}
	$: activeTabIndex = paymentMethodTabs.findIndex((t) => t.key === activeMethod);

	$: isCashMethod = activeMethod === PaymentMethod.CASH;
	$: isBankTransferMethod =
		activeMethod === PaymentMethod.BANK_TRANSFER ||
		activeMethod === PaymentMethod.BANK_TRANSFER_OFFLINE;
	$: isSlipRequired = activeMethod === PaymentMethod.BANK_TRANSFER;

	let cashAmount = '';
	let bankSelectedId: string = '';
	let bankSlipFile: File | null = null;
	let bankSlipPreview: string | null = null;
	let bankSlipError: string | null = null;
	let bankAmount = '';
	let transferDate = '';
	let transferTime = '';

	let cashTouched = false;
	let bankTouched: Record<string, boolean> = {};

	$: status = $paymentModal.status;
	$: show = $paymentModal.show && status !== PaymentModalStatus.Partial;
	$: orderSerial = $paymentModal.orderSerial;
	$: orderId = $paymentModal.orderId;

	// The modal is never unmounted, so activeMethod survives across sessions —
	// reset to the default method per new orderId (partial continuation untouched).
	let initializedOrderId = '';
	$: if (show && orderId && orderId !== initializedOrderId) {
		initializedOrderId = orderId;
		activeMethod = effectiveMethods[0] ?? PaymentMethod.CASH;
	}
	$: totalAmount = $paymentModal.totalAmount;
	$: paidAmount = $paymentModal.paidAmount;
	$: remainingAmount = Math.max(0, totalAmount - paidAmount);
	$: payableAmount = paidAmount > 0 ? remainingAmount : totalAmount;
	$: storeId = $currentStore?.id ?? '';

	// Max enforced client-side via input sanitization; min re-validated by SukiPay.
	const MAX_AMOUNT = 9999999.99;

	$: cashNum = parseFloat(cashAmount) || 0;
	$: changeAmount = Math.max(0, cashNum - payableAmount);
	$: cashError =
		cashTouched && (cashAmount.trim() === '' || cashNum <= 0) ? amountRequiredText : '';

	$: bankNum = parseFloat(bankAmount) || 0;
	// Bank-transfer amount is the slip amount — own message, not the shared cash key.
	$: bankAmountError =
		bankTouched.amount && (bankAmount.trim() === '' || bankNum <= 0) ? bankAmountRequiredText : '';

	$: transferValidationErrors = getTransferValidationErrors(transferDate, transferTime);

	$: bankDateErrorKey =
		bankTouched.date && !transferDate
			? TRANSFER_DATETIME_ERRORS.dateRequired
			: transferValidationErrors.dateError ?? '';
	$: bankTimeErrorKey =
		bankTouched.time && !transferTime
			? TRANSFER_DATETIME_ERRORS.timeRequired
			: transferValidationErrors.timeError ?? '';
	$: bankDateError = bankDateErrorKey ? dtMsg[bankDateErrorKey] ?? bankDateErrorKey : '';
	$: bankTimeError = bankTimeErrorKey ? dtMsg[bankTimeErrorKey] ?? bankTimeErrorKey : '';
	$: bankSlipMissing = isSlipRequired && bankTouched.slip && !bankSlipFile;
	$: bankBankMissing = bankTouched.bank && !bankSelectedId;
	$: isBankTransferValid =
		!!bankSelectedId &&
		(!isSlipRequired || !!bankSlipFile) &&
		!bankSlipError &&
		bankAmount.trim() !== '' &&
		bankNum > 0 &&
		!!transferDate &&
		!!transferTime &&
		!transferValidationErrors.dateError &&
		!transferValidationErrors.timeError;

	$: hideCloseButton = status === PaymentModalStatus.Submitting;
	$: isConfirmDisabled =
		status !== PaymentModalStatus.Idle ||
		(isCashMethod ? cashAmount.trim() === '' || cashNum <= 0 : !isBankTransferValid);

	let paymentChannels: PaymentChannel[] = [];

	$: bankChannels = toBankOptions(paymentChannels);

	// Default the selection to the first bank account; keep the current pick if still valid.
	$: bankSelectedId = bankChannels.some((b) => b.id === bankSelectedId)
		? bankSelectedId
		: bankChannels[0]?.id ?? '';

	async function loadBankChannels() {
		const companyId = $currentCompany?.id ?? '';
		if (!companyId || !storeId) return;
		try {
			const resp = await listPaymentChannels(companyId, storeId);
			paymentChannels = resp.data;
		} catch (err) {
			console.warn('[payment] failed to load payment channels:', err);
			paymentChannels = [];
		}
	}

	function resolveChannelId(): number | undefined {
		const channel = isCashMethod
			? paymentChannels.find((ch) => ch.status === true && ch.data?.type === PaymentType.CASH)
			: paymentChannels.find((ch) => ch.id === bankSelectedId);
		return channel ? Number(channel.data.paymentId) : undefined;
	}

	$: if (show && storeId && $currentCompany?.id) {
		void loadBankChannels();
	}

	function selectMethodByIndex(idx: number) {
		const tab = paymentMethodTabs[idx];
		if (tab) activeMethod = tab.key;
	}

	function handleTabChange(e: CustomEvent) {
		if (status === PaymentModalStatus.Submitting || status === PaymentModalStatus.Polling) return;
		const idx = e.detail?.index ?? activeTabIndex;
		selectMethodByIndex(idx);
	}

	function handleTabClick(e: Event) {
		// fallback for ssk-tabs click event (when on:change isn't dispatched)
		const target = e.target as HTMLElement;
		const idx = target?.getAttribute?.('data-tab-index');
		if (idx != null) selectMethodByIndex(parseInt(idx, 10));
	}

	function resetForm() {
		cashAmount = '';
		bankSelectedId = '';
		bankSlipFile = null;
		bankSlipPreview = null;
		bankSlipError = null;
		bankAmount = '';
		transferDate = '';
		transferTime = '';
		activeMethod = effectiveMethods[0] ?? availableMethods[0] ?? PaymentMethod.CASH;
		cashTouched = false;
		bankTouched = {};
	}

	function _onClose() {
		if (status === PaymentModalStatus.Submitting) return;

		if (status === PaymentModalStatus.Success) {
			ClearAllItem();
		}

		resetForm();
		closePaymentModal();
	}

	async function _onConfirm() {
		if (!storeId || !orderId) return;

		let slipCleanup: UploadedSlipFiles | undefined;
		let submitRequest: SubmitPaymentRequest;

		if (isCashMethod) {
			cashTouched = true;
			if (cashAmount.trim() === '' || cashNum <= 0) return;
			submitRequest = {
				payment_method: activeMethod,
				payment_provider: PAYMENT_PROVIDER,
				payment_amount: cashNum,
				currency: 'THB',
				payment_channel_id: resolveChannelId()
			};
		} else if (isBankTransferMethod) {
			bankTouched = { bank: true, slip: true, amount: true, date: true, time: true };
			if (!isBankTransferValid) return;
			let transferAt: string | undefined;
			try {
				transferAt = toRFC3339(transferDate, transferTime);
			} catch {
				return;
			}
			let uploadedSlip: UploadedSlipFiles | undefined;
			if (bankSlipFile) {
				const companyId = $currentCompany?.id ?? '';
				paymentModal.update((s) => ({
					...s,
					status: PaymentModalStatus.Submitting,
					error: undefined
				}));
				try {
					uploadedSlip = await uploadSlipFiles(bankSlipFile, companyId);
				} catch (err) {
					bankSlipError = slipUploadFailedText;
					paymentModal.update((s) => ({
						...s,
						status: PaymentModalStatus.Failed,
						error: err instanceof Error ? err.message : String(err)
					}));
					return;
				}
				slipCleanup = uploadedSlip;
			}
			submitRequest = {
				payment_method: activeMethod,
				payment_provider: PAYMENT_PROVIDER,
				payment_amount: bankNum,
				currency: 'THB',
				payment_channel_id: resolveChannelId(),
				transfer_at: transferAt,
				full_image_url: uploadedSlip?.fullImageUrl,
				thumbnail_url: uploadedSlip?.thumbnailUrl
			};
		} else {
			return;
		}

		await submitPayment({ storeId, orderId, submitRequest, slipCleanup });
	}

	async function _onSubmitAndApprove() {
		if (!storeId || !orderId) return;
		if (!isBankTransferMethod) return;

		bankTouched = { bank: true, slip: true, amount: true, date: true, time: true };
		if (!isBankTransferValid) return;

		let transferAt: string;
		try {
			transferAt = toRFC3339(transferDate, transferTime);
		} catch {
			return;
		}

		let uploadedSlip: UploadedSlipFiles | undefined;
		let slipCleanup: UploadedSlipFiles | undefined;
		if (bankSlipFile) {
			const companyId = $currentCompany?.id ?? '';
			paymentModal.update((s) => ({ ...s, status: PaymentModalStatus.Submitting, error: undefined }));
			try {
				uploadedSlip = await uploadSlipFiles(bankSlipFile, companyId);
			} catch (err) {
				bankSlipError = slipUploadFailedText;
				paymentModal.update((s) => ({
					...s,
					status: PaymentModalStatus.Failed,
					error: err instanceof Error ? err.message : String(err)
				}));
				return;
			}
			slipCleanup = uploadedSlip;
		}

		const submitRequest: SubmitPaymentRequest = {
			payment_method: activeMethod,
			payment_provider: PAYMENT_PROVIDER,
			payment_amount: bankNum,
			currency: 'THB',
			payment_channel_id: resolveChannelId(),
			transfer_at: transferAt,
			full_image_url: uploadedSlip?.fullImageUrl,
			thumbnail_url: uploadedSlip?.thumbnailUrl
		};

		await submitAndApprovePayment({ storeId, orderId, submitRequest, slipCleanup });
	}

	function handleCashInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const sanitized = sanitizeAmount(target.value);
		target.value = sanitized;
		cashAmount = sanitized;
		cashTouched = true;
	}

	function handleBankAmountInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const sanitized = sanitizeAmount(target.value);
		target.value = sanitized;
		bankAmount = sanitized;
		bankTouched = { ...bankTouched, amount: true };
	}

	function handleTransferDateInput(e: Event) {
		transferDate = (e.target as HTMLInputElement).value;
		bankTouched = { ...bankTouched, date: true };
	}

	function handleTransferTimeInput(e: Event) {
		transferTime = (e.target as HTMLInputElement).value;
		bankTouched = { ...bankTouched, time: true };
	}

	function handleSlipChange(detail: UploadResult) {
		bankTouched = { ...bankTouched, slip: true };
		bankSlipFile = detail.file;
		bankSlipPreview = detail.preview;
		bankSlipError = detail.error;
	}

	function handleSelectBank(id: string) {
		bankSelectedId = id;
		bankTouched = { ...bankTouched, bank: true };
	}

	function handleCashExact() {
		cashAmount = String(payableAmount);
		cashTouched = true;
	}

	function handleCashIncrement(amount: number) {
		cashAmount = String(Math.min(Math.round((cashNum + amount) * 100) / 100, MAX_AMOUNT));
		cashTouched = true;
	}

	function handleBankExact() {
		bankAmount = String(payableAmount);
		bankTouched = { ...bankTouched, amount: true };
	}

	function handleCloseAndOwe() {
		resetForm();
		closePaymentModal();
		if (isRecordContext) {
			// record context: re-fetch the mounted order page so the new payment shows in place.
			void refreshOrders();
		} else {
			// POS checkout: clear the cart for the next sale.
			ClearAllItem();
		}
		void showPaymentToast('order.payment.toast.partial_success');
	}

	// Check if payment has other method that not cash for continue paying
	$: canPayRemaining = effectiveMethods.some((m) => m !== PaymentMethod.CASH);

	function handlePayRemaining() {
		if (!canPayRemaining) {
			resetForm();
			closePaymentModal();
			showNoPaymentChannelModal();
			return;
		}

		bankAmount = String(remainingAmount);
		cashAmount = '';
		bankSelectedId = '';
		bankSlipFile = null;
		bankSlipPreview = null;
		bankSlipError = null;
		transferDate = '';
		transferTime = '';
		cashTouched = false;
		bankTouched = {};
		continuePayment();
	}

	$: summaryAmountLabel = paidAmount > 0 ? outstandingAmountLabel : amountPaidText;

	// Store subscription instead of reactive `$:` to avoid latch state issues
	// across multiple open/close cycles.
	let prevStatus: PaymentModalStatus = PaymentModalStatus.Idle;
	onMount(() => {
		const unsubscribe = paymentModal.subscribe((state) => {
			if (
				state.status === PaymentModalStatus.Success &&
				prevStatus !== PaymentModalStatus.Success
			) {
				void handleSuccessTransition();
			}
			if (
				state.status === PaymentModalStatus.Pending &&
				prevStatus !== PaymentModalStatus.Pending
			) {
				void handlePendingTransition();
			}
			prevStatus = state.status;
		});
		return unsubscribe;
	});

	async function handlePendingTransition() {
		// Submit succeeded but approval is still pending (approve failed post-submit, or the
		// order projection had not caught up before timeout). Close and let the order page
		// catch up; do NOT clear cart-then-print like a completed sale.
		resetForm();
		closePaymentModal();
		if (isRecordContext) {
			void refreshOrders();
		} else {
			ClearAllItem();
		}
		void showPaymentToast('payment.submit_approve.pending_approval', 'warning');
	}

	async function handleSuccessTransition() {
		if (isRecordContext) {
			// record context: re-fetch the mounted order page in place; toast survives (no reload).
			resetForm();
			closePaymentModal();
			void refreshOrders();
			void showPaymentToast('order.payment.toast.success');
			return;
		}
		ClearAllItem();
		resetForm();
		closePaymentModal();
		await tick();
		openModal('simplified-payment-success-with-printer-detail');
		void showPaymentToast('order.payment.toast.success');
	}

	async function showPaymentToast(
		key: string,
		type: 'success' | 'warning' | 'error' = 'success'
	) {
		toastStore.addToast({
			message: await i18nStore.get(key, $currentLanguage.code, 'default'),
			type,
			timeout: 5000
		});
	}
</script>

<ModalWithDivider
	ShowModal={show}
	id="order-payment"
	toggleModal={_onClose}
	modalWidth="564px"
	bodySlotDisplay="block"
	modalPaddingBody="0px"
	hPosition="left"
>
	<div slot="title" class="modal-header">
		<div class="modal-title-row">
			<ssk-text size="2xl" color="gray.800">
				<ssk-i18n-translate
					key="patona-sellercenter-sales-modal-payment-title-order"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
			<ssk-text size="2xl" color="primary.500">{orderSerial || '-'}</ssk-text>
		</div>
	</div>

	<div slot="body" class="pay-modal-body">
		{#if status === PaymentModalStatus.Idle || status === PaymentModalStatus.Submitting}
			<div class="pay-summary" data-testid="order-payment.modal">
				<ssk-text size="xl" color="gray.800">{summaryAmountLabel}</ssk-text>
				<ssk-text
					size="4xl"
					color="primary.500"
					fontweight="medium"
					data-testid="order-payment.amount-total"
				>
					{formatPriceWithBath(payableAmount)}
				</ssk-text>
			</div>

			{#if showMethodTabs}
				<ssk-tabs
					id="order-payment-tabs"
					widthtab="true"
					activeIndex={activeTabIndex}
					labels={paymentMethodTabs.map((t) => t.label)}
					on:change={handleTabChange}
					on:click={handleTabClick}
					data-testid="order-payment.method-tabs"
				></ssk-tabs>
			{/if}

			{#if isCashMethod}
				<div class="payment-tab-content">
					<ssk-input
						required
						size="md"
						label={cashReceivedLabel}
						placeholder={amountPlaceholder}
						value={cashAmount}
						helperText={cashError}
						error={!!cashError}
						on:input={handleCashInput}
						disabled={status === PaymentModalStatus.Submitting}
						data-testid="order-payment.cash-amount-input"
					>
						<ssk-input-addon slot="prefix">
							<ssk-text size="md" color="gray.500">฿</ssk-text>
						</ssk-input-addon>
					</ssk-input>

					<div class="quick-actions">
						<ssk-button
							variant="outline"
							themeColor="gray"
							on:click={handleCashExact}
							data-testid="order-payment.shortcut-exact"
						>
							{exactLabel}
							{formatPriceWithBath(payableAmount)}
						</ssk-button>
						<ssk-button
							variant="outline"
							themeColor="gray"
							on:click={() => handleCashIncrement(100)}
							data-testid="order-payment.shortcut-100"
						>
							+฿100
						</ssk-button>
						<ssk-button
							variant="outline"
							themeColor="gray"
							on:click={() => handleCashIncrement(500)}
							data-testid="order-payment.shortcut-500"
						>
							+฿500
						</ssk-button>
						<ssk-button
							variant="outline"
							themeColor="gray"
							on:click={() => handleCashIncrement(1000)}
							data-testid="order-payment.shortcut-1000"
						>
							+฿1,000
						</ssk-button>
					</div>

					<div class="payment-summary-card">
						<div class="payment-summary-row">
							<ssk-text size="lg" color="gray.500">
								<ssk-i18n-translate
									key="patona-sellercenter-modal-payment-tab-cash-summary-amountreceived"
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-text>
							<ssk-text size="lg" color="gray.800" fontweight="medium">
								{formatPriceWithBath(cashNum)}
							</ssk-text>
						</div>
						<div class="payment-summary-row">
							<ssk-text size="lg" color="gray.500">
								<ssk-i18n-translate
									key="payment.cash.label.change"
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-text>
							<ssk-text
								size="lg"
								color="primary.500"
								fontweight="medium"
								data-testid="order-payment.change-amount"
							>
								{formatPriceWithBath(changeAmount)}
							</ssk-text>
						</div>
					</div>
				</div>
			{:else if isBankTransferMethod}
				<div class="payment-tab-content">
					{#if paidAmount > 0}
						<div class="order-balance-card" data-testid="order-payment.paid-summary">
							<div class="payment-summary-row">
								<ssk-text size="md" color="gray.500">{amountSentLabel}</ssk-text>
								<ssk-text size="md" color="gray.800">
									<span class="amount-medium">{formatPriceWithBath(paidAmount)}</span>
									{ofLabel}
									<span class="amount-medium">{formatPriceWithBath(totalAmount)}</span>
								</ssk-text>
							</div>
							<div class="payment-summary-row">
								<ssk-text size="md" color="gray.500">{stillOwedLabel}</ssk-text>
								<ssk-text
									size="md"
									color="primary.500"
									fontweight="bold"
									data-testid="order-payment.remaining-amount"
								>
									{formatPriceWithBath(remainingAmount)}
								</ssk-text>
							</div>
						</div>
					{/if}

					<BankTransferFields
						testIdPrefix="order-payment"
						{bankChannels}
						selectedBankId={bankSelectedId}
						onSelectBank={handleSelectBank}
						bankErrorText={bankBankMissing ? bankNoAccountSelectedText : ''}
						bankEmptyText={bankEmptyStateText}
						slipRequired={isSlipRequired}
						slipInitialPreview={bankSlipPreview}
						slipInvalidTypeError={slipInvalidText || null}
						slipTooLargeError={slipTooLargeText || null}
						onSlipChange={handleSlipChange}
						slipErrorText={bankSlipMissing ? slipRequiredText : ''}
						amountLabel={bankAmountLabel}
						{amountPlaceholder}
						amountValue={bankAmount}
						amountErrorText={bankAmountError}
						onAmountInput={handleBankAmountInput}
						amountDisabled={false}
						showExactButton={true}
						exactButtonLabel={`${exactLabel} ${formatPriceWithBath(payableAmount)}`}
						onExact={handleBankExact}
						{transferDate}
						{transferTime}
						dateErrorText={bankDateError}
						timeErrorText={bankTimeError}
						onDateInput={handleTransferDateInput}
						onTimeInput={handleTransferTimeInput}
						disabled={status === PaymentModalStatus.Submitting}
					/>
				</div>
			{/if}
		{:else if status === PaymentModalStatus.Polling}
			<div class="polling-block" data-testid="order-payment.loading">
				<ssk-spinner size="sm" color="sky"></ssk-spinner>
				<ssk-text size="md" color="gray.700">{processingText}</ssk-text>
			</div>
		{:else if status === PaymentModalStatus.Failed}
			<div class="status-block">
				<ssk-text size="xl" color="gray.800" fontweight="medium">{errorTitleText}</ssk-text>
				<ssk-text size="sm" color="gray.600">
					{#if $paymentModal.errorKey}
						<ssk-i18n-translate
							key={$paymentModal.errorKey}
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					{:else}
						{$paymentModal.error ?? tryAgainText}
					{/if}
				</ssk-text>
			</div>
		{/if}
	</div>

	<div slot="footer" class="pay-modal-footer">
		<div class="footer-row">
			<ssk-button
				variant="solid-light"
				themeColor="gray"
				width="full"
				on:click={_onClose}
				disabled={hideCloseButton}
				data-testid="order-payment.button.close"
			>
				<ssk-i18n-translate
					key="patona-sellercenter-sales-modal-clear-button-close"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-button>
			<ssk-button
				themeColor="primary"
				width="full"
				disabled={isConfirmDisabled}
				on:click={_onConfirm}
				data-testid="order-payment.button.confirm"
			>
				<ssk-i18n-translate
					key="payment.cta.confirm"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-button>
		</div>
		{#if canManagePayment && isSlipRequired}
			<ssk-button
				themeColor="primary"
				width="full"
				disabled={isConfirmDisabled}
				on:click={_onSubmitAndApprove}
				data-testid="order-payment.button.submit-and-approve"
			>
				<ssk-i18n-translate
					key="payment.cta.submit_and_approve"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-button>
		{/if}
	</div>
</ModalWithDivider>

<PartialPaymentAlertModal
	show={status === PaymentModalStatus.Partial}
	onClose={handleCloseAndOwe}
	onConfirm={handlePayRemaining}
/>

<style>
	.modal-header {
		margin-top: 0.5rem;
		padding-right: 1.5rem;
		text-align: left;
	}
	.modal-title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.pay-modal-body {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-height: min(68vh, 560px);
		overflow-y: auto;
	}

	.pay-summary {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem 1rem;
		border-bottom: 1px solid var(--ssk-colors-gray-200);
	}

	.payment-tab-content {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 16px;
	}

	.quick-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.payment-summary-card,
	.order-balance-card {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 12px;
		background-color: var(--ssk-colors-gray-50);
	}

	.payment-summary-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.amount-medium {
		font-weight: 700;
	}

	.pay-modal-footer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 16px;
		width: 100%;
		box-sizing: border-box;
	}

	.footer-row {
		display: flex;
		gap: 1rem;
		width: 100%;
	}

	.footer-row ssk-button {
		flex: 1;
	}

	.status-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2.5rem 1.5rem;
		text-align: center;
	}

	.polling-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 3rem 1.5rem;
		min-height: 200px;
		text-align: center;
	}
</style>
