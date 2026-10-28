<script lang="ts">
	import type { TCartItem } from '$stores/cart';
	import { SetCartItemReceiveMode } from '$stores/cart/cart';
	import { hasSplitDelivery } from '$stores/order/delivery-group';
	import {
		ReceiveMode,
		canReceiveNow,
		isServiceItem,
		receiveModeOf
	} from '$lib/entities/order/delivery-group';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import CartItem from './CartItem.svelte';

	/**
	 * Option B — the line's position in the list IS the answer to "รับตอนนี้ or ส่ง later",
	 * so this container is two visible piles instead of one flat list, with a chevron on
	 * each row to move it (see CartItem's `pile`/`onMovePile`). Only ever mounted on a POS
	 * จัดส่งให้ลูกค้า sale — every other sale keeps rendering the plain <CartItem> in
	 * Cart.svelte (C4), so nothing here can affect how those render.
	 */
	export let items: TCartItem[];
	export let sellingOriginId: string | undefined = undefined;

	const toastStore = getContext<ToastStore>('toast');

	// A service item (gift wrap, ...) is performed, not received or shipped — it belongs
	// to neither pile, so it is pulled out before either pile is computed.
	$: serviceItems = items.filter((i) => isServiceItem(i.fulfilmentType));
	$: receivable = items.filter((i) => !isServiceItem(i.fulfilmentType));

	// canReceiveNow is not redundant with receiveMode here: a line can carry a stale "now"
	// from before it became un-receivable (foreign origin, a digital item slipping in, ...)
	// — syncDeliveryGroups already falls exactly that case through to shipping (see its own
	// comment on the handover step), so re-checking it here keeps the pile the cashier SEES
	// in agreement with the handover group the store actually builds, instead of showing a
	// line as "received" that ships regardless the moment the sale is rung up.
	$: nowItems = receivable.filter(
		(i) =>
			receiveModeOf(i.receiveMode) === ReceiveMode.Now && canReceiveNow(i, { sellingOriginId })
	);
	$: nowItemIds = new Set(nowItems.map((i) => i.product_id));
	$: shipItems = receivable.filter((i) => !nowItemIds.has(i.product_id));

	const qtyOf = (list: TCartItem[]): number => list.reduce((sum, i) => sum + i.qty, 0);

	// One toast shape for both directions, mirroring DrawerDelivery's own showMoveUndo: a
	// success toast naming what moved where, with an undo that just flips the mode back —
	// no history stack needed since each closure already knows the one line it moved.
	function announceMove(item: TCartItem, mode: ReceiveMode) {
		const pileName = mode === ReceiveMode.Now ? 'รับทันที' : 'จัดส่ง';
		const previousMode = mode === ReceiveMode.Now ? ReceiveMode.Ship : ReceiveMode.Now;
		toastStore.addToast({
			message: `ย้าย "${item.product_name}" ไปกอง${pileName} แล้ว`,
			type: 'success',
			timeout: 5000,
			testId: 'sales.cart.receive.move.toast',
			action: { label: 'เลิกทำ', onClick: () => SetCartItemReceiveMode(item.product_id, previousMode) }
		});
	}

	// syncDeliveryGroups (Cart.svelte) is already reactive on cartList and rebuilds the
	// delivery groups on its own once the mode changes — these two only ever persist the
	// cashier's choice, same as every other per-line edit in stores/cart/cart.ts.
	function moveToShip(item: TCartItem) {
		SetCartItemReceiveMode(item.product_id, ReceiveMode.Ship);
		announceMove(item, ReceiveMode.Ship);
	}

	function moveToNow(item: TCartItem) {
		SetCartItemReceiveMode(item.product_id, ReceiveMode.Now);
		announceMove(item, ReceiveMode.Now);
	}
</script>

<!-- Keep an empty receive-now pile visible only when multiple groups make it a useful
     destination; the plain one-group shipping case does not need this extra section. -->
{#if nowItems.length > 0 || $hasSplitDelivery}
	<div class="pile-header now" data-testid="sales.cart.pile.now">
		<ssk-icon name="outline-shopping-bag" size="xs"></ssk-icon>
		<span>รับทันที</span>
		<span class="pile-count">{nowItems.length} รายการ · {qtyOf(nowItems)} ชิ้น</span>
	</div>
	{#if nowItems.length > 0}
		<CartItem items={nowItems} pile="now" onMovePile={moveToShip} {sellingOriginId} />
	{:else}
		<div class="pile-empty">
			ยังไม่มีของที่ลูกค้ารับกลับเลย — กดปุ่มลูกศรขึ้นที่รายการด้านล่างเพื่อย้ายขึ้นมา
		</div>
	{/if}
{/if}

{#if shipItems.length > 0}
	<CartItem items={shipItems} pile="ship" onMovePile={moveToNow} {sellingOriginId} />
{:else}
	<div class="pile-empty">
		ไม่มีของต้องจัดส่ง — ลูกค้ารับกลับทั้งหมด เปลี่ยนเป็น “รับสินค้าไปเลย” ได้ที่ด้านบน
	</div>
{/if}

{#if serviceItems.length > 0}
	<div class="pile-header service" data-testid="sales.cart.pile.service">
		<ssk-icon name="outline-sparkles" size="xs"></ssk-icon>
		<span>บริการ</span>
		<span class="pile-count">{serviceItems.length} รายการ</span>
	</div>
	<!-- No `pile` prop: a service item joins neither pile, so its row gets no chevron and
	     no move handler — CartItem renders it exactly as the plain single-list cart would. -->
	<CartItem items={serviceItems} />
	<div class="pile-note">ไม่ต้องจัดส่งและไม่ต้องรับที่เคาน์เตอร์</div>
{/if}

<style>
	.pile-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		font-size: var(--ssk-font-size-xs);
		font-weight: 600;
		padding: 0.375rem 0.5rem;
		border-radius: 6px;
		margin: 0.5rem 0 0.25rem;
	}

	.pile-header:first-child {
		margin-top: 0;
	}

	.pile-header.now {
		color: var(--ssk-colors-success-600);
		background: var(--ssk-colors-success-50);
	}

	.pile-header.ship {
		color: var(--ssk-colors-info-700);
		background: var(--ssk-colors-info-50);
	}

	.pile-header.service {
		color: var(--ssk-colors-gray-600);
		background: var(--ssk-colors-gray-50);
	}

	.pile-count {
		margin-left: auto;
		flex: 0 1 auto;
		min-width: 0;
		font-weight: 500;
		opacity: 0.85;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pile-empty {
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
		text-align: center;
		border: 1px dashed var(--ssk-colors-gray-200);
		border-radius: 7px;
		padding: 0.625rem;
		line-height: 1.5;
	}

	.pile-note {
		padding: 0.125rem 0.125rem 0.5rem;
		font-size: var(--ssk-font-size-xs);
		line-height: 1.4;
		color: var(--ssk-colors-gray-500);
	}
</style>
