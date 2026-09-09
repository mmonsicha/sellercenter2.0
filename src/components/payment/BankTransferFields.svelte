<script lang="ts">
	import { afterUpdate, onDestroy, onMount } from 'svelte';
	import UploadImage from '$components/UploadImage.svelte';
	import type { UploadResult } from '$lib/entities/payment/upload';
	import type { BankOption } from '$components/payment/bank-option';
	import { currentLanguage } from '$stores/i18n';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';

	const i18nStore = getContext<I18nStore>('i18n');

	// Slip upload constants — kept inside this component (single source for both modals).
	const BANK_SLIP_ACCEPT = '.jpg,.jpeg,.png,.webp';
	const BANK_SLIP_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const BANK_SLIP_MAX_FILE_SIZE = 2 * 1024 * 1024;
	const DATE_PICKER_POPUP_OFFSET = '0.375rem';
	const DATE_PICKER_POPUP_STYLE_SELECTOR = '[data-transfer-date-placement]';

	// Strings this component owns (the rest arrive as props from the parent modal).
	// Resolved imperatively because they are passed as attributes (label / placeholder /
	// helperText) to <ssk-*> elements; element-text strings use <ssk-i18n-translate>.
	let slipHelperText = '';
	let slipAcceptedExtensions = '';
	let uploadSlipCta = '';
	let transferDateLabel = '';
	let transferDatePlaceholder = '';
	let transferTimeLabel = '';
	let transferTimePlaceholder = '';

	async function loadKeywords() {
		const lang = $currentLanguage.code;
		[
			slipHelperText,
			slipAcceptedExtensions,
			uploadSlipCta,
			transferDateLabel,
			transferDatePlaceholder,
			transferTimeLabel,
			transferTimePlaceholder
		] = await Promise.all([
			i18nStore.get('payment.slip.helper_text', lang, 'default'),
			i18nStore.get('payment.slip.accepted_extensions', lang, 'default'),
			i18nStore.get('payment.bank_transfer.cta.upload_slip', lang, 'default'),
			i18nStore.get('payment.bank_transfer.label.transfer_date', lang, 'default'),
			i18nStore.get('payment.bank_transfer.placeholder.transfer_date', lang, 'default'),
			i18nStore.get('payment.bank_transfer.label.transfer_time', lang, 'default'),
			i18nStore.get('payment.bank_transfer.placeholder.transfer_time', lang, 'default')
		]);
	}

	$: if ($currentLanguage.code) void loadKeywords();

	// --- Bank account selection (controlled) ---
	export let bankChannels: BankOption[];
	export let selectedBankId: string;
	export let onSelectBank: (id: string) => void;
	export let bankErrorText: string = '';
	export let bankEmptyText: string = '';

	// --- Slip (controlled) ---
	export let slipRequired: boolean;
	export let slipInitialPreview: string | null = null;
	export let slipInvalidTypeError: string | null = null;
	export let slipTooLargeError: string | null = null;
	export let onSlipChange: (detail: UploadResult) => void;
	export let slipErrorText: string = '';

	// --- Amount (controlled) ---
	export let amountLabel: string;
	export let amountPlaceholder: string = '';
	export let amountValue: string;
	export let amountErrorText: string = '';
	export let onAmountInput: (e: Event) => void;
	export let amountDisabled: boolean = false;

	// --- Quick action "พอดี" (controlled, optional) ---
	export let showExactButton: boolean = false;
	export let exactButtonLabel: string = '';
	export let onExact: () => void = () => {};

	// --- Transfer date + time (controlled) ---
	// Parents pass 'YYYY-MM-DD' strings; this component converts to/from Date / epoch ms.
	export let transferDate: string;
	export let transferTime: string;
	export let dateErrorText: string = '';
	export let timeErrorText: string = '';
	// Parent callbacks — called with synthetic Event-like objects so existing handlers work.
	export let onDateInput: (e: Event) => void;
	export let onTimeInput: (e: Event) => void;

	// --- Global disable + test-id prefix ---
	export let disabled: boolean = false;
	export let testIdPrefix: string;

	// --- Date picker internal value (JS Date) ---
	// Parse 'YYYY-MM-DD' → Date for the picker value prop.
	function parseDateString(dateStr: string): Date | undefined {
		if (!dateStr) return undefined;
		const d = new Date(`${dateStr}T00:00:00`);
		return isNaN(d.getTime()) ? undefined : d;
	}

	// Format JS Date back to 'YYYY-MM-DD'.
	function formatDateToISO(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	// --- Time picker internal value (epoch ms) ---
	// Parse 'HH:mm' → epoch ms for ssk-time value prop (today's date + the time).
	function parseTimeString(timeStr: string): number | undefined {
		if (!timeStr) return undefined;
		const [hStr, mStr] = timeStr.split(':');
		const h = parseInt(hStr ?? '', 10);
		const m = parseInt(mStr ?? '', 10);
		if (isNaN(h) || isNaN(m)) return undefined;
		const d = new Date();
		d.setHours(h, m, 0, 0);
		return d.getTime();
	}

	// Format epoch ms → 'HH:mm'.
	function formatTimeFromMs(ms: number): string {
		const d = new Date(ms);
		const h = String(d.getHours()).padStart(2, '0');
		const m = String(d.getMinutes()).padStart(2, '0');
		return `${h}:${m}`;
	}

	$: datePickerValue = parseDateString(transferDate);
	$: timePickerValue = parseTimeString(transferTime);

	// --- Date picker event handler ---

	function handleDatePickerChange(e: CustomEvent<{ value?: Date; valueFrom?: Date }>) {
		const picked = e.detail?.value ?? e.detail?.valueFrom;
		if (!picked) return;
		const iso = formatDateToISO(picked);
		// Synthesise an Event-like object so parent handlers work unchanged.
		const syntheticEvent = { target: { value: iso } } as unknown as Event;
		onDateInput(syntheticEvent);
	}

	// --- Time picker popover state ---
	let isTimePickerOpen = false;
	let timePickerContainer: HTMLDivElement | null = null;

	function openTimePicker() {
		if (disabled) return;
		isTimePickerOpen = true;
	}

	function handleTimePickerChange(e: CustomEvent<{ value: number }>) {
		const ms = e.detail?.value;
		if (ms == null) return;
		const formatted = formatTimeFromMs(ms);
		const syntheticEvent = { target: { value: formatted } } as unknown as Event;
		onTimeInput(syntheticEvent);
		isTimePickerOpen = false;
	}

	function handleTimePickerKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		openTimePicker();
	}

	function handleDocumentClick(event: MouseEvent) {
		if (!isTimePickerOpen || !timePickerContainer) return;
		if (timePickerContainer.contains(event.target as Node)) return;
		isTimePickerOpen = false;
	}

	// --- Shadow-DOM upward placement for date picker ---
	// The modal body scrolls, so inject a style element into ssk-date-picker's shadow root
	// to open the calendar upward so it isn't clipped.
	let transferDatePicker: HTMLElement | null = null;
	let transferDatePickerPatchedFor: HTMLElement | null = null;
	let transferDatePickerPlacementStyle: HTMLStyleElement | null = null;

	function applyTransferDatePickerPlacement() {
		const picker = transferDatePicker;
		if (!picker || transferDatePickerPatchedFor === picker) return;

		const shadowRoot = picker.shadowRoot;
		if (!shadowRoot || shadowRoot.querySelector(DATE_PICKER_POPUP_STYLE_SELECTOR)) return;

		transferDatePickerPlacementStyle?.remove();

		transferDatePickerPlacementStyle = document.createElement('style');
		transferDatePickerPlacementStyle.dataset.transferDatePlacement = 'true';
		transferDatePickerPlacementStyle.textContent = `
			.calendar-container {
				top: auto !important;
				bottom: calc(100% + ${DATE_PICKER_POPUP_OFFSET}) !important;
			}
		`;
		shadowRoot.appendChild(transferDatePickerPlacementStyle);
		transferDatePickerPatchedFor = picker;
	}

	onMount(() => {
		document.addEventListener('click', handleDocumentClick);
		applyTransferDatePickerPlacement();
	});

	afterUpdate(() => {
		applyTransferDatePickerPlacement();
	});

	onDestroy(() => {
		document.removeEventListener('click', handleDocumentClick);
		transferDatePickerPlacementStyle?.remove();
	});
</script>

<div class="bank-account-list" data-testid={`${testIdPrefix}.bank-list`}>
	<div class="field-label">
		<ssk-text size="md" color="gray.800">
			<ssk-i18n-translate
				key="payment.bank_transfer.label.bank"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<ssk-text size="md" color="error.500">*</ssk-text>
	</div>
	{#if bankChannels.length === 0}
		<ssk-text size="sm" color="gray.500" data-testid={`${testIdPrefix}.bank-empty-state`}>
			{bankEmptyText}
		</ssk-text>
	{:else}
		{#each bankChannels as bank, i}
			<div
				class="bank-account-card"
				class:selected={selectedBankId === bank.id}
				role="button"
				tabindex="0"
				data-testid={`${testIdPrefix}.bank-item-${i}`}
				on:click={() => onSelectBank(bank.id)}
				on:keydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onSelectBank(bank.id);
					}
				}}
			>
				<div class="bank-account-left">
					{#if bank.logo}
						<ssk-logo
							boxsize="28px"
							srcLogo={bank.logo}
							altLogo={bank.code}
							altLogoName={bank.code}
						/>
					{:else}
						<div class="bank-account-icon">{bank.code.slice(0, 1)}</div>
					{/if}
					<div class="bank-account-meta">
						<ssk-text size="md" color="gray.800">{bank.account}</ssk-text>
						<ssk-text size="xs" color="gray.500">
							{bank.code}{bank.accountName ? ` / ${bank.accountName}` : ''}
						</ssk-text>
					</div>
				</div>
				<ssk-radio
					checked={selectedBankId === bank.id}
					data-testid={`${testIdPrefix}.bank-radio-${i}`}
				></ssk-radio>
			</div>
		{/each}
	{/if}
	{#if bankErrorText}
		<ssk-text size="xs" color="error.500">{bankErrorText}</ssk-text>
	{/if}
</div>

<div class="bank-slip-section">
	<div class="field-label">
		<ssk-text size="md" color="gray.800">
			<ssk-i18n-translate
				key="payment.bank_transfer.label.slip"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		{#if slipRequired}
			<ssk-text size="md" color="error.500">*</ssk-text>
		{/if}
	</div>
	<UploadImage
		label=""
		placeholderLabel={uploadSlipCta}
		accentColor="sky.500"
		borderStyle="dashed"
		borderColor="var(--ssk-colors-sky-500)"
		helperText={slipHelperText}
		initialPreview={slipInitialPreview}
		accept={BANK_SLIP_ACCEPT}
		acceptedTypes={BANK_SLIP_ACCEPTED_TYPES}
		acceptedExtensionsLabel={slipAcceptedExtensions}
		maxFileSize={BANK_SLIP_MAX_FILE_SIZE}
		invalidTypeError={slipInvalidTypeError}
		tooLargeError={slipTooLargeError}
		previewWidth="140px"
		previewHeight="140px"
		uploadTestId={`${testIdPrefix}.slip-upload`}
		thumbnailTestId={`${testIdPrefix}.slip-thumbnail`}
		removeTestId={`${testIdPrefix}.slip-delete`}
		onChange={onSlipChange}
	/>
	{#if slipErrorText}
		<ssk-text size="xs" color="error.500">{slipErrorText}</ssk-text>
	{/if}
</div>

<ssk-input
	required
	size="md"
	label={amountLabel}
	placeholder={amountPlaceholder}
	value={amountValue}
	helperText={amountErrorText}
	error={!!amountErrorText}
	on:input={onAmountInput}
	disabled={disabled || amountDisabled}
	data-testid={`${testIdPrefix}.bank-amount-input`}
>
	<ssk-input-addon slot="prefix">
		<ssk-text size="md" color="gray.500">฿</ssk-text>
	</ssk-input-addon>
</ssk-input>

{#if showExactButton}
	<div class="quick-actions">
		<ssk-button
			variant="outline"
			themeColor="gray"
			on:click={onExact}
			data-testid={`${testIdPrefix}.button.exact`}
		>
			{exactButtonLabel}
		</ssk-button>
	</div>
{/if}

<div class="transfer-datetime-grid">
	<!-- Date picker -->
	<div class="transfer-date-field">
		<div class="field-label">
			<ssk-text size="md" color="gray.800">{transferDateLabel}</ssk-text>
			<ssk-text size="md" color="error.500">*</ssk-text>
		</div>
		<ssk-date-picker
			bind:this={transferDatePicker}
			size="md"
			format="dd/MM/yyyy"
			locale="th"
			placeholder={transferDatePlaceholder}
			label=""
			helperText={dateErrorText}
			error={!!dateErrorText}
			value={datePickerValue}
			{disabled}
			testId={`${testIdPrefix}.transfer-date-input`}
			data-testid={`${testIdPrefix}.transfer-date-input`}
			on:change={handleDatePickerChange}
		/>
	</div>

	<!-- Time picker (button + popover) -->
	<div class="time-picker-field" bind:this={timePickerContainer}>
		<div class="field-label">
			<ssk-text size="md" color="gray.800">{transferTimeLabel}</ssk-text>
			<ssk-text size="md" color="error.500">*</ssk-text>
		</div>
		<button
			type="button"
			class="time-picker-trigger"
			class:error={!!timeErrorText}
			{disabled}
			data-testid={`${testIdPrefix}.transfer-time-input`}
			on:click={openTimePicker}
			on:keydown={handleTimePickerKeydown}
		>
			<ssk-text size="md" color={transferTime ? 'gray.800' : 'gray.400'}>
				{transferTime || transferTimePlaceholder}
			</ssk-text>
			<ssk-icon name="outline-clock" size="sm" color="gray.400" />
		</button>
		{#if timeErrorText}
			<ssk-text size="xs" color="error.500">{timeErrorText}</ssk-text>
		{/if}

		{#if isTimePickerOpen}
			<div class="time-picker-popover">
				<ssk-time
					size="sm"
					locale="th"
					format="hm"
					maxHeight="180px"
					displayGoNow
					displayOk
					value={timePickerValue}
					testId={`${testIdPrefix}.transfer-time-picker`}
					on:time-changed={handleTimePickerChange}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.field-label {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}

	.quick-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.bank-account-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.bank-account-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.875rem 1rem;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 10px;
		cursor: pointer;
	}
	.bank-account-card.selected {
		border-color: var(--ssk-colors-primary-500);
		box-shadow: 0 0 0 1px var(--ssk-colors-primary-200);
		background: var(--ssk-colors-primary-50);
	}

	.bank-account-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.bank-account-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 9999px;
		font-size: 13px;
		font-weight: 700;
		flex-shrink: 0;
		background: var(--ssk-colors-gray-100);
		color: var(--ssk-colors-gray-700);
	}
	.bank-account-meta {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.bank-slip-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.transfer-datetime-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.875rem;
	}

	.transfer-datetime-grid :global(ssk-date-picker) {
		width: 100%;
	}

	.transfer-date-field,
	.time-picker-field {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.time-picker-field {
		gap: 0.5rem;
	}

	.time-picker-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 40px;
		padding: 0.5rem 0.75rem;
		border: var(--border-xxs, 1px) solid var(--ssk-colors-border-100);
		border-radius: 8px;
		background: var(--ssk-colors-background-50, #fff);
		font: inherit;
		line-height: 1.25;
		cursor: pointer;
	}

	.time-picker-trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.time-picker-trigger:focus-visible {
		border-color: var(--ssk-colors-primary-600);
		outline: var(--border-sm, 2px) solid var(--ssk-colors-primary-200);
	}

	.time-picker-trigger.error {
		border-color: var(--ssk-colors-error-600);
		outline: var(--border-sm, 2px) solid var(--ssk-colors-error-300);
	}

	.time-picker-popover {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(100% + 0.375rem);
		z-index: 20;
		width: 100%;
		border: var(--border-xxs, 1px) solid var(--ssk-colors-border-100);
		border-radius: 8px;
		background: var(--ssk-colors-background-50, #fff);
		box-shadow: 0 8px 20px var(--ssk-colors-gray-100);
		overflow: hidden;
	}

	@media (max-width: 640px) {
		.transfer-datetime-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
