<script lang="ts">
	import { getContext } from 'svelte';
	import { get } from 'svelte/store';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { currentStore } from '$stores/store/current-store';
	import {
		configurationStore,
		loadStoreConfiguration,
		updateStoreConfiguration
	} from '$stores/configuration';
	import { ConfigKind } from '$lib/entities/configuration/configuration';
	import LoadingPage from '$components/LoadingPage.svelte';
	import PermissionDenied from '$components/PermissionDenied.svelte';
	import Badge from '$components/CustomBadge.svelte';
	import { checkPermissionsEach } from '$utils/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { EntityPermission } from '$lib/entities/role-permission/permission';

	const toastStore = getContext<ToastStore>('toast');

	type Unit = 'minutes' | 'hours' | 'days';

	const NO_EXPIRY = 0;
	const CUSTOM = -1;

	const SEC_PER_MIN = 60;
	const SEC_PER_HOUR = 60 * 60;
	const SEC_PER_DAY = 24 * 60 * 60;
	const MIN_SECONDS = 15 * SEC_PER_MIN; // 15 นาที

	const presetOptions: { label: string; value: number; badge?: string }[] = [
		{ label: 'ไม่มีกำหนด', value: NO_EXPIRY, badge: 'ค่าเริ่มต้นของระบบ' },
		{ label: '15 นาที', value: 15 * SEC_PER_MIN },
		{ label: '30 นาที', value: 30 * SEC_PER_MIN },
		{ label: '1 ชั่วโมง', value: 1 * SEC_PER_HOUR },
		{ label: '4 ชั่วโมง', value: 4 * SEC_PER_HOUR },
		{ label: '1 วัน', value: 1 * SEC_PER_DAY },
		{ label: '3 วัน', value: 3 * SEC_PER_DAY },
		{ label: '7 วัน', value: 7 * SEC_PER_DAY }
	];

	const unitOptions: { label: string; value: Unit; multiplier: number; max: number }[] = [
		{ label: 'นาที', value: 'minutes', multiplier: SEC_PER_MIN, max: 10080 },
		{ label: 'ชั่วโมง', value: 'hours', multiplier: SEC_PER_HOUR, max: 168 },
		{ label: 'วัน', value: 'days', multiplier: SEC_PER_DAY, max: 7 }
	];

	let selectedValue: number = NO_EXPIRY;
	let customAmount: string = '';
	let customUnit: Unit = 'minutes';
	let customAmountTouched = false;
	let isSaving = false;
	let isForbidden = false;
	let loadPromise: Promise<void> | undefined;

	$: storeId = $currentStore?.id ?? '';

	$: if (storeId) {
		loadPromise = loadStoreData(storeId);
	}

	async function loadStoreData(id: string): Promise<void> {
		if (!get(configurationStore).data.stores[id]) {
			await loadStoreConfiguration(id);
		}

		try {
			const result = await checkPermissionsEach(ScopePermissions.patonaStore, id, [
				EntityPermission.STOREORDEREXPIRYEDIT
			]);
			isForbidden = !result[EntityPermission.STOREORDEREXPIRYEDIT];
		} catch (_) {
			isForbidden = true;
		}

		const cfg = get(configurationStore).data.stores[id];
		applyStoreCfg(cfg?.timeoutSeconds ?? 0);
	}

	$: isCustomSelected = selectedValue === CUSTOM;
	$: effectiveSeconds = computeSeconds(selectedValue, customAmount, customUnit);
	$: validationError = validateSeconds(selectedValue, effectiveSeconds, customAmount);
	$: canSave = !validationError && !isSaving;

	function applyStoreCfg(timeoutSeconds: number) {
		const preset = presetOptions.find((p) => p.value === timeoutSeconds && p.value >= 0);
		if (preset) {
			selectedValue = preset.value;
			customAmount = '';
			customUnit = 'minutes';
			customAmountTouched = false;
		} else {
			selectedValue = CUSTOM;
			const { amount, unit } = secondsToDisplay(timeoutSeconds);
			customAmount = String(amount);
			customUnit = unit;
			customAmountTouched = true;
		}
	}

	function secondsToDisplay(seconds: number): { amount: number; unit: Unit } {
		if (seconds > 0 && seconds % SEC_PER_DAY === 0) {
			return { amount: seconds / SEC_PER_DAY, unit: 'days' };
		}
		if (seconds > 0 && seconds % SEC_PER_HOUR === 0) {
			return { amount: seconds / SEC_PER_HOUR, unit: 'hours' };
		}
		return { amount: Math.max(0, Math.round(seconds / SEC_PER_MIN)), unit: 'minutes' };
	}

	function computeSeconds(val: number, amount: string, unit: Unit): number {
		if (val !== CUSTOM) return Math.max(val, 0);
		const n = parseInt(amount, 10);
		if (!Number.isFinite(n) || n <= 0) return 0;
		const mult = unitOptions.find((u) => u.value === unit)?.multiplier ?? 1;
		return n * mult;
	}

	function validateSeconds(val: number, seconds: number, amount: string): string {
		if (val !== CUSTOM) return '';
		if (!amount.trim()) return 'กรุณากรอกระยะเวลา';
		if (seconds < MIN_SECONDS) return 'ระยะเวลาขั้นต่ำ 15 นาที';
		return '';
	}

	function handleCustomAmountInput(e: Event) {
		const target = e.target as HTMLInputElement;
		let sanitized = (target.value ?? '').replace(/\D/g, '');
		const unitOption = unitOptions.find((u) => u.value === customUnit);
		if (sanitized && unitOption) {
			const n = parseInt(sanitized, 10);
			if (Number.isFinite(n) && n > unitOption.max) {
				sanitized = String(unitOption.max);
			}
		}
		if (target.value !== sanitized) {
			target.value = sanitized;
		}
		customAmount = sanitized;
		customAmountTouched = true;
	}

	function handleUnitChange(e: Event) {
		const value = (e.target as HTMLInputElement).value as Unit;
		if (!value) return;
		customUnit = value;
		const unitOption = unitOptions.find((u) => u.value === value);
		const n = parseInt(customAmount, 10);
		if (unitOption && Number.isFinite(n) && n > unitOption.max) {
			customAmount = String(unitOption.max);
		}
	}

	$: selectedUnitOption = unitOptions.find((u) => u.value === customUnit);

	async function handleSave() {
		if (!canSave || !storeId) return;
		isSaving = true;
		try {
			await updateStoreConfiguration(storeId, {
				kind: ConfigKind.Store,
				timeoutSeconds: effectiveSeconds
			});
			toastStore.clearToasts();
			toastStore.addToast({ message: 'บันทึกการตั้งค่าสำเร็จ', type: 'success', timeout: 3000 });
		} catch (_) {
			toastStore.clearToasts();
			toastStore.addToast({ message: 'บันทึกการตั้งค่าไม่สำเร็จ', type: 'error', timeout: 3000 });
		} finally {
			isSaving = false;
		}
	}
</script>

{#if !storeId}
	<LoadingPage description="กำลังโหลดข้อมูล..." />
{:else}
	{#await loadPromise}
		<LoadingPage description="กำลังโหลดข้อมูล..." />
	{:then}
		{#if isForbidden}
			<PermissionDenied />
		{:else}
			<ssk-container
				padding="24px 32px"
				gap="16px"
				rounded="8px"
				backgroundColor="transparent"
				borderColor="var(--ssk-colors-gray-200)"
				align="stretch"
				width="100%"
			>
				<div class="section-header">
					<div class="section-title-row">
						<ssk-text size="lg" fontWeight="medium">ระยะเวลาออเดอร์</ssk-text>
						<ssk-tooltip
							size="sm"
							themeColor="white"
							placement="top"
							color="currentcolor"
							hideCloseButton={true}
						>
							<div slot="content" class="tooltip-content">
								<ssk-text size="sm">
									ใช้ได้เฉพาะคำสั่งซื้อประเภท Social และ Web checkout เท่านั้น (ไม่รวม COD และ
									Marketplace)
								</ssk-text>
							</div>
							<ssk-icon size="sm" name="outline-information-circle" color="gray.400" />
						</ssk-tooltip>
					</div>
					<ssk-text size="sm" color="gray.500">
						ใช้กับออเดอร์ใหม่ทุกออเดอร์โดยอัตโนมัติ หากไม่ทำรายการภายในเวลาที่กำหนด
						ออเดอร์จะถูกยกเลิก
					</ssk-text>
				</div>

				<ssk-divider orientation="horizontal" size="xs" color="gray.100" />

				<div class="options-grid">
					{#each presetOptions as opt}
						<div
							class="option-card"
							class:selected={selectedValue === opt.value}
							on:click={() => (selectedValue = opt.value)}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectedValue = opt.value;
								}
							}}
							role="radio"
							aria-checked={selectedValue === opt.value}
							tabindex="0"
						>
							<ssk-radio checked={selectedValue === opt.value} label={opt.label} />
							{#if opt.badge}
								<Badge text={opt.badge} />
							{/if}
						</div>
					{/each}
				</div>

				<ssk-divider orientation="horizontal" size="xs" color="gray.100" />

				<div class="options-grid">
					<div
						class="option-card"
						class:selected={isCustomSelected}
						on:click={() => (selectedValue = CUSTOM)}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								selectedValue = CUSTOM;
							}
						}}
						role="radio"
						aria-checked={isCustomSelected}
						tabindex="0"
					>
						<ssk-radio checked={isCustomSelected} label="กำหนดเอง" />
					</div>
				</div>

				{#if isCustomSelected}
					<ssk-container
						padding="16px"
						gap="8px"
						rounded="8px"
						width="100%"
						backgroundColor="var(--ssk-colors-gray-50)"
						borderColor="var(--ssk-colors-gray-200)"
						align="stretch"
					>
						<div class="duration-fields">
							<ssk-dropdown
								size="md"
								label="ประเภท"
								value={customUnit}
								themeColor="primary"
								on:change={handleUnitChange}
							>
								<ssk-dropdown-button slot="selected">
									<ssk-dropdown-preview value={selectedUnitOption?.value}>
										{selectedUnitOption?.label ?? ''}
									</ssk-dropdown-preview>
								</ssk-dropdown-button>
								{#each unitOptions as u}
									<ssk-dropdown-option value={u.value}>{u.label}</ssk-dropdown-option>
								{/each}
							</ssk-dropdown>
							<div class="amount-field">
								<ssk-input
									class="input-amount"
									size="md"
									type="text"
									label="จำนวน"
									placeholder="ระบุ"
									value={customAmount}
									style="--background-color: var(--ssk-colors-white-50);"
									inputmode="numeric"
									pattern="[0-9]*"
									error={!!validationError && customAmountTouched}
									on:input={handleCustomAmountInput}
									on:change={handleCustomAmountInput}
								/>
								{#if validationError && customAmountTouched}
									<ssk-text size="sm" color="red.500">{validationError}</ssk-text>
								{/if}
							</div>
						</div>
					</ssk-container>
				{/if}

				<div class="actions">
					<ssk-button
						role="button"
						variant="solid"
						size="md"
						themeColor="primary"
						disabled={!canSave}
						on:click={handleSave}
					>
						บันทึก
					</ssk-button>
				</div>
			</ssk-container>
		{/if}
	{/await}
{/if}

<style>
	.section-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.section-title-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.tooltip-content {
		max-width: 280px;
	}

	.options-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
	}

	.option-card {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 16px;
		border: 1.5px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		cursor: pointer;
	}

	.option-card:hover {
		border-color: var(--ssk-colors-primary-300);
		background: var(--ssk-colors-primary-50);
	}

	.option-card.selected {
		border-color: var(--ssk-colors-primary-500);
		background: var(--ssk-colors-primary-50);
	}

	ssk-radio {
		pointer-events: none;
	}

	.duration-fields {
		display: flex;
		gap: 16px;
	}

	.amount-field {
		display: flex;
		flex-direction: column;
	}

	.input-amount {
		width: 80px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		padding-top: 4px;
	}
</style>
