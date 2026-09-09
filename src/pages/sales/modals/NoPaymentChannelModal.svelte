<script lang="ts">
	import IconCircle from '$components/IconCircle.svelte';
	import {
		noPaymentChannelModal,
		closeNoPaymentChannelModal
	} from '$stores/payment/payment-transaction';
	import { navigate } from 'svelte-routing';
	import { currentLanguage } from '$stores/i18n';

	function _onCancel() {
		closeNoPaymentChannelModal();
	}

	function _onSetup() {
		closeNoPaymentChannelModal();
		navigate('/settings?tab=payment');
	}
</script>

<ssk-modal
	show={$noPaymentChannelModal}
	on:close={_onCancel}
	width="400px"
	hideCloseButton
	data-testid="order-payment-no-channel.modal"
>
	<div class="icon-container" slot="header">
		<IconCircle iconColor="#D97706" type="outline" iconName="outline-exclamation-circle" iconSize="2xl" />
	</div>

	<div class="content" slot="body">
		<ssk-heading level="3" fontWeight="medium">
			<ssk-i18n-translate
				key="order.payment.no_channel.title"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-heading>
		<ssk-text size="md" class="text-center" color="gray">
			<ssk-i18n-translate
				key="order.payment.no_channel.body_line1"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
			<br />
			<ssk-i18n-translate
				key="order.payment.no_channel.body_line2"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
	</div>

	<div slot="footer" class="footer">
		<ssk-button
			variant="outline"
			themeColor="gray"
			width="full"
			on:click={_onCancel}
			data-testid="order-payment-no-channel.button.cancel"
		>
			<ssk-i18n-translate
				key="patona-sellercenter-sales-modal-add-button-cancel"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button
			width="full"
			on:click={_onSetup}
			data-testid="order-payment-no-channel.button.settings"
		>
			<ssk-i18n-translate
				key="order.payment.no_channel.cta_settings"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	</div>
</ssk-modal>

<style>
	.icon-container {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.content {
		display: flex;
		width: 100%;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 1rem;
	}

	.text-center {
		text-align: center;
	}

	.footer {
		display: flex;
		width: 100%;
		gap: 1rem;
	}

	.footer ssk-button {
		flex: 1;
	}
</style>
