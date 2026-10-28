<script lang="ts">
	import { createEventDispatcher, getContext } from 'svelte';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import type { TCartItem } from '$stores/cart';
	import { ConsolidateCartLines } from '$stores/cart/cart';
	import {
		SplitReason,
		groupKindIcon,
		groupKindLabel,
		isDestinationReady,
		isHandoverGroup,
		kindNeedsShippingMethod,
		DeliveryGroupKind,
		type DeliveryGroup
	} from '$lib/entities/order/delivery-group';
	import {
		canRemoveDeliveryGroup,
		deliveryGroups,
		removeUserDeliveryGroup,
		resetDeliveryGroups,
		restoreDeliveryGroup
	} from '$stores/order/delivery-group';
	import { standardDeliveries, sameDayDeliveries } from '$lib/entities/order/order';
	import { currentStore } from '$stores/store/current-store';
	import { formatPriceWithBath } from '$utils/format-number';

	export let groups: DeliveryGroup[];
	export let items: TCartItem[];
	export let activeId: string | undefined;

	const toastStore = getContext<ToastStore>('toast');

	const dispatch = createEventDispatcher<{ activate: string; open: string }>();

	// Only a cashier-made parcel is a place new products can be sent to — the hard splits
	// are the engine's, never somewhere the cashier chose to shop into.
	const canActivate = (g: DeliveryGroup) => !g.locked && g.splitReason === SplitReason.User;

	const itemsOf = (g: DeliveryGroup) => items.filter((i) => !!i.lineId && g.itemIds.includes(i.lineId));
	const subtotalOf = (g: DeliveryGroup) =>
		itemsOf(g).reduce((sum, i) => sum + (isNaN(i.qty) ? 0 : i.qty) * i.price, 0);

	// Numbered by raw store position, the same way the drawer numbers its own parcel
	// cards — "พัสดุ 2" there and "คำสั่งขายกลุ่ม 2" here always refer to the same group,
	// just under the vocabulary that fits each screen (this card list spans pickup
	// fulfilments too, where "พัสดุ"/parcel would read oddly for something never shipped).
	const titleOf = (g: DeliveryGroup, index: number) =>
		isHandoverGroup(g) ? 'รับเลยที่เคาน์เตอร์' : `คำสั่งขายกลุ่ม ${index + 1}`;

	function methodLabel(g: DeliveryGroup): string {
		const found = [...standardDeliveries, ...sameDayDeliveries].find((o) => o.value === g.method);
		return found?.label.replace(/<br\s*\/?>/gi, ' ') ?? g.method ?? '';
	}

	// Read-only per-kind summary line — complex fields (courier pick, address) still
	// require opening the drawer (card-open); this card only ever shows what's already
	// set. A POS sale only ever runs from one physical store, so PickupLater shows the
	// sale's own selling branch rather than a true per-group branch (deferred — no
	// per-group pickupStoreId field exists on DeliveryGroup yet).
	function metaOf(g: DeliveryGroup): string {
		if (g.kind === DeliveryGroupKind.Digital) return g.recipientEmail ?? 'ยังไม่ระบุอีเมล';
		if (g.kind === DeliveryGroupKind.PickupLater) {
			const storeName = $currentStore?.name;
			return storeName ? `รับที่สาขา ${storeName}` : '';
		}
		if (g.kind === DeliveryGroupKind.OnSite) {
			return g.shippingFee !== undefined
				? `ค่าเดินทาง · ${formatPriceWithBath(g.shippingFee)}`
				: 'ยังไม่ระบุค่าเดินทาง';
		}
		if (!kindNeedsShippingMethod(g.kind)) return '';
		if (!g.method) return 'ยังไม่เลือกวิธีส่ง';
		const fee =
			g.shippingFee !== undefined ? formatPriceWithBath(g.shippingFee) : 'ยังไม่ระบุค่าส่ง';
		return `${methodLabel(g)} · ${fee}`;
	}

	function onSelect(g: DeliveryGroup) {
		if (canActivate(g)) {
			// Tapping the active parcel again hands focus back to the default parcel — there
			// is always a way out of "shop into this one".
			dispatch('activate', g.id);
		} else {
			dispatch('open', g.id);
		}
	}

	// This card list has no numbered-parcel context to reference precisely (that detail
	// lives in DrawerDelivery's own remove flow) — a short confirmation plus undo is
	// enough here.
	function onRemove(g: DeliveryGroup, index: number) {
		const removed = removeUserDeliveryGroup(g.id);
		if (!removed) return;

		// Down to one group (or none) — exit group-order mode entirely, same as
		// DrawerDelivery.svelte's own onRemoveGroup: fold any product that existed as
		// separate lines across the groups back into one ordinary cart line
		// (ConsolidateCartLines), since there is no longer a group to explain the split.
		// No "เลิกทำ" here either — the cart lines are already merged, so there is
		// nothing left for an undo to coherently restore.
		if ($deliveryGroups.length <= 1) {
			ConsolidateCartLines();
			resetDeliveryGroups();
			toastStore.addToast({
				message: `ลบ${titleOf(g, index)}แล้ว — กลับเป็นคำสั่งขายปกติ`,
				type: 'success',
				timeout: 5000,
				testId: 'sales.delivery.card.remove.toast'
			});
			return;
		}

		toastStore.addToast({
			message: `ลบ${titleOf(g, index)}แล้ว`,
			type: 'success',
			timeout: 5000,
			testId: 'sales.delivery.card.remove.toast',
			action: { label: 'เลิกทำ', onClick: () => restoreDeliveryGroup(removed) }
		});
	}
</script>

<div class="cards" data-testid="sales.delivery.cards">
	{#each groups as g, index (g.id)}
		{@const active = g.id === activeId}
		{@const missing = g.itemIds.length > 0 && !isDestinationReady(g)}
		{@const removable = canRemoveDeliveryGroup(groups, g.id)}
		<div class="card" class:active class:warn={missing}>
			<button
				type="button"
				class="card-main"
				aria-pressed={canActivate(g) ? active : undefined}
				on:click={() => onSelect(g)}
				data-testid="sales.delivery.card"
			>
				<span class="card-top">
					<ssk-icon
						name={groupKindIcon(g.kind)}
						size="sm"
						themeColor={missing ? 'warning' : 'primary'}
					></ssk-icon>
					<span class="card-title">{titleOf(g, index)}</span>
					{#if active}
						<span class="badge badge-active">กำลังเพิ่มสินค้า</span>
					{/if}
				</span>
				<span class="card-meta">
					<span class="badge">{g.itemIds.length} รายการ</span>
					<!-- Read-only here, always — changing a group's fulfilment type requires
					     opening the drawer (card-open) and going to its own step, not an inline
					     control on this summary card. -->
					<span class="badge">{groupKindLabel(g.kind)}</span>
				</span>
				<ssk-divider class="card-divider" size="xs" margin="sm" color="transparent"></ssk-divider>
				{#if metaOf(g)}
					<span class="card-meta">
						<span class="meta-text">{metaOf(g)}</span>
					</span>
				{/if}
				<span class="card-total">
					<span>ราคารวม</span>
					<span>{formatPriceWithBath(subtotalOf(g))}</span>
				</span>
			</button>
			{#if groups.length > 1}
				<!-- A sibling of card-main, not nested inside it — positioned to overlap the
				     card's top-right corner purely via CSS instead. -->
				<button
					type="button"
					class="card-delete"
					disabled={!removable}
					aria-label={`ลบ${titleOf(g, index)}`}
					title={removable ? `ลบ${titleOf(g, index)}` : 'กลุ่มนี้ไม่สามารถลบได้'}
					on:click|stopPropagation={() => removable && onRemove(g, index)}
					data-testid={`sales.delivery.card.${index}.remove`}
				>
					<ssk-icon name="outline-trash" size="sm" themeColor="gray"></ssk-icon>
				</button>
			{/if}
			<button
				type="button"
				class="card-open"
				aria-label={`จัดการ${titleOf(g, index)}`}
				on:click={() => dispatch('open', g.id)}
			>
				<ssk-icon
					name="solid-chevron-right"
					width="14px"
					height="14px"
					themeColor="stroke"
				></ssk-icon>
			</button>
		</div>
	{/each}
</div>

<style>
	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.card {
		position: relative;
		display: flex;
		align-items: stretch;
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		font-family: var(--ssk-font-family-sans, 'Noto Sans Thai', Roboto, sans-serif);
	}

	.card.active {
		border-color: var(--ssk-colors-primary-500);
		background: var(--ssk-colors-primary-50, #fff4ef);
	}

	/* Same amber the S2 row uses for a parcel with no destination yet. */
	.card.warn {
		border-color: var(--ssk-colors-warning-300, #ffe170);
		background: var(--ssk-colors-warning-50, #fff9e6);
	}

	.card-main {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		/* Extra right padding clears the ✕ button floated over this corner below. */
		padding: 16px 0 16px 16px;
		background: none;
		border: 0;
		border-radius: 8px;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.card-main:focus-visible,
	.card-open:focus-visible,
	.card-delete:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: -2px;
	}

	/* Sibling of card-main (not nested in it — see markup comment), overlapped onto its
	   top-right corner to match the mockup's trash-icon placement beside the title. */
	.card-delete {
		position: absolute;
		top: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 8px;
		cursor: pointer;
	}

	.card-delete:hover {
		background-color: var(--ssk-colors-gray-100);
	}

	.card-delete:disabled {
		color: var(--ssk-colors-gray-300);
		cursor: not-allowed;
	}

	.card-top {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.card-title {
		font-size: var(--ssk-font-size-sm);
		font-weight: 600;
		color: var(--ssk-colors-gray-900);
	}

	.badge {
		padding: 0 0.375rem;
		border-radius: 999px;
		background: var(--ssk-colors-gray-100);
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-700);
	}

	.badge-active {
		background: var(--ssk-colors-primary-500);
		color: #fff;
	}

	.card-meta {
		display: flex;
		gap: 0.5rem;
		min-width: 0;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-600);
	}

	.meta-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-total {
		display: flex;
		justify-content: space-between;
		font-size: var(--ssk-font-size-sm);
		font-weight: 600;
		color: var(--ssk-colors-gray-800);
	}

	.card-open {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		padding: 16px;
		background: none;
		border: 0;
		border-radius: 0 8px 8px 0;
		cursor: pointer;
	}

	.card-divider {
		background-image: repeating-linear-gradient(
			to right,
			var(--ssk-colors-gray-300) 0 4px,
			transparent 4px 8px
		);
		background-position: center;
		background-repeat: no-repeat;
		background-size: 100% 1px;
	}
</style>
