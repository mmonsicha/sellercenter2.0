<script lang="ts">
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import { i18nKW } from '$stores/i18n';

	// Shown instead of the cancel flow when the order still has a payment slip
	// awaiting review (see $utils/cancel-order → hasUnderReviewPayment). Centered
	// warning notice, no close (X), no divider. `ยกเลิก` dismisses; `ตกลง` sends the
	// user to the pending payment(s) to resolve them.
	export let show: boolean;
	export let onClose: () => void;
	export let onGoToPayments: (() => void) | undefined = undefined;

	// Reactive keyword lookup ($i18nKW = app-wide patona keyword map, bulk-loaded at
	// startup and re-derived on language change; falls back to the key if missing).
	$: title = $i18nKW['patona-sellercenter-orderdetail-modal-cannot-cancel-title'];
	$: body = $i18nKW['patona-sellercenter-orderdetail-modal-cannot-cancel-body'];
	$: cancelLabel = $i18nKW['patona-sellercenter-orderdetail-modal-button-cancel'];
	$: okLabel = $i18nKW['patona-sellercenter-orderdetail-modal-cannot-cancel-ok'];

	function handleClose() {
		onClose();
	}

	function handleConfirm() {
		onClose();
		// Defer until the modal has closed (and released any body-scroll lock) so the
		// smooth scroll to the payment-evidence section isn't swallowed.
		if (onGoToPayments) requestAnimationFrame(onGoToPayments);
	}
</script>

<ModalWithDivider
	id="cannot-cancel-order"
	ShowModal={show}
	toggleModal={handleClose}
	hideCloseButton={true}
	hideDivider={true}
	icon="outline-exclamation-circle"
	iconColor="#EC5E2A"
	modalWidth="400px"
>
	<div slot="title">
		<ssk-text size="xl" fontWeight="medium" color="gray.800">{title}</ssk-text>
	</div>

	<div slot="body" class="cannot-cancel-body">
		<ssk-text size="md" color="gray.500">{body}</ssk-text>
	</div>

	<div slot="footer" class="cannot-cancel-footer">
		<ssk-button
			variant="outline"
			themeColor="gray"
			width="full"
			on:click={handleClose}
			data-testid="cannot-cancel-order.button.cancel"
		>
			<span>{cancelLabel}</span>
		</ssk-button>
		<ssk-button
			width="full"
			on:click={handleConfirm}
			data-testid="cannot-cancel-order.button.confirm"
		>
			<span>{okLabel}</span>
		</ssk-button>
	</div>
</ModalWithDivider>

<style>
	.cannot-cancel-body {
		width: 100%;
		text-align: center;
		padding: 0 8px 8px;
	}

	.cannot-cancel-footer {
		display: grid;
		width: 100%;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
</style>
