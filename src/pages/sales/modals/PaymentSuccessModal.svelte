<script lang="ts">
	import Modal from '$components/modal/Modal.svelte';
	import { currentLanguage } from '$stores/i18n';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import PrinterDetail from './components/PrinterDetail.svelte';
	import { activeModal, closeModal, openModal, toggleActiveModal } from '$stores/sales/modals';

	export let onPrint: () => void;
	const i18nStore = getContext<I18nStore>('i18n');

	let labelPaymentSuccess = '';
	let show: boolean = false;
	$: show = $activeModal === 'payment-success';

	function togglePaymentSuccessModal() {
		toggleActiveModal('payment-success');
	}

	function handlePrintClick() {
		onPrint();
		openModal('simplified-payment-success');
	}

	const loadKeywords = async () => {
		const lang = $currentLanguage.code;
		const fallback = 'default';

		labelPaymentSuccess = await i18nStore.get(
			'patona-sellercenter-sales-modal-success-title-paymentsuccessful',
			lang,
			fallback
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

<Modal
	toggleModal={() => togglePaymentSuccessModal()}
	id="payment-success"
	icon="outline-check-circle"
	iconColor="#059669"
	ShowModal={show}
	title={labelPaymentSuccess}
>
	<div slot="body">
		<PrinterDetail isChangedSetting />
	</div>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={async () => {
			closeModal();
		}}
	>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-success-button-back"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button width="full" slot="modal-footer-right" on:click={handlePrintClick}>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-success-button-printreceipt"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</Modal>
