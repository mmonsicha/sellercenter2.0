<script lang="ts">
	import { getContext } from 'svelte';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import ConfirmModal from '$components/modal/ConfirmModal.svelte';
	import {
		slipModalStore,
		openSlipModal,
		closeSlipModal,
		SlipModalType
	} from '$stores/order/slip-modals';
	import { approvePaymentSlip } from '$service/management-rest';
	import { currentStore } from '$stores/store/current-store';
	import { SlipPaymentState } from '$lib/entities/payment/payment-transaction';
	import type { PaymentTransaction } from '$lib/entities/payment/payment-transaction';
	import {
		waitForPaymentProjection,
		refreshWhenSettled,
		refreshOrders
	} from '$stores/order/order-refresh';
	import { currentLanguage } from '$stores/i18n';

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	let titleText = '';
	let descPrefixText = '';
	let descSuffixText = '';

	async function loadKeywords() {
		const lang = $currentLanguage.code;
		[titleText, descPrefixText, descSuffixText] = await Promise.all([
			i18nStore.get('order.payment.approve_btn', lang, 'default'),
			i18nStore.get('order.payment.approve_confirm_desc_prefix', lang, 'default'),
			i18nStore.get('order.payment.approve_confirm_desc_suffix', lang, 'default')
		]);
	}

	$: if ($currentLanguage.code) void loadKeywords();

	let loading = false;

	$: state = $slipModalStore;
	$: show = state.active === SlipModalType.ApprovePaymentConfirm;

	function handleCancel() {
		if (loading) return;
		if (state.order) {
			openSlipModal(SlipModalType.SlipReview, { order: state.order, payment: state.payment });
		} else {
			closeSlipModal();
		}
	}

	async function handleConfirm() {
		if (loading) return;
		const storeId = $currentStore?.id;
		const orderId = state.order?.orderId;
		const paymentId = state.payment?.paymentId;
		if (!storeId || !orderId || !paymentId) return;
		loading = true;
		try {
			await approvePaymentSlip(storeId, orderId, paymentId);

			// Poll until the payments-task projection reflects the approval.
			// Tolerate projection rewrites — payment gone OR marked COMPLETED.
			const isApproved = (txn: PaymentTransaction | undefined) => {
				if (!txn) return false;
				const p = txn.payments.find((item) => item.paymentId === paymentId);
				return !p || p.paymentState === SlipPaymentState.COMPLETED;
			};
			const lastTxn = await waitForPaymentProjection(storeId, orderId, isApproved);
			await refreshOrders();

			// Projection lag (Kafka → OMS) can exceed the blocking window — keep watching
			// in the background so the page updates without a manual reload (F5).
			if (!isApproved(lastTxn)) refreshWhenSettled(storeId, orderId, isApproved);
			toastStore?.addToast({
				message: await i18nStore.get(
					'order.payment.approve_success',
					$currentLanguage.code,
					'default'
				),
				type: 'success',
				timeout: 3000
			});
			closeSlipModal();
		} catch (e) {
			toastStore?.addToast({
				message: await i18nStore.get(
					'order.payment.approve_failed',
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

<ConfirmModal
	{show}
	onClose={handleCancel}
	icon="outline-check-circle"
	iconColor="#059669"
	title={titleText}
>
	<ssk-text size="md" slot="description" data-testid="approve-confirm.modal">
		{descPrefixText}
		<span class="status-paid">
			<ssk-i18n-translate
				key="payment.status.paid"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</span>
		{descSuffixText}
	</ssk-text>
	<ssk-button
		width="full"
		slot="footer-left"
		variant="outline"
		disabled={loading}
		on:click={handleCancel}
		data-testid="approve-confirm.button.cancel"
	>
		<ssk-i18n-translate
			key="order.payment.cancel_btn"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button
		width="full"
		slot="footer-right"
		variant="solid"
		themeColor="primary"
		disabled={loading}
		on:click={handleConfirm}
		data-testid="approve-confirm.button.confirm"
	>
		<ssk-i18n-translate
			key="order.payment.confirm_btn"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</ConfirmModal>

<style>
	.status-paid {
		color: #059669;
		font-weight: 600;
	}
</style>
