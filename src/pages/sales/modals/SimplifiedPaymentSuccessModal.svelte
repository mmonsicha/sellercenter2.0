<script lang="ts">
	import Modal from '$components/modal/Modal.svelte';
	import { activeModal, closeModal, toggleActiveModal } from '$stores/sales/modals';
	import { selectedPrinter } from '$stores/sales/selected-printer';
	import { getDefaultOnlinePrinter, getAnotherOnlinePrinter } from '$stores/thermal-printer';

	import FooterSimplefiedModal from './components/FooterSimplefiedModal.svelte';
	import PrinterDetail from './components/PrinterDetail.svelte';
	import { beforeUpdate } from 'svelte';

	let labelPaymentSuccess: string = '';
	let showModalWithPrinterDetail: boolean = false;
	let showModal: boolean = false;
	let anotherOnlinePrinter: boolean = false;

	$: showModalWithPrinterDetail = $activeModal === 'simplified-payment-success-with-printer-detail';
	$: showModal = $activeModal === 'simplified-payment-success';

	function toggleWithDetailModal() {
		toggleActiveModal('simplified-payment-success-with-printer-detail');
	}

	function toggleModal() {
		toggleActiveModal('simplified-payment-success');
	}

	function handleClose() {
		closeModal();
	}

	beforeUpdate(() => {
		anotherOnlinePrinter = !!(!getDefaultOnlinePrinter() && getAnotherOnlinePrinter());
	});

	$: {
		if (!$selectedPrinter) {
			labelPaymentSuccess = 'ชำระเงินสำเร็จ';
		} else {
			labelPaymentSuccess = 'ชำระเงิน และ พิมพ์ใบเสร็จสำเร็จ';
		}
	}

	$: modalProps = {
		icon: 'outline-check-circle',
		iconColor: '#059669',
		typeFooter: 'vertical' as const,
		title: labelPaymentSuccess
	};
</script>

<Modal
	ShowModal={showModalWithPrinterDetail}
	toggleModal={toggleWithDetailModal}
	id="simplified-payment-success-with-printer-detail"
	{...modalProps}
>
	<div slot="body">
		{#if anotherOnlinePrinter}
			<PrinterDetail isChangedSetting />
		{:else}
			<PrinterDetail />
		{/if}
	</div>

	<div slot="modal-footer-left">
		<FooterSimplefiedModal _onClose={handleClose} />
	</div>
</Modal>

<Modal {toggleModal} ShowModal={showModal} id="simplified-payment-success" {...modalProps}>
	<div slot="modal-footer-left">
		<FooterSimplefiedModal _onClose={handleClose} />
	</div>
</Modal>
