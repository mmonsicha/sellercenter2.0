<script lang="ts">
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import Payment from '$components/payment/Payment.svelte';
	import { currentLanguage } from '$stores/i18n';
	import { orderData, updateState } from '$stores/order/order';
	import { currentStore } from '$stores/store/current-store';
	import { FullfilmentType, OrderFlow, Status } from '$lib/entities/order/order';
	import { validationSchema as validatePaymentForm } from '$utils/form-validation/payment-form';

	import { ClearAllItem } from '$stores/cart/cart';
	import {
		clearPayment,
		makeAttributesPayment,
		paymentInfo,
		showPaymentModal,
		togglePaymentModal,
		updateTaskInfoAndPaymentAmount
	} from '$stores/payment';
	import {
		getDefaultOnlinePrinter,
		printerConfig,
		refreshPairedPrintersStatus
	} from '$stores/thermal-printer';
	import { openModal } from '$stores/sales/modals';
	import { setSelectedPrinter } from '$stores/sales/selected-printer';

	export let fullfilmentType: string = FullfilmentType.PickupImmediate;
	export let isPaymentValid: boolean = false;
	export let onPrint: () => void;

	let isPaymentProcessing: boolean = false;

	async function cancelOrder(state: string) {
		await updateState($currentStore.id!, $orderData.orderId!, state);
		clearPayment();
		togglePaymentModal($showPaymentModal);
	}

	const getDeliveryStatus = () => {
		if ($orderData.flow?.type !== OrderFlow.POS_OFFLINE_DELIVERY_LATER) return Status.Completed;
		return fullfilmentType === FullfilmentType.PickupImmediate
			? Status.Completed
			: Status.Processing;
	};

	const _onOkPayment = async () => {
		if (!isPaymentValid || isPaymentProcessing) return;
		isPaymentProcessing = true;

		try {
			let isValid = await validatePaymentForm($paymentInfo);
			if (!isValid) return;
			$orderData.buyerStatement = {
				...$orderData.buyerStatement,
				receivedAmount: $paymentInfo.received
			};
			$orderData.paymentType = $paymentInfo.type;
			let attributes = makeAttributesPayment($paymentInfo);

			await updateTaskInfoAndPaymentAmount(
				$currentStore.id!,
				$orderData.orderId!,
				attributes,
				$orderData,
				Status.Completed,
				getDeliveryStatus()
			);

			$printerConfig.pairedPrinters = await refreshPairedPrintersStatus(
				$printerConfig.pairedPrinters
			);

			const defaultPrinter = getDefaultOnlinePrinter();
			setSelectedPrinter(defaultPrinter);

			if (defaultPrinter?.online) {
				if ($printerConfig.autoPrint) {
					onPrint();
					openModal('simplified-payment-success-with-printer-detail');
				} else {
					openModal('payment-success');
				}
			} else {
				openModal('simplified-payment-success-with-printer-detail');
			}

			togglePaymentModal($showPaymentModal);
			ClearAllItem();
			clearPayment();
		} catch {
		} finally {
			isPaymentProcessing = false;
		}
	};
</script>

<ModalWithDivider
	toggleModal={async () => await cancelOrder('canceled')}
	id="select-method-payment"
	ShowModal={$showPaymentModal}
	hPosition="left"
	modalWidth="40vw"
	modalPaddingBody="0px"
>
	<div slot="title">
		<ssk-text size="2xl">
			<ssk-i18n-translate
				key="patona-sellercenter-sales-modal-payment-title-order"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
			<span>{$orderData.orderSerial}</span>
		</ssk-text>
	</div>
	<div class="modal-payment-body" slot="body">
		{#if $showPaymentModal}
			<Payment info={$paymentInfo} />
		{/if}
	</div>
	<div class="modal-payment-footer" slot="footer">
		<ssk-button
			variant="outline"
			themeColor="gray"
			on:click={async () => await cancelOrder('canceled')}
		>
			<ssk-i18n-translate
				key="patona-sellercenter-sales-modal-payment-button-back"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button on:click={_onOkPayment} disabled={!isPaymentValid || isPaymentProcessing}>
			<ssk-i18n-translate
				key="patona-sellercenter-sales-modal-payment-button-confirm"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	</div>
</ModalWithDivider>

<style>
	ssk-text > span {
		color: var(--ssk-colors-primary-500);
	}

	.modal-payment-body {
		width: 100%;
	}

	.modal-payment-footer {
		width: 100%;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
</style>
