<script lang="ts">
	import { getContext } from 'svelte';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import BankTransferFields from '$components/payment/BankTransferFields.svelte';
	import { toBankOptions } from '$components/payment/bank-option';
	import {
		slipModalStore,
		openSlipModal,
		closeSlipModal,
		SlipModalType
	} from '$stores/order/slip-modals';
	import { currentCompany } from '$stores/company/current-company';
	import { currentStore } from '$stores/store/current-store';
	import { formatPriceWithBath } from '$utils/format-number';
	import { withCompanyRef } from '$utils/file-url';
	import { sanitizeAmount } from '$utils/amount-input';
	import { isAxiosErrorWithStatus } from '$utils/http-error';
	import {
		getTransferValidationErrors,
		toRFC3339,
		TRANSFER_DATETIME_ERRORS
	} from '$utils/transfer-datetime';
	import {
		uploadSlipFiles,
		cleanupUploadedSlipFiles,
		type UploadedSlipFiles
	} from '$utils/slip-upload';
	import { listPaymentChannels, editPaymentDetail, storeGetOrder } from '$service/management-rest';
	import { type EditPaymentInput, toPaymentTransaction } from '$service/payment-adapter';
	import type { PaymentChannel } from '$lib/entities/payment/payment';
	import { PaymentMethod } from '$lib/entities/payment/payment-method';
	import type { UploadResult } from '$lib/entities/payment/upload';
	import type { PaymentTransaction } from '$lib/entities/payment/payment-transaction';
	import {
		waitForPaymentProjection,
		refreshWhenSettled,
		refreshOrders
	} from '$stores/order/order-refresh';
	import { currentLanguage } from '$stores/i18n';

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	export let canManagePayment = false;

	let amountLabelText = '';
	let amountRequiredText = '';
	let bankNoAccountText = '';
	let slipRequiredText = '';
	let bankEmptyStateText = '';
	let uploadFailedText = '';
	let concurrentEditText = '';

	let dtMsg: Record<string, string> = {};

	async function loadKeywords() {
		const lang = $currentLanguage.code;
		[
			amountLabelText,
			amountRequiredText,
			bankNoAccountText,
			slipRequiredText,
			bankEmptyStateText,
			uploadFailedText,
			concurrentEditText
		] = await Promise.all([
			i18nStore.get('payment.bank_transfer.label.amount', lang, 'default'),
			i18nStore.get('payment.bank_transfer.error.amount_required', lang, 'default'),
			i18nStore.get('payment.bank_transfer.error.no_account_selected', lang, 'default'),
			i18nStore.get('payment.slip.error.required', lang, 'default'),
			i18nStore.get('payment.bank_account.empty_state.message', lang, 'default'),
			i18nStore.get('payment.slip.error.upload_failed', lang, 'default'),
			i18nStore.get('payment.error.concurrent_edit', lang, 'default')
		]);
		const dtEntries = await Promise.all(
			Object.values(TRANSFER_DATETIME_ERRORS).map(
				async (key) => [key, await i18nStore.get(key, lang, 'default')] as const
			)
		);
		dtMsg = Object.fromEntries(dtEntries);
	}

	$: if ($currentLanguage.code) void loadKeywords();

	$: state = $slipModalStore;
	$: show = state.active === SlipModalType.EditPayment;
	$: payment = state.payment;
	$: order = state.order;

	let paymentChannels: PaymentChannel[] = [];

	$: bankChannels = toBankOptions(paymentChannels);

	async function loadBankChannels() {
		const companyId = $currentCompany?.id ?? '';
		const storeId = $currentStore?.id ?? '';
		if (!companyId || !storeId) return;
		try {
			const resp = await listPaymentChannels(companyId, storeId);
			paymentChannels = resp.data;
		} catch (err) {
			console.warn('[edit-payment] failed to load payment channels:', err);
			paymentChannels = [];
		}
	}

	$: if (show) {
		void loadBankChannels();
	}

	let selectedBankId = ''; // PaymentChannel row id (UI selection key)
	let amount = '';
	let transferDate = '';
	let transferTime = '';

	let slipFile: File | null = null; // freshly-selected replacement (null = unchanged)
	let slipPreview: string | null = null;
	let slipUploadError: string | null = null;
	let slipSubmitError = '';

	// Snapshot of values when the modal opens (keyed by paymentId to detect re-open).
	let snapBankId = '';
	let snapAmount = '';
	let snapDate = '';
	let snapTime = '';
	let snapPaymentId = '';

	let originalHadSlip = false;

	$: slipRequired = payment?.method === PaymentMethod.BANK_TRANSFER;

	// Pre-fill from payment whenever the modal opens.
	$: if (show && payment && payment.paymentId !== snapPaymentId) {
		snapPaymentId = payment.paymentId ?? '';

		// payment.paymentChannelId = numeric paymentId stored at submit time —
		// match against BankOption.paymentId, NOT the channel row id.
		const matchingChannel = bankChannels.find((ch) => ch.paymentId === payment?.paymentChannelId);
		selectedBankId = matchingChannel?.id ?? '';

		amount = String(payment.amount ?? '');
		const { date: parsedDate, time: parsedTime } = parseTransferAt(payment.transferAt);
		transferDate = parsedDate;
		transferTime = parsedTime;

		slipPreview =
			withCompanyRef(payment.thumbnailUrl ?? payment.fullImageUrl, $currentCompany?.id) ?? null;
		originalHadSlip = !!(payment.thumbnailUrl ?? payment.fullImageUrl);
		slipFile = null;
		slipUploadError = null;
		slipSubmitError = '';

		snapBankId = selectedBankId;
		snapAmount = amount;
		snapDate = transferDate;
		snapTime = transferTime;
	}

	// bankChannels load async — re-apply the pre-selection once they arrive.
	$: if (show && payment && bankChannels.length > 0 && selectedBankId === '' && snapBankId === '') {
		const matchingChannel = bankChannels.find((ch) => ch.paymentId === payment?.paymentChannelId);
		if (matchingChannel) {
			selectedBankId = matchingChannel.id;
			snapBankId = matchingChannel.id;
		}
	}

	// ISO string → local { date: 'YYYY-MM-DD', time: 'HH:mm' }
	function parseTransferAt(iso?: string): { date: string; time: string } {
		if (!iso) return { date: '', time: '' };
		try {
			const d = new Date(iso);
			if (isNaN(d.getTime())) return { date: '', time: '' };
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			const hours = String(d.getHours()).padStart(2, '0');
			const minutes = String(d.getMinutes()).padStart(2, '0');
			return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
		} catch {
			return { date: '', time: '' };
		}
	}

	// Validation errors come back as i18n keys — resolve through dtMsg.
	$: transferValidationErrors = getTransferValidationErrors(transferDate, transferTime);
	$: dateErrorKey = !transferDate
		? TRANSFER_DATETIME_ERRORS.dateRequired
		: transferValidationErrors.dateError ?? '';
	$: timeErrorKey = !transferTime
		? TRANSFER_DATETIME_ERRORS.timeRequired
		: transferValidationErrors.timeError ?? '';
	$: dateError = dateErrorKey ? dtMsg[dateErrorKey] ?? dateErrorKey : '';
	$: timeError = timeErrorKey ? dtMsg[timeErrorKey] ?? timeErrorKey : '';
	$: amountNum = parseFloat(amount) || 0;
	$: amountError =
		canManagePayment && (amount.trim() === '' || amountNum <= 0) ? amountRequiredText : '';
	$: bankError = !selectedBankId ? bankNoAccountText : '';

	// The edit API cannot unset a slip — missing is an error if the original had one
	// or the method requires one.
	$: slipMissing = !slipPreview && !slipFile;
	$: slipError = slipUploadError
		? slipUploadError
		: slipMissing && (originalHadSlip || slipRequired)
			? slipRequiredText
			: slipSubmitError;

	$: hasValidationError =
		!!bankError ||
		!!dateError ||
		!!timeError ||
		!!slipError ||
		(canManagePayment && !!amountError);

	$: isDirty =
		selectedBankId !== snapBankId ||
		(canManagePayment ? amount !== snapAmount : false) ||
		transferDate !== snapDate ||
		transferTime !== snapTime ||
		!!slipFile;

	let loading = false;

	function handleBankSelect(id: string) {
		selectedBankId = id;
	}

	function handleAmountInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const sanitized = sanitizeAmount(target.value);
		target.value = sanitized;
		amount = sanitized;
	}

	function handleDateInput(e: Event) {
		transferDate = (e.target as HTMLInputElement).value;
	}

	function handleTimeInput(e: Event) {
		transferTime = (e.target as HTMLInputElement).value;
	}

	function handleSlipChange(detail: UploadResult) {
		slipFile = detail.file;
		slipPreview = detail.preview;
		slipUploadError = detail.error;
		slipSubmitError = '';
	}

	function resetFormState() {
		selectedBankId = '';
		amount = '';
		transferDate = '';
		transferTime = '';
		slipFile = null;
		slipPreview = null;
		slipUploadError = null;
		slipSubmitError = '';
		originalHadSlip = false;
		snapBankId = '';
		snapAmount = '';
		snapDate = '';
		snapTime = '';
		snapPaymentId = '';
	}

	function handleCancel() {
		if (loading) return;
		if (state.order) {
			openSlipModal(SlipModalType.SlipReview, { order: state.order, payment: state.payment });
		} else {
			closeSlipModal();
		}
		resetFormState();
	}

	async function handleConfirm() {
		if (!isDirty || loading || hasValidationError) return;

		const storeId = $currentStore?.id;
		const orderId = state.order?.orderId;
		const paymentId = payment?.paymentId;
		if (!storeId || !orderId || !paymentId) return;

		// Build input with ONLY changed fields.
		// version is always sent — sukipay uses it for the optimistic lock.
		const input: EditPaymentInput = { version: payment?.version };

		if (selectedBankId !== snapBankId) {
			const selectedChannel = bankChannels.find((ch) => ch.id === selectedBankId);
			if (selectedChannel) {
				// API expects the numeric paymentId, not the channel row id.
				input.paymentChannelId = selectedChannel.paymentId;
			}
		}

		if (canManagePayment && amount !== snapAmount) {
			input.amount = amountNum;
		}

		if (transferDate !== snapDate || transferTime !== snapTime) {
			try {
				input.transferAt = toRFC3339(transferDate, transferTime);
			} catch {
				return;
			}
		}

		loading = true;

		// Replacing the slip re-points the payment at a NEW slipId — used as the settle signal.
		const originalSlipId = payment?.slipId ?? '';

		let uploadedSlip: UploadedSlipFiles | undefined;
		if (slipFile) {
			const companyId = $currentCompany?.id ?? '';
			try {
				uploadedSlip = await uploadSlipFiles(slipFile, companyId);
			} catch (err) {
				console.warn('[edit-payment] slip upload failed:', err);
				slipSubmitError =
					uploadFailedText ||
					(await i18nStore.get(
						'payment.slip.error.upload_failed',
						$currentLanguage.code,
						'default'
					));
				loading = false;
				return;
			}
			input.fullImageUrl = uploadedSlip.fullImageUrl;
			input.thumbnailUrl = uploadedSlip.thumbnailUrl;
		}

		try {
			await editPaymentDetail(storeId, orderId, paymentId, input);
			// Settled when the projection reflects every field we actually submitted.
			const isEditSettled = (txn: PaymentTransaction | undefined) => {
				if (!txn) return false;
				const p = txn.payments.find((item) => item.paymentId === paymentId);
				if (!p) return false;
				if (input.paymentChannelId !== undefined && p.paymentChannelId !== input.paymentChannelId)
					return false;
				if (input.amount !== undefined && p.amount !== input.amount) return false;
				if (input.transferAt !== undefined) {
					const a = new Date(p.transferAt ?? '').getTime();
					const b = new Date(input.transferAt).getTime();
					if (isNaN(a) || isNaN(b) || a !== b) return false;
				}
				if (input.fullImageUrl !== undefined) {
					// URL echoed back, or slipId changed (sukipay creates a new slip record).
					const urlMatches = p.fullImageUrl === input.fullImageUrl;
					const slipChanged = !!p.slipId && p.slipId !== originalSlipId;
					if (!urlMatches && !slipChanged) return false;
				}
				return true;
			};
			const freshTxn = await waitForPaymentProjection(storeId, orderId, isEditSettled);
			await refreshOrders();

			// Projection lag can exceed the blocking window — keep watching in the
			// background so the page updates without a manual reload.
			if (!isEditSettled(freshTxn)) refreshWhenSettled(storeId, orderId, isEditSettled);
			toastStore?.addToast({
				message: await i18nStore.get('payment.edit.success', $currentLanguage.code, 'default'),
				type: 'success',
				timeout: 3000
			});
			const freshPayment = freshTxn?.payments.find((p) => p.paymentId === paymentId) ?? payment;
			resetFormState();
			if (state.order) {
				openSlipModal(SlipModalType.SlipReview, { order: state.order, payment: freshPayment });
			} else {
				closeSlipModal();
			}
		} catch (err: unknown) {
			// Mutation failed — clean up the orphaned slip files we just uploaded.
			if (uploadedSlip) {
				await cleanupUploadedSlipFiles(uploadedSlip);
			}

			// 409 CONCURRENT_MODIFICATION — toast the conflict, then auto-refresh the
			// payment state and re-open the modal with fresh data so the user can retry.
			if (isConcurrentEditError(err)) {
				toastStore?.addToast({
					message:
						concurrentEditText ||
						(await i18nStore.get('payment.error.concurrent_edit', $currentLanguage.code, 'default')),
					type: 'error',
					timeout: 3000
				});
				await refreshAndReopenEdit();
				return;
			}

			toastStore?.addToast({
				message: await i18nStore.get('payment.edit.failed', $currentLanguage.code, 'default'),
				type: 'error',
				timeout: 3000
			});
		} finally {
			loading = false;
		}
	}

	/**
	 * Detect a concurrent-modification conflict from the edit API.
	 * management-backend maps sukipay's optimistic-lock failure (gRPC Aborted) to
	 * HTTP 409 — see ErrPaymentConcurrentModification.
	 */
	function isConcurrentEditError(err: unknown): boolean {
		return isAxiosErrorWithStatus(err, 409);
	}

	/**
	 * Refresh-retry after a concurrent edit: re-fetch the latest payment state, reset
	 * local form, then re-open the edit modal with fresh data so the user can retry.
	 */
	async function refreshAndReopenEdit() {
		const storeId = $currentStore?.id;
		const orderId = state.order?.orderId;
		const paymentId = payment?.paymentId;
		if (!storeId || !orderId || !paymentId) return;
		loading = true;
		try {
			const fetchedOrder = await storeGetOrder(storeId, orderId);
			await refreshOrders();
			const freshTxn = toPaymentTransaction(fetchedOrder);
			const freshPayment = freshTxn?.payments.find((p) => p.paymentId === paymentId) ?? payment;
			resetFormState();
			if (state.order) {
				openSlipModal(SlipModalType.EditPayment, { order: state.order, payment: freshPayment });
			} else {
				closeSlipModal();
			}
		} catch (err) {
			console.warn('[edit-payment] concurrent-edit retry fetch failed:', err);
			toastStore?.addToast({
				message: await i18nStore.get('payment.edit.failed', $currentLanguage.code, 'default'),
				type: 'error',
				timeout: 3000
			});
		} finally {
			loading = false;
		}
	}
</script>

<ModalWithDivider
	ShowModal={show}
	id="edit-payment"
	toggleModal={handleCancel}
	modalWidth="564px"
	bodySlotDisplay="block"
	modalPaddingBody="0px"
	hPosition="left"
>
	<div slot="title" class="modal-header">
		<div class="modal-title-row">
			<ssk-text size="2xl" color="gray.800">
				<ssk-i18n-translate
					key="payment.edit.title"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
			<ssk-text size="2xl" color="primary.500">{order?.orderSerial || '-'}</ssk-text>
		</div>
	</div>

	<div slot="body" class="pay-modal-body" data-testid="edit-payment.modal">
		<div class="pay-summary">
			<ssk-text size="xl" color="gray.800">
				<ssk-i18n-translate
					key="payment.edit.label.current_amount"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
			<ssk-text size="4xl" color="primary.500" fontweight="medium">
				{formatPriceWithBath(payment?.amount ?? 0)}
			</ssk-text>
		</div>

		<!-- No tabs: the payment method is locked when editing. -->
		<div class="payment-tab-content" data-testid="edit-payment.bank-transfer-fields">
			{#key payment?.paymentId}
				<BankTransferFields
					testIdPrefix="edit-payment"
					{bankChannels}
					{selectedBankId}
					onSelectBank={handleBankSelect}
					bankErrorText={bankError}
					bankEmptyText={bankEmptyStateText}
					{slipRequired}
					slipInitialPreview={slipPreview}
					onSlipChange={handleSlipChange}
					slipErrorText={slipError}
					amountLabel={amountLabelText}
					amountValue={amount}
					amountErrorText={amountError}
					onAmountInput={handleAmountInput}
					amountDisabled={!canManagePayment}
					showExactButton={false}
					{transferDate}
					{transferTime}
					dateErrorText={dateError}
					timeErrorText={timeError}
					onDateInput={handleDateInput}
					onTimeInput={handleTimeInput}
					disabled={loading}
				/>
			{/key}
		</div>
	</div>

	<div slot="footer" class="pay-modal-footer">
		<ssk-button
			variant="solid-light"
			themeColor="gray"
			width="full"
			disabled={loading}
			on:click={handleCancel}
			data-testid="edit-payment.button.cancel"
		>
			<ssk-i18n-translate
				key="order.payment.cancel_btn"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button
			themeColor="primary"
			width="full"
			disabled={!isDirty || loading || hasValidationError}
			on:click={handleConfirm}
			data-testid="edit-payment.button.confirm"
		>
			<ssk-i18n-translate
				key="order.payment.confirm_btn"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	</div>
</ModalWithDivider>

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

	.pay-modal-footer {
		display: flex;
		gap: 1rem;
		padding: 16px;
		width: 100%;
		box-sizing: border-box;
	}

	.pay-modal-footer ssk-button {
		flex: 1;
	}
</style>
