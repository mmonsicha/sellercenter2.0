<script lang="ts">
	import { PaymentType, SaleChannelType, type Task } from '$lib/entities/order/order';
	import { currentLanguage } from '$stores/i18n';
	import { orderData, shippingFee } from '$stores/order/order';
	import { formatPrice } from '$utils/format-number';
	import { findPaymentLabelBySaleOrigin, marketplaceValues } from '$utils/utils-order';
	import { paymentTypeDetailI18nKey } from '$utils/i18n-keys';

	let paymentTask: Task | undefined = undefined;

	$: paymentTask = $orderData.orderId
		? $orderData.tasks?.find((t) => t.name === 'payments') ?? undefined
		: undefined;
</script>

{#if $orderData.orderId}
	<div class="container">
		<div class="changed-summary">
			<div class="item">
				<div class="label">
					<ssk-text color="gray.500">
						<ssk-i18n-translate
							key="patona-sellercenter-orderdetail-title-paymentmethod"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>
				</div>
				<div class="value">
					<ssk-text>
						{#if $orderData.saleChannel?.saleOrigin && marketplaceValues.includes($orderData.saleChannel.saleOrigin)}
							{findPaymentLabelBySaleOrigin($orderData.saleChannel.saleOrigin)}
						{:else}
							<ssk-i18n-translate
								key={paymentTypeDetailI18nKey($orderData.paymentType)}
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						{/if}
					</ssk-text>
				</div>
			</div>
			{#if $orderData.paymentType === PaymentType.Cash}
				<div class="item">
					<div class="label">
						<ssk-text color="gray.500">
							<ssk-i18n-translate
								key="patona-sellercenter-orderdetail-title-amountreceive"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
					</div>
					<div class="value">
						<ssk-text>฿ {formatPrice($orderData.buyerStatement.receivedAmount ?? 0)}</ssk-text>
					</div>
				</div>
				<div class="item">
					<div class="label">
						<ssk-text color="gray.500">
							<ssk-i18n-translate
								key="patona-sellercenter-orderdetail-title-change"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
					</div>
					<div class="value">
						<ssk-text
							>฿ {formatPrice(
								($orderData.buyerStatement.receivedAmount ?? 0) -
									(($orderData.buyerStatement.netPrice ?? 0) + $shippingFee)
							)}</ssk-text
						>
					</div>
				</div>
			{:else if paymentTask && $orderData.saleChannel?.type === SaleChannelType.Offline}
				<div class="item">
					<div class="label">
						<ssk-text color="gray.500">
							<ssk-i18n-translate
								key="patona-sellercenter-orderdetail-title-refcode"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
					</div>
					<div class="value">
						<ssk-text
							>{paymentTask.attributes?.payment_ref
								? paymentTask.attributes.payment_ref
								: '-'}</ssk-text
						>
					</div>
				</div>
				<div class="item">
					<div class="label">
						<ssk-text color="gray.500">
							<ssk-i18n-translate
								key="patona-sellercenter-orderdetail-title-note"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
					</div>
					<div class="value">
						<ssk-text
							>{paymentTask.attributes?.payment_note
								? paymentTask.attributes?.payment_note
								: '-'}</ssk-text
						>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.container {
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		padding: 1.5rem;
		display: grid;
		gap: 0.5rem;
	}

	.changed-summary {
		display: grid;
		gap: 1rem;
	}

	.value {
		overflow-wrap: anywhere;
		white-space: normal;
	}
</style>
