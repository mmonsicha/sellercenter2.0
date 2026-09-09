<script lang="ts">
	import type { PaymentChannel } from '$lib/entities/payment/payment';
	import { PaymentType, translatePaymentType } from '$lib/entities/payment/payment';
	import { currentCompany } from '$stores/company/current-company';
	import { currentStore } from '$stores/store/current-store';
	import { listPaymentChannels, updatePaymentStoreChannel } from '../../../service/management-rest';
	import { getContext, onMount } from 'svelte';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { AxiosError } from 'axios';
	import { ErrorCode } from '$lib/entities/error/error';
	import PermissionDenied from '$components/PermissionDenied.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';

	const toastStore = getContext<ToastStore>('toast');

	type PaymentGroup = {
		label: string;
		channels: PaymentChannel[];
	};

	const paymentTypeOrder: PaymentType[] = [PaymentType.CASH, PaymentType.BANK_TRANSFER];

	let paymentChannels: PaymentChannel[] = [];
	let paymentGroups: PaymentGroup[] = [];
	let hasActivePaymentChannel = false;
	let isLoading = false;
	let isForbidden = false;

	$: currentCompanyId = $currentCompany?.id;
	$: currentStoreId = $currentStore?.id;

	async function loadPaymentChannels() {
		if (!currentCompanyId || !currentStoreId) {
			return;
		}

		isLoading = true;
		isForbidden = false;

		try {
			const { data } = await listPaymentChannels(currentCompanyId, currentStoreId);
			paymentChannels = data;
		} catch (error) {
			if (error instanceof AxiosError) {
				if (error.response?.data?.error === ErrorCode.PermissionDenied) {
					isForbidden = true;
					return;
				}
			}
		} finally {
			isLoading = false;
		}
	}

	async function handleToggleChannel(channel: PaymentChannel) {
		const newStatus = !channel.status;
		const command = newStatus ? 'เปิด' : 'ปิด';

		try {
			await updatePaymentStoreChannel(
				Number(channel.id),
				currentCompanyId || '',
				currentStoreId || '',
				Number(channel.data.paymentId),
				newStatus
			);

			paymentChannels = paymentChannels.map((c) =>
				c.id === channel.id ? { ...c, status: newStatus } : c
			);
			toastStore.clearToasts();
			toastStore.addToast({
				message: command + 'ใช้งานช่องทางการชำระเงินสำเร็จ',
				type: 'success',
				timeout: 3000
			});
		} catch (error) {
			toastStore.clearToasts();
			toastStore.addToast({
				message: command + 'ใช้งานช่องทางการชำระเงินไม่สำเร็จ',
				type: 'error',
				timeout: 3000
			});
		}
	}

	$: paymentGroups = paymentTypeOrder.map((type) => ({
		label: translatePaymentType(type),
		channels: paymentChannels.filter((channel) => channel.data.type === type)
	}));

	$: hasActivePaymentChannel = paymentChannels.some((channel) => channel.status);

	let loadPromise: Promise<void> | null = null;
	$: if (currentCompanyId && currentStoreId) {
		loadPromise = loadPaymentChannels();
	}
</script>

{#if $currentCompany?.id}
	{#await loadPromise}
		<LoadingPage description="กำลังโหลดข้อมูล..." />
	{:then}
		{#if isForbidden}
			<PermissionDenied />
		{:else}
			<div class="payment">
				{#if !hasActivePaymentChannel && paymentChannels.length > 0}
					<ssk-alert
						type="warning"
						topic="กรุณาเปิดช่องทางการชำระเงินอย่างน้อย 1 ช่องทางฯ เพื่อให้ทำรายการคำสั่งขายได้"
						hideclosebutton
					>
						<ssk-icon name="outline-information-circle" slot="icon-slot" themecolor="warning" />
					</ssk-alert>
				{/if}

				{#each paymentGroups as paymentGroup}
					{#if paymentGroup.channels.length > 0}
						<div class="content">
							<ssk-text size="lg">{paymentGroup.label}</ssk-text>
							<ssk-divider orientation="horizontal" size="xs" color="gray.100"></ssk-divider>
							<div class="payment-group">
								{#each paymentGroup.channels as paymentChannel}
									<div class="payment-card">
										<div class="payment-info">
											{#if paymentChannel.data.type === PaymentType.CASH}
												<div class="payment-icon">
													<ssk-icon name="outline-banknotes" themeColor="gray" />
												</div>
											{:else if paymentChannel.data.type === PaymentType.BANK_TRANSFER && paymentChannel.data.metadata}
												<ssk-avatar
													src={paymentChannel.data.metadata?.bankImage}
													alt={paymentChannel.data.name}
													size="lg"
												></ssk-avatar>
											{/if}

											<div class="payment-card-content">
												<ssk-text size="md" fontWeight="medium">{paymentChannel.data.name}</ssk-text
												>
												<div class="payment-card-detail">
													{#if paymentChannel.data.metadata}
														<div class="payment-row">
															<ssk-text size="sm" color="gray.500">เลขบัญชี:</ssk-text>
															<ssk-text size="sm"
																>{paymentChannel.data.metadata.accountNumber}</ssk-text
															>
															<ssk-text size="sm" color="gray.500">ชื่อบัญชี:</ssk-text>
															<ssk-text size="sm"
																>{paymentChannel.data.metadata.accountName}</ssk-text
															>
														</div>
													{:else}
														<ssk-text size="sm" color="gray.500"
															>{paymentChannel.data.description}</ssk-text
														>
													{/if}
												</div>
											</div>
										</div>
										<ssk-toggle
											size="md"
											themeColor="sky"
											checked={paymentChannel.status}
											on:change={() => handleToggleChannel(paymentChannel)}
										/>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	{/await}
{/if}

<style>
	.payment {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.content {
		display: flex;
		flex-direction: column;
		padding: 24px 32px;
		gap: 16px;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}

	.payment-group {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.payment-card {
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
	}

	.payment-info {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.payment-icon {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: 1px solid var(--ssk-colors-gray-200);
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	.payment-card-content {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.payment-card-detail {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.payment-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
</style>
