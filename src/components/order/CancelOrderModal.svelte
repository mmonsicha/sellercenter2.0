<script lang="ts">
	import { getContext } from 'svelte';
	import { get } from 'svelte/store';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import { i18nKW } from '$stores/i18n';
	import {
		storeCancelOrder,
		type CancelReason,
		type CancelOrderResponse
	} from '$service/management-rest';
	import type { Order } from '$lib/entities/order/order';
	import {
		getCancelContext,
		cancelToastKey,
		USER_CANCEL_REASON_LABEL_KEYS,
		type CancelContext
	} from '$utils/cancel-order';
	import { formatPrice } from '$utils/format-number';

	export let show: boolean;
	export let storeId: string;
	export let orderId: string;
	export let order: Order;
	export let onClose: () => void;
	export let onCancelled: (res: CancelOrderResponse) => void;

	const toastStore = getContext<ToastStore>('toast');

	// step 1 = the primary body (simple confirm for `unpaid`, refund box + reasons for cash/transfer)
	// step 2 = the 2nd-step confirm shown only for cash/transfer, right before the actual API call
	type Step = 1 | 2;
	let step: Step = 1;

	let selectedReason: CancelReason | undefined;
	let note = '';
	let loading = false;

	// i18n copy — read reactively from the app-wide patona keyword map ($i18nKW, bulk-loaded
	// in Layout with tag=patona, re-derived on language change; falls back to the key if missing).
	$: titleModal = $i18nKW['patona-sellercenter-orderdetail-modal-cancel-title'];
	$: bodyModal = $i18nKW['patona-sellercenter-orderdetail-modal-cancel-body-confirmation'];
	$: refundAmountLabel = $i18nKW['patona-sellercenter-orderdetail-modal-cancel-refund-amount'];
	$: reasonLabel = $i18nKW['patona-sellercenter-orderdetail-modal-cancel-reason-label'];
	$: notePlaceholder = $i18nKW['patona-sellercenter-orderdetail-modal-cancel-note-placeholder'];
	$: confirm2Title = $i18nKW['patona-sellercenter-orderdetail-modal-cancel-confirm2-title'];
	$: confirm2Body = $i18nKW['patona-sellercenter-orderdetail-modal-cancel-confirm2-body'];

	$: ctx = order
		? getCancelContext(order)
		: ({ kind: 'unpaid', refundTotal: 0, lines: [] } as CancelContext);
	$: isUnpaid = ctx.kind === 'unpaid';
	// The unpaid confirm and the cash/transfer step-2 both render as a centered
	// warning notice (icon, no divider, centered title/body) — matching
	// CannotCancelOrderModal. Cash/transfer step-1 keeps the left-aligned form.
	$: centeredNotice = isUnpaid || step === 2;
	$: isOther = selectedReason === 'other';
	$: canConfirm = isUnpaid || (!!selectedReason && (!isOther || note.trim().length > 0));
	// Render the confirm body one <ssk-text> per line so the sentence breaks exactly
	// where the copy intends (`\n` in the i18n value). ssk-text hardcodes
	// `word-break: break-word` in its shadow, so CSS can't stop Thai from breaking
	// mid-word — splitting into separate blocks is the reliable control.
	$: confirm2BodyLines = confirm2Body
		? confirm2Body
				.split(/\r?\n/)
				.map((l) => l.trim())
				.filter(Boolean)
		: [];

	// Drive defaultValue from the retained selection. ssk-radio-group only reads
	// group.defaultValue in firstUpdated() (once per instance) — and this group is
	// destroyed/recreated whenever step toggles 1↔2. Returning from the step-2 confirm
	// mounts a fresh instance; without reflecting selectedReason here it would render
	// empty even though the reason is still selected in state.
	$: reasonGroup = {
		defaultValue: (selectedReason ? [selectedReason] : []) as string[],
		options: (Object.entries(USER_CANCEL_REASON_LABEL_KEYS) as [CancelReason, string][]).map(
			([value, key]) => ({ label: $i18nKW[key] ?? '', value })
		)
	};

	function readValue(e: Event): string | undefined {
		const orig = (e as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent ?? e;
		return (orig.target as HTMLInputElement | HTMLTextAreaElement | null)?.value;
	}

	function handleReasonChange(e: Event) {
		const v = readValue(e);
		if (v) selectedReason = v as CancelReason;
	}

	function handleNoteChange(e: Event) {
		note = readValue(e) ?? '';
	}

	function resetState() {
		step = 1;
		selectedReason = undefined;
		note = '';
	}

	function handleCancel() {
		if (loading) return;
		resetState();
		onClose();
	}

	function handleBackFromConfirm2() {
		if (loading) return;
		step = 1;
	}

	function handlePrimaryConfirm() {
		if (loading) return;
		if (isUnpaid) {
			void submitCancel();
			return;
		}
		if (!canConfirm) return;
		step = 2;
	}

	async function submitCancel() {
		if (loading) return;
		if (!storeId || !orderId) return;
		loading = true;
		try {
			const res = await storeCancelOrder(
				storeId,
				orderId,
				isUnpaid ? undefined : selectedReason,
				isUnpaid ? undefined : isOther ? note.trim() : undefined
			);
			toastStore.addToast({
				message: get(i18nKW)[cancelToastKey(ctx.kind)],
				type: 'success',
				timeout: 3000
			});
			onCancelled(res);
		} catch {
			toastStore.addToast({
				message: get(i18nKW)['patona-sellercenter-orderdetail-toast-canceled-fail'],
				type: 'error',
				timeout: 3000
			});
		} finally {
			loading = false;
			resetState();
			onClose();
		}
	}
</script>

<ModalWithDivider
	id="cancel-order"
	ShowModal={show}
	toggleModal={handleCancel}
	hideCloseButton={true}
	hideDivider={centeredNotice}
	hPosition={centeredNotice ? 'center' : 'left'}
	icon={centeredNotice ? 'outline-exclamation-circle' : ''}
	iconColor={isUnpaid ? '#EC5E2A' : '#d97706'}
	modalWidth="440px"
>
	<div slot="title">
		{#if step === 2}
			<ssk-text size="xl" color="gray.800">{confirm2Title}</ssk-text>
		{:else if isUnpaid}
			<ssk-text size="xl" fontWeight="medium" color="gray.800">{titleModal}</ssk-text>
		{:else}
			<div class="title-row">
				<ssk-text size="lg">{titleModal}</ssk-text>
				<ssk-text size="lg" color="primary.500">{order?.orderSerial ?? ''}</ssk-text>
			</div>
		{/if}
	</div>

	<div
		slot="body"
		class={centeredNotice ? 'confirm2-body' : 'modal-body'}
		data-testid="cancel-order.modal"
	>
		{#if step === 1}
			{#if isUnpaid}
				<ssk-text size="md" color="gray.500">{bodyModal}</ssk-text>
			{:else}
				<div class="refund-box" data-testid="cancel-order.refund-box">
					<div class="refund-header">
						<ssk-text size="sm" color="gray.500">{refundAmountLabel}</ssk-text>
						<ssk-text size="sm">
							{`฿${formatPrice(ctx.refundTotal)}`}
						</ssk-text>
					</div>
					{#each ctx.lines as line (line.method)}
						<div class="refund-row" data-testid="cancel-order.refund-row">
							<ssk-text size="sm" color="gray.500">{$i18nKW[line.labelKey]}</ssk-text>
							<ssk-text size="sm" color="danger">
								{`฿${formatPrice(line.amount)}`}
							</ssk-text>
						</div>
					{/each}
				</div>

				<div class="field-label">
					<ssk-text size="md" color="gray.800">{reasonLabel}</ssk-text>
					<ssk-text size="lg" color="danger">*</ssk-text>
				</div>
				{#key show}
					<ssk-radio-group
						noIndent={true}
						group={reasonGroup}
						on:change={handleReasonChange}
						data-testid="cancel-order.reason-group"
					></ssk-radio-group>
				{/key}

				{#if isOther}
					<div class="note-section">
						<ssk-textarea
							value={note}
							limit={200}
							rows={3}
							placeholder={notePlaceholder}
							on:input={handleNoteChange}
							on:change={handleNoteChange}
							data-testid="cancel-order.note"
						></ssk-textarea>
					</div>
				{/if}
			{/if}
		{:else}
			{#each confirm2BodyLines as line}
				<div><ssk-text size="md" color="gray.500">{line}</ssk-text></div>
			{/each}
		{/if}
	</div>

	<div slot="footer" class="modal-footer">
		<ssk-button
			variant="outline"
			themeColor="gray"
			width="full"
			disabled={loading}
			on:click={step === 2 ? handleBackFromConfirm2 : handleCancel}
			data-testid="order-view.cancel-modal.button.cancel"
		>
			<span>{$i18nKW['patona-sellercenter-orderdetail-modal-button-cancel']}</span>
		</ssk-button>
		<ssk-button
			width="full"
			disabled={loading || (step === 1 && !canConfirm)}
			on:click={step === 2 ? submitCancel : handlePrimaryConfirm}
			data-testid="order-view.cancel-modal.button.confirm"
		>
			{$i18nKW[
				centeredNotice
					? 'patona-sellercenter-orderdetail-modal-button-confirm'
					: 'order.payment.confirm_btn'
			]}
		</ssk-button>
	</div>
</ModalWithDivider>

<style>
	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 8px 0;
		width: 100%;
	}

	.title-row {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.modal-footer {
		display: grid;
		width: 100%;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	/* Step-2 confirm: centered notice matching CannotCancelOrderModal (no X, no divider).
	   One block per line so the sentence breaks where the copy intends, not mid-word. */
	.confirm2-body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 100%;
		text-align: center;
		padding: 0 8px;
	}

	.refund-box {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border-radius: 8px;
		background: var(--ssk-colors-gray-50);
		border: 0.5px solid var(--ssk-colors-gray-200);
	}

	.refund-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.refund-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.field-label {
		display: flex;
		align-items: baseline;
		gap: 2px;
		margin-bottom: 4px;
	}

	.note-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
</style>
