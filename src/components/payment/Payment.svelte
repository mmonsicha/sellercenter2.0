<script lang="ts">
	import type { Payment } from '$lib/entities/sale/sale';
	import { mappingTabsTitle, paymentInfo, updatePayment } from '$stores/payment';
	import { getContext, onDestroy } from 'svelte';
	import PaymentContent from './PaymentContent.svelte';
	import { currentLanguage } from '$stores/i18n';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';

	const i18nStore = getContext<I18nStore>('i18n');
	let tabLabels: string[] = [];

	export let info: Payment;
	let activeTabIndex = 0;

	const handleTabClick = () => {
		const tabsElement = document.querySelector('#tabs-payment');

		if (!tabsElement) return;

		const shadowRoot = tabsElement.shadowRoot;
		if (!shadowRoot) return;

		const activeTab = shadowRoot.querySelector('.active');
		if (!activeTab) return;

		const tabs = Array.from(shadowRoot.querySelectorAll('.tab'));
		activeTabIndex = tabs.indexOf(activeTab);

		let newType: string;

		switch (activeTabIndex) {
			case 0:
				newType = 'cash';
				break;
			case 1:
				newType = 'bankTransfer';
				break;
			case 2:
				newType =
					info.type === 'creditCard' || info.type === 'debitCard' ? info.type : 'creditCard';
				break;
			case 3:
				newType = 'other';
				break;
			default:
				newType = info.type; // Fallback to current type if index is out of range
				break;
		}

		// Only update payment if the type has changed
		if (info.type !== newType) {
			updatePayment({
				type: newType,
				received: undefined,
				change: 0,
				ref: '',
				note: ''
			});
		}
	};

	paymentInfo.subscribe((v) => {
		if (v.type == 'cash') {
			activeTabIndex = 0;
		}
	});

	const loadKeywords = async () => {
		tabLabels = await Promise.all(
			mappingTabsTitle.map((key) => i18nStore.get(key, $currentLanguage.code, 'default'))
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}

	onDestroy(() => {
		updatePayment({
			received: undefined,
			change: 0,
			ref: '',
			note: ''
		});
	});
</script>

<div class="container">
	<ssk-tabs
		id="tabs-payment"
		widthtab="true"
		activeIndex={activeTabIndex}
		labels={tabLabels}
		on:click={handleTabClick}
	>
	</ssk-tabs>
	<div class="payment-content">
		<PaymentContent {info} tabIndex={activeTabIndex} />
	</div>
</div>

<style lang="css">
	.payment-content {
		padding: 16px;
	}
</style>
