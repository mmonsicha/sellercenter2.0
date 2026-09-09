<script lang="ts">
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import {
		slipModalStore,
		openSlipModal,
		closeSlipModal,
		SlipModalType,
		SlipModalMode
	} from '$stores/order/slip-modals';
	import { SlipPaymentState } from '$lib/entities/payment/payment-transaction';
	import { slipStatusI18nKey, bankNameI18nKey } from '$utils/i18n-keys';
	import { slipStatusTheme } from '$utils/utils-order';
	import { withCompanyRef } from '$utils/file-url';
	import { currentCompany } from '$stores/company/current-company';
	import { providerBankNames, loadProviderBankNames } from '$stores/payment/provider-bank';
	import { formatPrice } from '$utils/format-number';
	import { formatDateWithTime } from '$utils/format-date';
	import { currentLanguage } from '$stores/i18n';

	export let canManagePayment = false;

	$: state = $slipModalStore;
	$: show = state.active === SlipModalType.SlipReview;
	$: order = state.order;
	$: payment = state.payment;
	$: isUnderReview = payment?.paymentState === SlipPaymentState.UNDER_REVIEW;
	$: viewOnly = state.mode === SlipModalMode.View;
	$: slipUrl = withCompanyRef(payment?.fullImageUrl ?? payment?.thumbnailUrl, $currentCompany?.id);

	$: slipFallback =
		(payment?.fullImageUrl && withCompanyRef(payment?.thumbnailUrl, $currentCompany?.id)) ||
		'/images/default-image.png';

	$: statusKey = slipStatusI18nKey(payment?.paymentState);
	$: receivingBankKey = bankNameI18nKey(payment?.bankCode);

	$: if (show && payment?.bankCode) {
		void loadProviderBankNames();
	}
	$: providerBankName = payment?.bankCode ? $providerBankNames[payment.bankCode] : undefined;
</script>

<ModalWithDivider
	ShowModal={show}
	id="slip-review"
	toggleModal={closeSlipModal}
	modalWidth="564px"
	hPosition="left"
>
	<span slot="title" class="modal-title">
		<ssk-text size="lg" color="gray.800" fontWeight="medium">
			<ssk-i18n-translate
				key="payment.slip.review_title"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<ssk-text size="lg" color="primary" fontWeight="medium">{order?.orderSerial ?? ''}</ssk-text>
	</span>

	<div slot="body" class="modal-body" data-testid="slip-review.modal">
		<div class="slip-image-area">
			<ssk-image
				class="slip-preview-image"
				src={slipUrl}
				fallbackSrc={slipFallback}
				width="100%"
				data-testid="slip-review.image"
			></ssk-image>
		</div>

		<!-- Detail card -->
		<div class="detail-card">
			<div class="detail-row">
				<ssk-text class="label" size="sm" color="stroke">
					<ssk-i18n-translate
						key="payment.slip.label.amount"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				<ssk-text class="value" size="sm" color="primary" fontWeight="bold"
					>฿{formatPrice(payment?.amount ?? 0)}</ssk-text
				>
			</div>
			<div class="detail-row">
				<ssk-text class="label" size="sm" color="stroke">
					<ssk-i18n-translate
						key="payment.slip.label.status"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				<span class="value">
					<ssk-badge
						variant="subtle"
						themecolor={slipStatusTheme(payment?.paymentState)}
						data-testid="slip-review.status-badge"
					>
						{#if statusKey}
							<ssk-i18n-translate
								key={statusKey}
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						{:else}
							-
						{/if}
					</ssk-badge>
				</span>
			</div>

			<ssk-divider size="xs"></ssk-divider>

			<div class="detail-row">
				<ssk-text class="label" size="sm" color="stroke">
					<ssk-i18n-translate
						key="payment.slip.label.transfer_time"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				<ssk-text class="value" size="sm" color="gray.800" fontWeight="bold">
					{payment?.transferAt ? formatDateWithTime(payment.transferAt) : '-'}
				</ssk-text>
			</div>
			<div class="detail-row">
				<ssk-text class="label" size="sm" color="stroke">
					<ssk-i18n-translate
						key="payment.slip.label.receiving_bank"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				<ssk-text
					class="value"
					size="sm"
					color="gray.800"
					fontWeight="bold"
					data-testid="slip-review.receiving-bank"
				>
					{#if providerBankName}
						{providerBankName}
					{:else if receivingBankKey}
						<ssk-i18n-translate
							key={receivingBankKey}
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					{:else}
						{payment?.bankCode ?? '-'}
					{/if}
				</ssk-text>
			</div>
			<div class="detail-row">
				<ssk-text class="label" size="sm" color="stroke">
					<ssk-i18n-translate
						key="payment.slip.label.account_name"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				<ssk-text class="value" size="sm" color="gray.800" fontWeight="bold"
					>{payment?.receivingAccount?.accountName ?? '-'}</ssk-text
				>
			</div>
			<div class="detail-row">
				<ssk-text class="label" size="sm" color="stroke">
					<ssk-i18n-translate
						key="payment.slip.label.account_number"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				<ssk-text class="value" size="sm" color="gray.800" fontWeight="bold"
					>{payment?.receivingAccount?.accountNumber ?? '-'}</ssk-text
				>
			</div>
			<div class="detail-row">
				<ssk-text class="label" size="sm" color="stroke">
					<ssk-i18n-translate
						key="payment.slip.label.uploaded_at"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				<ssk-text class="value" size="sm" color="gray.800" fontWeight="bold">
					{payment?.createdAt ? formatDateWithTime(payment.createdAt) : '-'}
				</ssk-text>
			</div>

			{#if viewOnly}
				<ssk-divider size="xs"></ssk-divider>
				<div class="detail-row">
					<ssk-text class="label" size="sm" color="stroke">
						<ssk-i18n-translate
							key="payment.slip.label.operated_by"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>
					<ssk-text class="value" size="sm" color="gray.800" fontWeight="bold"
						>{payment?.operator?.name ?? '-'}</ssk-text
					>
				</div>
				<div class="detail-row">
					<ssk-text class="label" size="sm" color="stroke">
						<ssk-i18n-translate
							key="payment.slip.label.operated_at"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>
					<ssk-text class="value" size="sm" color="gray.800" fontWeight="bold">
						{payment?.paymentStateChangedAt
							? formatDateWithTime(payment.paymentStateChangedAt)
							: '-'}
					</ssk-text>
				</div>
			{/if}
		</div>
	</div>

	<div slot="footer" class="modal-footer">
		{#if isUnderReview && !viewOnly}
			<div class="footer-left">
				{#if canManagePayment}
					<ssk-button
						variant="ghost"
						themeColor="primary"
						on:click={() => order && openSlipModal(SlipModalType.EditPayment, { order, payment })}
						data-testid="slip-review.button.edit"
					>
						<ssk-i18n-translate
							key="order.payment.edit_btn"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-button>
				{/if}
			</div>
			<div class="footer-right">
				{#if canManagePayment}
					<ssk-button
						variant="outline"
						on:click={() => order && openSlipModal(SlipModalType.RejectPayment, { order, payment })}
						data-testid="slip-review.button.reject"
					>
						<ssk-i18n-translate
							key="order.payment.reject_btn"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-button>
				{/if}
				{#if canManagePayment}
					<ssk-button
						variant="solid"
						themeColor="primary"
						on:click={() =>
							order && openSlipModal(SlipModalType.ApprovePaymentConfirm, { order, payment })}
						data-testid="slip-review.button.approve"
					>
						<ssk-i18n-translate
							key="order.payment.approve_btn"
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-button>
				{/if}
			</div>
		{:else}
			<div class="footer-right">
				<ssk-button
					variant="outline"
					on:click={closeSlipModal}
					data-testid="slip-review.button.close"
				>
					<ssk-i18n-translate
						key="order.payment.close_btn"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-button>
			</div>
		{/if}
	</div>
</ModalWithDivider>

<style>
	.modal-body {
		display: flex;
		flex-direction: column;
		padding: 8px 0;
		width: 100%;
	}

	.slip-image-area {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	:global(ssk-image.slip-preview-image) {
		display: block;
		width: auto;
		max-width: 440px;
		max-height: 560px;
		border-radius: 8px;
		overflow: hidden;
		background: var(--ssk-colors-gray-50);
	}

	.detail-card {
		background: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 8px;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}

	.modal-title {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.label {
		flex-shrink: 0;
	}

	.value {
		text-align: right;
	}

	.modal-footer {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		align-items: center;
		width: 100%;
	}

	.footer-left {
		display: flex;
	}

	.footer-right {
		display: flex;
		gap: 16px;
		align-items: center;
		margin-left: auto;
	}
</style>
