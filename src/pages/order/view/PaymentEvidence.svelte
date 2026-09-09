<script lang="ts">
	import { currentCompany } from '$stores/company/current-company';
	import { i18nKW } from '$stores/i18n';
	import { orderData } from '$stores/order/order';
	import {
		SlipPaymentState,
		isForwardPayment,
		type PaymentItem
	} from '$lib/entities/payment/payment-transaction';
	import { slipStatusI18nKey, paymentMethodI18nKey } from '$utils/i18n-keys';
	import { slipStatusTheme } from '$utils/utils-order';
	import { toPaymentTransaction } from '$service/payment-adapter';
	import { withCompanyRef } from '$utils/file-url';
	import { PaymentMethod } from '$lib/entities/payment/payment-method';
	import { openSlipModal, SlipModalType, SlipModalMode } from '$stores/order/slip-modals';
	import { formatDateWithTime } from '$utils/format-date';
	import { formatPrice } from '$utils/format-number';

	// patona.order.payment.manage — without it the ตรวจสอบ button is disabled
	export let canManagePayment = false;

	$: txn = $orderData.orderId ? toPaymentTransaction($orderData) : undefined;
	$: payments = (txn?.payments ?? []).filter(isForwardPayment);

	const isCash = (p: PaymentItem) => p.method === PaymentMethod.CASH;

	const paidAt = (p: PaymentItem) => p.transferAt ?? p.paymentStateChangedAt ?? p.createdAt;

	function openView(p: PaymentItem) {
		if (!p.fullImageUrl) return;
		openSlipModal(SlipModalType.SlipReview, {
			order: $orderData,
			payment: p,
			mode: SlipModalMode.View
		});
	}

	function openReview(p: PaymentItem) {
		openSlipModal(SlipModalType.SlipReview, { order: $orderData, payment: p });
	}
</script>

{#if $orderData.orderId && payments.length > 0}
	<div class="evidence-section">
		<ssk-text size="xl">{$i18nKW['order.payment.evidence_title']}</ssk-text>

		<div class="cards">
			{#each payments as p, idx (p.paymentId ?? idx)}
				<div class="card" data-testid={`order.payment-evidence.card.${idx}`}>
					<!-- payment method label — full-width header above the payment row -->
					<ssk-text size="lg" color="gray.500">{$i18nKW[paymentMethodI18nKey(p.method)]}</ssk-text>

					<div class="info">
						{#if !isCash(p)}
							<div
								class="thumb"
								class:clickable={!!p.fullImageUrl}
								role={p.fullImageUrl ? 'button' : undefined}
								tabindex={p.fullImageUrl ? 0 : undefined}
								on:click={() => openView(p)}
								on:keydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										openView(p);
									}
								}}
								data-testid={`order.payment-evidence.thumb.${idx}`}
							>
								{#if p.thumbnailUrl}
									<ssk-image
										src={withCompanyRef(p.thumbnailUrl, $currentCompany?.id)}
										fallbackSrc="/images/default-image.png"
										width="48px"
										height="48px"
										objectFit="cover"
										rounded="sm"
									></ssk-image>
								{:else}
									<ssk-image
										src="/images/default-image.png"
										fallbackSrc="/images/default-image.png"
										width="48px"
										height="48px"
										objectFit="cover"
										rounded="sm"
									></ssk-image>
								{/if}
							</div>
						{/if}
						<div class="detail">
							<ssk-text size="xl" themeColor="black">
								฿{formatPrice(p.amount ?? 0)}
							</ssk-text>
							<ssk-text size="lg" color="gray.500">
								{paidAt(p) ? formatDateWithTime(paidAt(p) ?? '') : '-'}
							</ssk-text>
						</div>
						{#if p.paymentState && p.paymentState !== SlipPaymentState.UNDER_REVIEW}
							{@const badgeKey = slipStatusI18nKey(p.paymentState)}
							<span class="badge" data-testid={`order.payment-evidence.badge.${idx}`}>
								<ssk-badge variant="subtle" size="md" themecolor={slipStatusTheme(p.paymentState)}>
									{badgeKey ? $i18nKW[badgeKey] : '-'}
								</ssk-badge>
							</span>
						{/if}
					</div>

					{#if p.paymentState === SlipPaymentState.UNDER_REVIEW}
						{#if canManagePayment}
							<ssk-button
								width="full"
								size="lg"
								on:click={() => openReview(p)}
								data-testid={`order.payment-evidence.review.${idx}`}
							>
								{$i18nKW['order.payment.review_btn']}
							</ssk-button>
						{:else}
							<!-- no patona.order.payment.manage → disabled + tooltip -->
							<ssk-tooltip size="xs" themeColor="black" hideCloseButton={true} areaPosition="130%">
								<span slot="content" class="tooltip-content">
									<ssk-text size="xs" color="white">
										{$i18nKW['common.permission.access_restricted']}
									</ssk-text>
								</span>
								<ssk-button
									width="full"
									size="lg"
									disabled
									data-testid={`order.payment-evidence.review-disabled.${idx}`}
								>
									{$i18nKW['order.payment.review_btn']}
								</ssk-button>
							</ssk-tooltip>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.evidence-section {
		display: grid;
		gap: 1rem;
	}

	.cards {
		display: grid;
		gap: 0.75rem;
	}

	.card {
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		padding: 1rem;
		display: grid;
		gap: 0.5rem;
	}

	.info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.thumb.clickable {
		cursor: pointer;
	}

	.detail {
		display: grid;
		gap: 0.25rem;
	}

	.badge {
		/* push the status badge to the right edge of the card, vertically centered */
		margin-left: auto;
		flex-shrink: 0;
	}

	.card ssk-tooltip {
		display: block;
		width: 100%;
	}

	.tooltip-content {
		padding: 2px 4px;
		max-width: 20rem;
		word-wrap: break-word;
		white-space: normal;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
