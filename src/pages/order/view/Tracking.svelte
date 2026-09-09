<script lang="ts">
	import IconCircle from '$components/IconCircle.svelte';
	import { getOrderTracking, type Tracking } from '../orderHandler';
	import { formatDateWithTime } from '$utils/format-date';
	import { afterUpdate } from 'svelte';
	import { getBadgeThemeFromTaskStatus, mapOrderTaskIcon, mapTaskStatus } from '$utils/utils-order';
	import { orderTaskNameI18nKey } from '$utils/i18n-keys';
	import { Status } from '$lib/entities/order/order';
	import { currentLanguage, i18nKW } from '$stores/i18n';
	import { orderData } from '$stores/order/order';

	let iconColor: string = '#EC5E2A';
	let oTrack: Tracking;

	afterUpdate(() => {
		if ($orderData.orderId) {
			oTrack = getOrderTracking($orderData);
		}
	});
</script>

{#if oTrack}
	<ssk-text size="xl">{$i18nKW['patona-sellercenter-orderdetail-status-title']}</ssk-text>
	<div class="container">
		<div class="tracking">
			<div class="tracking-item success">
				<IconCircle
					iconName="outline-shopping-cart"
					fixedCircleSize="2rem"
					{iconColor}
					iconSize="sm"
				/>
				<div class="content">
					<div class="title">
						<ssk-text>
							<ssk-i18n-translate
								key="patona-sellercenter-orderdetail-title-createsalesorder"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
					</div>
					<ssk-text size="sm" color="gray.500">{formatDateWithTime(oTrack.created_at)}</ssk-text>
				</div>
			</div>

			{#each oTrack.tasks ?? [] as task}
				<div class={`tracking-item ${task.status}`}>
					{#if task.status == Status.Completed || task.status == Status.Canceled}
						<IconCircle
							iconName={mapOrderTaskIcon(task.name)}
							fixedCircleSize="2rem"
							{iconColor}
							iconSize="sm"
						/>
					{:else}
						<IconCircle
							iconName={mapOrderTaskIcon(task.name)}
							fixedCircleSize="2rem"
							iconColor="#6B7280"
							iconSize="xs"
							type="light"
							fixedBgColor="#fff"
						/>
					{/if}

					<div class="content">
						<div class="title">
							<ssk-text>
								<ssk-i18n-translate
									key={orderTaskNameI18nKey(task.name)}
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-text>
							<ssk-badge variant="subtle" themecolor={getBadgeThemeFromTaskStatus(task.status)}>
								<ssk-i18n-translate
									key={mapTaskStatus(task)}
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-badge>
						</div>
						{#if task.status != Status.Completed && task.status != Status.Canceled}
							<ssk-text size="sm" color="gray.500">
								<ssk-i18n-translate
									key={mapTaskStatus(task)}
									lang={$currentLanguage.code}
									fallbackLang="default"
								/>
							</ssk-text>
						{:else}
							<ssk-text size="sm" color="gray.500">
								{formatDateWithTime(task.canceledAt ?? task.completedAt ?? '')}
							</ssk-text>
						{/if}
					</div>
				</div>
			{/each}
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

	.tracking {
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.tracking-item {
		display: flex;
		align-items: flex-start;
		position: relative;
		margin-bottom: 1rem;
		margin-top: 1rem;
		width: max-content;
	}

	.tracking-item::before {
		content: '';
		position: absolute;
		top: 80%;
		left: 15px;
		width: 1px;
		height: 75%;
		background-color: var(--ssk-colors-gray-200);
		z-index: 0;
	}

	.tracking-item:first-child {
		margin-top: 0;
	}

	.tracking-item:last-child {
		margin-bottom: 0;
	}

	/* เส้นเชื่อมตัวสุดท้าย */
	.tracking-item:last-child::before {
		display: none;
	}

	/* ตำแหน่งข้อความ */
	.tracking-item .content {
		margin-left: 15px;
	}

	.title {
		font-weight: bold;
		color: #333;
		margin-bottom: 4px;
	}

	.time {
		color: #777;
		font-size: 14px;
	}

	/* สถานะสีต่าง ๆ */
	.status {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 12px;
		margin-left: 5px;
		color: #fff;
	}

	.content > .title {
		display: flex;
		gap: 0.5rem;
	}
</style>
