<script lang="ts">
	import { onMount } from 'svelte';
	import { navigate } from 'svelte-routing';
	import { setAction } from '$stores/saved-changes';
	import { profileInfo, isMember } from '$stores/profile';
	import { navigateToLogin } from '$utils/navigate';
	import Payment from './Payment/Payment.svelte';
	import Printer from './Printer/index.svelte';
	import Store from './Store/Store.svelte';
	import OrderTimeout from './OrderTimeout/OrderTimeout.svelte';

	const tabToSlug: Record<number, string> = {
		0: 'store',
		1: 'payment',
		2: 'order-timeout',
		3: 'printer'
	};
	const slugToTab: Record<string, number> = {
		store: 0,
		payment: 1,
		'order-timeout': 2,
		printer: 3
	};

	let selectedTab = 0;
	const tabs = [
		{ label: 'ร้านค้า/สาขา', value: 0, testId: 'settings.tab.store-branch' },
		{ label: 'ช่องทางการชำระเงิน', value: 1, testId: 'settings.tab.payment-channel' },
		{ label: 'ระยะเวลาออเดอร์', value: 2, testId: 'settings.tab.order-timeout' },
		{ label: 'เครื่องพิมพ์', value: 3, testId: 'settings.tab.printer' }
	];

	let profileLoadStarted = false;
	$: if ($profileInfo.loading) profileLoadStarted = true;
	$: if (profileLoadStarted && !$profileInfo.loading && !$isMember) {
		navigateToLogin('/settings');
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const slug = params.get('tab');
		if (slug && slugToTab[slug] !== undefined) {
			selectedTab = slugToTab[slug];
		}
	});

	function handleTabChange(nextTab: number) {
		if (selectedTab === nextTab) {
			return;
		}

		setAction(() => {
			selectedTab = nextTab;
			navigate(`/settings?tab=${tabToSlug[nextTab]}`, { replace: true });
		});
	}
</script>

<div class="container">
	<span class="text-title">การตั้งค่าระบบ</span>

	<ssk-tab-header size="md" color="primary" variant="button" buttonwidth="auto">
		{#each tabs as tab}
			<ssk-tab-button
				size="md"
				color="primary"
				variant="button"
				buttonwidth="auto"
				active={selectedTab === tab.value}
				data-testid={tab.testId}
				on:click={() => handleTabChange(tab.value)}
			>
				{tab.label}
			</ssk-tab-button>
		{/each}
	</ssk-tab-header>

	{#if selectedTab === 0}
		<Store />
	{:else if selectedTab === 1}
		<Payment />
	{:else if selectedTab === 2}
		<OrderTimeout />
	{:else if selectedTab === 3}
		<div class="content">
			<Printer />
		</div>
	{/if}
</div>

<style lang="css">
	.container {
		display: flex;
		flex-direction: column;
		gap: 24px;

		box-sizing: border-box;
		width: 100%;
		padding: 32px;
		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}

	.text-title {
		font-weight: 400;
		font-size: 36px;
	}

	.content {
		display: flex;
		flex-direction: column;
		padding: 24px 32px;
		gap: 16px;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}
</style>
