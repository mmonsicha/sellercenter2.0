<script lang="ts">
	import { getContext } from 'svelte';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import {
		slipModalStore,
		openSlipModal,
		closeSlipModal,
		SlipModalType
	} from '$stores/order/slip-modals';
	import { RejectReason, SlipPaymentState } from '$lib/entities/payment/payment-transaction';
	import { rejectPaymentSlip } from '$service/management-rest';
	import { currentStore } from '$stores/store/current-store';
	import type { PaymentTransaction } from '$lib/entities/payment/payment-transaction';
	import {
		waitForPaymentProjection,
		refreshWhenSettled,
		refreshOrders
	} from '$stores/order/order-refresh';
	import { currentLanguage } from '$stores/i18n';

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	const REJECT_REASON_LABEL_KEYS: Record<RejectReason, string> = {
		[RejectReason.WRONG_AMOUNT]: 'payment.reject_reason.wrong_amount',
		[RejectReason.WRONG_ACCOUNT]: 'payment.reject_reason.wrong_account',
		[RejectReason.DUPLICATE_PAYMENT]: 'payment.reject_reason.duplicate_payment',
		[RejectReason.SLIP_UNREADABLE]: 'payment.reject_reason.slip_unreadable',
		[RejectReason.SLIP_FRAUDULENT]: 'payment.reject_reason.slip_fraudulent',
		[RejectReason.OTHER]: 'payment.reject_reason.other'
	};

	let reasonLabels: Partial<Record<RejectReason, string>> = {};

	async function loadKeywords() {
		const lang = $currentLanguage.code;
		const entries = await Promise.all(
			Object.entries(REJECT_REASON_LABEL_KEYS).map(
				async ([reason, key]) => [reason, await i18nStore.get(key, lang, 'default')] as const
			)
		);
		reasonLabels = Object.fromEntries(entries);
	}

	$: if ($currentLanguage.code) void loadKeywords();

	$: reasonGroup = {
		defaultValue: [] as string[],
		options: Object.keys(REJECT_REASON_LABEL_KEYS).map((value) => ({
			label: reasonLabels[value as RejectReason] ?? '',
			value
		}))
	};

	let selectedReason: RejectReason | undefined;
	let note = '';
	let loading = false;

	$: state = $slipModalStore;
	$: show = state.active === SlipModalType.RejectPayment;
	$: isOther = selectedReason === RejectReason.OTHER;
	$: canConfirm = !!selectedReason && (!isOther || note.trim().length > 0);

	function readValue(e: Event): string | undefined {
		const orig = (e as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent ?? e;
		return (orig.target as HTMLInputElement | HTMLTextAreaElement | null)?.value;
	}

	function handleReasonChange(e: Event) {
		const v = readValue(e);
		if (v) selectedReason = v as RejectReason;
	}

	function handleNoteChange(e: Event) {
		note = readValue(e) ?? '';
	}

	function handleCancel() {
		if (loading) return;
		if (state.order) {
			openSlipModal(SlipModalType.SlipReview, { order: state.order, payment: state.payment });
		} else {
			closeSlipModal();
		}
		selectedReason = undefined;
		note = '';
	}

	async function handleConfirm() {
		if (!canConfirm || loading) return;
		const storeId = $currentStore?.id;
		const orderId = state.order?.orderId;
		const paymentId = state.payment?.paymentId;
		if (!storeId || !orderId || !paymentId) return;
		loading = true;
		try {
			await rejectPaymentSlip(
				storeId,
				orderId,
				paymentId,
				selectedReason!,
				isOther ? note.trim() : undefined
			);

			// Poll until the payments-task projection reflects the rejection.
			// OMS may remove the payment entirely on reject,
			// so "payment no longer present" also counts as settled.
			const isRejected = (txn: PaymentTransaction | undefined) => {
				if (!txn) return false;
				const p = txn.payments.find((item) => item.paymentId === paymentId);
				// Payment gone (OMS removed it) OR explicitly marked as rejected.
				return !p || p.paymentState === SlipPaymentState.REJECTED;
			};
			const lastTxn = await waitForPaymentProjection(storeId, orderId, isRejected);
			await refreshOrders();

			// Projection lag (Kafka → OMS) can exceed the blocking window — keep watching
			// in the background so the page updates without a manual reload (F5).
			if (!isRejected(lastTxn)) refreshWhenSettled(storeId, orderId, isRejected);
			toastStore?.addToast({
				message: await i18nStore.get(
					'order.payment.reject_success',
					$currentLanguage.code,
					'default'
				),
				type: 'success',
				timeout: 3000
			});
			selectedReason = undefined;
			note = '';
			closeSlipModal();
		} catch (e) {
			toastStore?.addToast({
				message: await i18nStore.get(
					'order.payment.reject_failed',
					$currentLanguage.code,
					'default'
				),
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
	id="reject-payment"
	toggleModal={handleCancel}
	modalWidth="440px"
	hPosition="left"
>
	<span slot="title">
		<ssk-text size="2xl">
			<ssk-i18n-translate
				key="order.payment.reject_btn"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
	</span>

	<div slot="body" class="modal-body" data-testid="reject-payment.modal">
		<div class="field-label">
			<ssk-text size="lg">
				<ssk-i18n-translate
					key="order.payment.reject_reason_label"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
			<ssk-text size="lg" color="danger">*</ssk-text>
		</div>

		{#key show}
			<ssk-radio-group
				noIndent={true}
				group={reasonGroup}
				on:change={handleReasonChange}
				data-testid="reject-payment.reason-group"
			></ssk-radio-group>
		{/key}

		{#if isOther}
			<div class="note-section">
				<div class="field-label">
					<ssk-text size="sm" color="gray.800">
						<ssk-i18n-translate
							key="payment.reject_reason.note_label"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>
					<ssk-text size="sm" color="danger">*</ssk-text>
				</div>

				<ssk-textarea
					value={note}
					limit={200}
					rows={3}
					placeholder=""
					on:input={handleNoteChange}
					on:change={handleNoteChange}
					data-testid="reject-payment.note"
				></ssk-textarea>
			</div>
		{/if}
	</div>

	<div slot="footer" class="modal-footer">
		<ssk-button
			variant="outline"
			disabled={loading}
			on:click={handleCancel}
			data-testid="reject-payment.button.cancel"
		>
			<ssk-i18n-translate
				key="order.payment.cancel_btn"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button
			variant="solid"
			themeColor="danger"
			disabled={!canConfirm || loading}
			on:click={handleConfirm}
			data-testid="reject-payment.button.confirm"
		>
			<ssk-i18n-translate
				key="order.payment.reject_confirm_btn"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	</div>
</ModalWithDivider>

<style>
	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 8px 0;
		width: 100%;
	}

	.field-label {
		display: flex;
		align-items: baseline;
		gap: 2px;
		margin-bottom: 4px;
	}

	.note-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 16px;
		align-items: center;
	}
</style>
