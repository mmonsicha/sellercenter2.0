<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import ConfirmModal from '$components/modal/ConfirmModal.svelte';
	import { deliverModalStore, closeDeliverModal } from '$stores/order/deliver-modal';
	import { updateState } from '$stores/order/order';
	import { currentStore } from '$stores/store/current-store';
	import { currentLanguage } from '$stores/i18n';
	import { refreshOrders } from '$stores/order/order-refresh';
	import { mapOrderStateForDeliveryCompleteByFlow } from '$utils/utils-order';

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	let titleText = '';
	let successText = '';
	let failText = '';

	async function loadKeywords() {
		const lang = $currentLanguage.code;
		const fallback = 'default';
		[titleText, successText, failText] = await Promise.all([
			i18nStore.get(
				'patona-sellercenter-orderdetail-modal-deliver-title-confirmation',
				lang,
				fallback
			),
			i18nStore.get('patona-sellercenter-orderdetail-toast-deliver-success', lang, fallback),
			i18nStore.get('patona-sellercenter-orderdetail-toast-deliver-fail', lang, fallback)
		]);
	}

	$: if ($currentLanguage.code) void loadKeywords();

	let loading = false;

	$: order = $deliverModalStore.order;
	$: show = !!order;

	function handleCancel() {
		if (loading) return;
		closeDeliverModal();
	}

	// Reset the shared store on unmount so a stale {order} doesn't auto-reopen the
	// modal when the list page remounts (e.g. open → browser-back → return to /order).
	onDestroy(() => closeDeliverModal());

	async function handleConfirm() {
		if (loading) return;
		const storeId = $currentStore?.id;
		const orderId = order?.orderId;
		if (!storeId || !orderId) return;
		const newState = mapOrderStateForDeliveryCompleteByFlow(order?.flow.type ?? '');
		if (!newState) {
			console.error('[deliver] unknown flow type, cannot map delivery state:', order?.flow.type);
			toastStore?.addToast({ message: failText, type: 'error', timeout: 3000 });
			return;
		}
		loading = true;
		try {
			await updateState(storeId, orderId, newState);
			await refreshOrders();
			toastStore?.addToast({ message: successText, type: 'success', timeout: 3000 });
			closeDeliverModal();
		} catch (e) {
			toastStore?.addToast({ message: failText, type: 'error', timeout: 3000 });
		} finally {
			loading = false;
		}
	}
</script>

<ConfirmModal
	{show}
	onClose={handleCancel}
	icon="outline-exclamation-circle"
	iconColor="#d97706"
	title={titleText}
>
	<ssk-button
		width="full"
		slot="footer-left"
		variant="outline"
		themeColor="gray"
		disabled={loading}
		on:click={handleCancel}
		data-testid="deliver-confirm.button.cancel"
	>
		<ssk-i18n-translate
			key="patona-sellercenter-orderdetail-modal-button-cancel"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button
		width="full"
		slot="footer-right"
		disabled={loading}
		on:click={handleConfirm}
		data-testid="deliver-confirm.button.confirm"
	>
		<ssk-i18n-translate
			key="patona-sellercenter-orderdetail-modal-button-confirm"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</ConfirmModal>
