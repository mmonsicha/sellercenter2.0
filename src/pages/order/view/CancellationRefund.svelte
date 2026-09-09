<script lang="ts">
	import {
		getCancellationRefund,
		refundStatusTheme,
		RefundStatus
	} from '$lib/entities/order/cancellation-refund';
	import { orderData } from '$stores/order/order';
	import { i18nKW } from '$stores/i18n';
	import { PaymentMethod, PAYMENT_METHOD_LABEL_KEYS } from '$lib/entities/payment/payment-method';
	import { formatDateWithTime } from '$utils/format-date';
	import { formatPrice } from '$utils/format-number';
	import { CANCEL_REASON_LABEL_KEYS } from '$utils/cancel-order';
	import { toPaymentTransaction } from '$service/payment-adapter';

	// refund method → i18n key. Refund-specific wording for the methods that actually
	// produce refunds (cash / transfer); other methods fall back to the shared payment-
	// method label, then to a generic "refund" for any unknown method string.
	const REFUND_METHOD_KEYS: Partial<Record<PaymentMethod, string>> = {
		[PaymentMethod.CASH]: 'patona-sellercenter-orderdetail-refund-method-cash',
		[PaymentMethod.BANK_TRANSFER]: 'patona-sellercenter-orderdetail-refund-method-transfer',
		[PaymentMethod.BANK_TRANSFER_OFFLINE]: 'patona-sellercenter-orderdetail-refund-method-transfer'
	};
	// Refund-status badge → shared payment-status i18n keys (payment.status.*).
	// Same states, same wording as the payment-status badge; no order-detail-specific
	// duplicates (values identical, so one canonical key per status — see PAT-2038).
	const REFUND_STATUS_KEYS: Record<RefundStatus, string> = {
		[RefundStatus.Refunded]: 'payment.status.refunded',
		[RefundStatus.Voided]: 'payment.status.voided',
		[RefundStatus.Pending]: 'payment.status.refund_pending',
		[RefundStatus.Rejected]: 'payment.status.refund_rejected'
	};

	// "Other" reason codes (OMS remark `other` + SukiPay enum `OTHER`): the localized label
	// is just "อื่นๆ", so when the user typed a free-text note we show that note instead.
	const OTHER_REASON_CODES = new Set(['other', 'OTHER']);

	$: txn = $orderData.orderId ? toPaymentTransaction($orderData) : undefined;
	$: info = $orderData.orderId ? getCancellationRefund($orderData, txn) : undefined;
	// Reference $i18nKW directly so labels re-render on language change (reactive).
	$: reasonKey = info?.reasonCode ? CANCEL_REASON_LABEL_KEYS[info.reasonCode] : undefined;
	$: reasonLabel = reasonKey ? $i18nKW[reasonKey] : '';
	// Reason shown to the seller: the free-text note for an "other" cancel, else the label.
	$: reasonDisplay =
		info?.reasonCode && OTHER_REASON_CODES.has(info.reasonCode) && info?.note
			? info.note
			: reasonLabel;
	// $i18nKW referenced inside so the fn is re-created on language change → template stays reactive.
	$: refundMethodLabel = (method: string): string => {
		const key =
			REFUND_METHOD_KEYS[method as PaymentMethod] ??
			PAYMENT_METHOD_LABEL_KEYS[method as PaymentMethod];
		return key ? $i18nKW[key] : 'คืนเงิน';
	};
</script>

{#if info}
	<ssk-text size="xl">{$i18nKW['patona-sellercenter-orderdetail-cancel-title']}</ssk-text>

	<!-- reason card -->
	{#if reasonDisplay || info.byName}
		<div class="container" data-testid="order.cancellation-refund.reason">
			{#if reasonDisplay}
				<div class="item">
					<ssk-text color="gray.500"
						>{$i18nKW['patona-sellercenter-orderdetail-cancel-reason-label']}</ssk-text
					>
					<ssk-text>{reasonDisplay}</ssk-text>
				</div>
			{/if}
			{#if info.byName}
				<div class="item">
					<ssk-text color="gray.500">{$i18nKW['patona-sellercenter-orderdetail-cancel-by-label']}</ssk-text>
					<ssk-text>{info.byName}</ssk-text>
				</div>
			{/if}
		</div>
	{/if}

	<!-- refund cards (one per payment method that was refunded / pending) -->
	{#each info.refunds as refund, idx (refund.paymentId ?? idx)}
		<div class="container refund" data-testid={`order.cancellation-refund.card.${idx}`}>
			<ssk-text color="gray.500">{refundMethodLabel(refund.method)}</ssk-text>
			<div class="amount-row">
				<ssk-text size="xl" themeColor="black">฿{formatPrice(refund.amount)}</ssk-text>
				<span class="badge" data-testid={`order.cancellation-refund.badge.${idx}`}>
					<ssk-badge variant="subtle" size="md" themecolor={refundStatusTheme(refund.status)}>
						{$i18nKW[REFUND_STATUS_KEYS[refund.status]]}
					</ssk-badge>
				</span>
			</div>
			{#if (refund.status === RefundStatus.Refunded || refund.status === RefundStatus.Voided) && refund.refundedAt}
				<ssk-text size="lg" color="gray.500">{formatDateWithTime(refund.refundedAt)}</ssk-text>
			{/if}
		</div>
	{/each}
{/if}

<style>
	.container {
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		padding: 1.5rem;
		display: grid;
		gap: 1rem;
	}

	.item {
		display: grid;
		gap: 0.25rem;
	}

	.refund {
		gap: 0.5rem;
	}

	.amount-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.badge {
		flex-shrink: 0;
	}
</style>
