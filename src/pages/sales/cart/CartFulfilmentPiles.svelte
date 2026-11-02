<script lang="ts">
	import type { TCartItem } from '$stores/cart';
	import { SetCartItemFulfilment } from '$stores/cart/cart';
	import {
		basicCategoryLabel,
		BASIC_CATEGORY_ORDER,
		fulfilmentTone,
		groupKindIcon,
		lineFulfilmentOptions,
		resolveLineKind,
		DeliveryGroupKind,
		type LineFulfilmentCtx
	} from '$lib/entities/order/delivery-group';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import CartItem from './CartItem.svelte';

	/**
	 * Basic mode's own list renderer — replaces CartReceivePiles whenever
	 * $groupOrderMode is false (the common case now). Splits the flat cart into one
	 * visual pile per fulfilment category actually present, same bucketing
	 * syncBasicGroups uses, so the piles always agree with the groups the store built.
	 * A single category collapses to the plain <CartItem> list — byte-identical to
	 * today's walk-in cart (B1/B6/B8).
	 */
	export let items: TCartItem[];
	export let saleDefaultKind: DeliveryGroupKind;
	export let lineCtx: LineFulfilmentCtx;
	// Mirrors syncBasicGroups' own honourReceiveMode gate — only a POS จัดส่งให้ลูกค้า
	// sale still means anything by a line's legacy receiveMode.
	export let honourReceiveMode: boolean = false;

	const toastStore = getContext<ToastStore>('toast');

	function effectiveItem(item: TCartItem): TCartItem {
		return honourReceiveMode ? item : { ...item, receiveMode: undefined };
	}

	$: kindOf = (item: TCartItem): DeliveryGroupKind =>
		resolveLineKind(effectiveItem(item), saleDefaultKind, lineCtx);

	function fulfilmentOptionsOf(item: TCartItem): string[] {
		return lineFulfilmentOptions(item, lineCtx);
	}

	function fulfilmentOf(item: TCartItem): string {
		return kindOf(item);
	}

	function onChangeFulfilment(item: TCartItem, kind: string) {
		if (!item.lineId) return;
		const previous = item.lineFulfilment;
		SetCartItemFulfilment(item.lineId, kind);
		toastStore.addToast({
			message: `ย้าย "${item.product_name}" ไป${basicCategoryLabel(kind as DeliveryGroupKind)} แล้ว`,
			type: 'success',
			timeout: 5000,
			testId: 'sales.cart.line.fulfilment.move.toast',
			action: {
				label: 'เลิกทำ',
				onClick: () => SetCartItemFulfilment(item.lineId!, previous)
			}
		});
	}

	interface Bucket {
		kind: DeliveryGroupKind;
		items: TCartItem[];
	}

	// Buckets in the fixed BASIC_CATEGORY_ORDER, only for kinds actually present — never
	// an empty section for a category nobody has a line in.
	$: buckets = BASIC_CATEGORY_ORDER.map(
		(kind): Bucket => ({ kind, items: items.filter((i) => kindOf(i) === kind) })
	).filter((b) => b.items.length > 0);

	// A lone PickupInStore bucket is the ordinary walk-in cart — render it exactly as
	// before, no section header at all.
	$: plainList = buckets.length <= 1 && (buckets[0]?.kind ?? DeliveryGroupKind.PickupInStore) === DeliveryGroupKind.PickupInStore;
</script>

{#if plainList}
	<CartItem {items} {fulfilmentOptionsOf} {fulfilmentOf} {onChangeFulfilment} />
{:else}
	{#each buckets as bucket (bucket.kind)}
		<div
			class="pile-badge"
			data-tone={fulfilmentTone(bucket.kind)}
			data-testid={`sales.cart.pile.${bucket.kind}`}
		>
			<ssk-icon name={groupKindIcon(bucket.kind)} size="xs"></ssk-icon>
			<span>{basicCategoryLabel(bucket.kind)}</span>
			<span class="pile-badge-count">· {bucket.items.length} รายการ</span>
		</div>
		<div class="pile-section">
			<CartItem items={bucket.items} {fulfilmentOptionsOf} {fulfilmentOf} {onChangeFulfilment} />
		</div>
	{/each}
{/if}

<style>
	.pile-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		width: fit-content;
		margin-bottom: 0.375rem;
		padding: 0.25rem 0.625rem;
		border-radius: 999px;
		font-size: var(--ssk-font-size-xs);
		font-weight: 600;
	}

	.pile-badge:not(:first-child) {
		margin-top: 0.75rem;
	}

	.pile-badge-count {
		font-weight: 400;
		opacity: 0.85;
	}

	.pile-section {
		margin-bottom: 0.25rem;
	}

	.pile-badge[data-tone='success'] {
		background: var(--ssk-colors-success-50, #ecfdf5);
		color: var(--ssk-colors-success-700, #047857);
	}

	.pile-badge[data-tone='warning'] {
		background: var(--ssk-colors-warning-50, #fffbeb);
		color: var(--ssk-colors-warning-700, #b45309);
	}

	.pile-badge[data-tone='info'] {
		background: var(--ssk-colors-info-50, #eff6ff);
		color: var(--ssk-colors-info-700, #1d4ed8);
	}

	.pile-badge[data-tone='violet'] {
		background: var(--ssk-colors-violet-50, #f5f3ff);
		color: var(--ssk-colors-violet-700, #6d28d9);
	}

	.pile-badge[data-tone='primary'] {
		background: var(--ssk-colors-primary-50, #fff7ed);
		color: var(--ssk-colors-primary-700, #c2410c);
	}
</style>
