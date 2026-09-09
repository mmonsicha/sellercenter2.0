<script lang="ts">
	import IconCircle from '$components/IconCircle.svelte';
	import { currentLanguage } from '$stores/i18n';

	export let show = false;
	export let onClose: () => void = () => {};
	export let onConfirm: () => void = () => {};
</script>

<ssk-modal
	{show}
	on:close={onClose}
	width="400px"
	hideCloseButton
	data-testid="order-payment-partial.modal"
>
	<div class="icon-container" slot="header">
		<IconCircle iconColor="#D97706" type="outline" iconName="outline-exclamation-circle" iconSize="2xl" />
	</div>

	<div class="content" slot="body" data-testid="order-payment-partial.body">
		<ssk-heading level="3" fontWeight="medium">
			<ssk-i18n-translate
				key="order.payment.partial.title"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-heading>
		<ssk-text size="md" class="text-center" color="gray">
			<ssk-i18n-translate
				key="order.payment.partial.body_line1"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
			<br />
			<ssk-i18n-translate
				key="order.payment.partial.body_status_prefix"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
			<span class="alert"
				><ssk-i18n-translate
					key="payment.status.partially_paid"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/></span
			>
		</ssk-text>
	</div>

	<div slot="footer" class="footer">
		<ssk-button
			variant="outline"
			themeColor="gray"
			width="full"
			on:click={onClose}
			data-testid="order-payment-partial.button.close"
		>
			<ssk-i18n-translate
				key="order.payment.partial.cta_close_owe"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button
			width="full"
			on:click={onConfirm}
			data-testid="order-payment-partial.button.continue"
		>
			<ssk-i18n-translate
				key="payment.cta.add_more"
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

	.alert {
		color: var(--ssk-colors-error-500);
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
