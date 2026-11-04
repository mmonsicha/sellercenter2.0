<script context="module" lang="ts">
	import { writable } from 'svelte/store';
	// Shared by every CartItem instance (CartFulfilmentPiles renders one per pile) — a
	// plain per-instance variable couldn't tell a row in pile B "something is being
	// dragged, but not from here" apart from "nothing is being dragged at all", since the
	// drag always starts in a DIFFERENT component instance (pile A). That ambiguity used
	// to make a hovered row in pile B show the same-pile "reorder here" dashed outline
	// even for a cross-pile drag, which only ever moves the WHOLE line into pile B, not to
	// that row's specific position.
	const draggingLineId = writable<string | undefined>(undefined);
</script>

<script lang="ts">
	import CustomInputNumber from '$components/CustomInputNumber.svelte';
	import Modal from '$components/modal/Modal.svelte';
	import type { TCartItem } from '$stores/cart';
	import {
		GetExistingCart,
		MergeCartLines,
		ReorderCartItems,
		RemoveCartItem,
		UpdateCartItemQty
	} from '$stores/cart/cart';
	import { setCartItemInfo, setCurrentCartId } from '$stores/cart/cart-item';
	import { deliveryGroups, showDeliveryDetail } from '$stores/order/delivery-group';
	import {
		DeliveryGroupKind,
		ItemFulfilmentType,
		basicCategoryLabel,
		groupKindIcon,
		groupKindLabel,
		isServiceItem,
		itemFulfilmentOf,
		receiveNowBlockReason,
		splitReasonText,
		type DeliveryGroup
	} from '$lib/entities/order/delivery-group';
	import { setSelectedProduct, setVariantValue } from '$stores/variant/variant';
	import {
		showEditVariantModal,
		toggleEditVariantModal
	} from '$stores/variant/variant-handler-modal';
	import { formatPriceWithBath } from '$utils/format-number';
	import { getImageUrl } from '$utils/image-url';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { toSaleProduct } from './util.cart';
	import { currentLanguage } from '$stores/i18n';

	// S1 badges (multi-destination foundation) only ever appear once the delivery detail
	// is worth showing — a real split, OR a lone digital parcel (see showDeliveryDetail)
	// — so an ordinary single-parcel physical sale must render byte-identical to today.
	$: distinctOriginCount = new Set(items.map((i) => i.originName).filter(Boolean)).size;

	// Badge kind falls back to the item's own fulfilmentType when it isn't (yet) in a
	// group — keeps the badge meaningful even a tick before syncDeliveryGroups runs.
	// Never called for a service item — those get their own badge below, never a parcel
	// kind, because syncDeliveryGroups never puts them in a group to begin with.
	function badgeKindFor(item: TCartItem, group: DeliveryGroup | undefined): DeliveryGroupKind {
		if (group) return group.kind;
		return itemFulfilmentOf(item.fulfilmentType) === ItemFulfilmentType.Digital
			? DeliveryGroupKind.Digital
			: DeliveryGroupKind.Shipping;
	}

	function badgeThemeColor(kind: DeliveryGroupKind): string {
		switch (kind) {
			case DeliveryGroupKind.Digital:
				return 'primary';
			case DeliveryGroupKind.PickupLater:
				return 'amber';
			case DeliveryGroupKind.PickupInStore:
				// Handed over at the counter reads as a completed, positive state — the same
				// green as Option B's รับทันที pile header and the drawer's handover card, not
				// the neutral gray a still-in-transit line would wear.
				return 'success';
			case DeliveryGroupKind.Shipping:
			default:
				return 'sky';
		}
	}

	export var items: TCartItem[];
	export let order: boolean = false;
	// Option B — which pile this slice of the list is rendering. `undefined` means the
	// ordinary single-list cart, which must render exactly as it did before this feature.
	export let pile: 'now' | 'ship' | undefined = undefined;
	export let onMovePile: ((item: TCartItem) => void) | undefined = undefined;
	export let sellingOriginId: string | undefined = undefined;
	// Basic mode's per-line fulfilment picker (CartFulfilmentPiles). All three undefined
	// (the `pile`/CartReceivePiles call sites, and the ordinary single-list cart) means
	// no picker renders at all — byte-identical to today's row.
	export let fulfilmentOptionsOf: ((item: TCartItem) => string[]) | undefined = undefined;
	export let fulfilmentOf: ((item: TCartItem) => string) | undefined = undefined;
	export let onChangeFulfilment: ((item: TCartItem, kind: string) => void) | undefined = undefined;
	// Modal.svelte toggles its "show" attribute via document.querySelector on a DOM id
	// built from this id — when CartFulfilmentPiles renders one <CartItem> per bucket,
	// several instances exist in the DOM at once. Without a per-instance suffix here they
	// would all share the same "trash"/"zero-qty" DOM id, so querySelector would always
	// grab the FIRST one in the document regardless of which bucket's modal was actually
	// opened — the wrong row would appear to not delete, and the modal it was really
	// shown in would never see its own ShowModal flip back to false.
	export let instanceId: string | undefined = undefined;
	// Modal.svelte looks this up as a CSS id selector (document.querySelector('#'+id)) —
	// anything outside [a-zA-Z0-9_-] (a branch/store id with punctuation, say) would be
	// parsed as CSS syntax (a stray `:` reads as a pseudo-class) and throw, silently
	// breaking that pile's remove/zero-qty modal. Sanitized here once rather than trusting
	// every caller of `instanceId` to already produce a safe string.
	$: modalIdSuffix = instanceId ? `-${instanceId.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
	var showRemoveModal: boolean = false;
	var showZeroQtyModal: boolean = false;
	var removeItem: TCartItem = items[0];

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	let titleRemove = '';

	function handleTrashButton(item: TCartItem) {
		removeItem = item;
		showRemoveModal = true;
	}

	function toggleRemoveModal() {
		showRemoveModal = !showRemoveModal;
	}

	function toggleZeroQtyModal() {
		showZeroQtyModal = !showZeroQtyModal;
	}

	function _onRemoveOK() {
		showRemoveModal = false;
		RemoveCartItem(removeItem.lineId!);
		toastStore.addToast({
			message: 'นำสินค้าออกสำเร็จ',
			type: 'success',
			timeout: 5000
		});
	}

	// Option B renders the list as pile-local slices (now/ship), so a loop index is no
	// longer a stable identity for the full cart — the same product can sit at index 0 in
	// one pile and index 3 in the whole cart. Look the line up by lineId instead of
	// trusting the position it happens to render at — product_id alone is ambiguous now
	// that the same SKU can exist as several independent lines across delivery groups.
	async function _onClickCart(item: TCartItem) {
		setVariantValue([]);

		if (!!item.options) {
			const existingCart = GetExistingCart().find((c) => c.lineId === item.lineId);
			const productInCart = await toSaleProduct(item);

			if (productInCart) {
				setCurrentCartId(item.lineId!);
				setSelectedProduct(productInCart);
				setCartItemInfo(item);
				setVariantValue(existingCart?.options ?? []);
				toggleEditVariantModal($showEditVariantModal);
			}
		}
	}

	function _onZeroQtyOK() {
		showZeroQtyModal = false;
		RemoveCartItem(removeItem.lineId!);
		toastStore.addToast({
			message: 'นำสินค้าออกสำเร็จ',
			type: 'success',
			timeout: 5000
		});
	}

	// `as DeliveryGroupKind` inline in markup breaks Svelte's template parser (consumed
	// as module script, not an expression) — this wrapper only satisfies TS in the
	// template, the underlying function accepts the plain string fine at runtime.
	function labelOf(kind: string): string {
		return basicCategoryLabel(kind as DeliveryGroupKind);
	}

	// Drag & drop replaces the old per-line dropdown entirely — now that "เพิ่มตัวเลือก
	// รับสินค้า" opens a pile up front, moving a line between piles (or just reordering it
	// within one) is a drag, not a picker. Dropping a line back onto its OWN pile here only
	// ever needs to reorder — moving it to a DIFFERENT pile is handled one level up, where
	// the pile's kind is known (see CartFulfilmentPiles.svelte).
	let dragOverLineId: string | undefined;
	// Whether the line currently being dragged (module-level draggingLineId, shared across
	// every pile's own CartItem instance) actually belongs to THIS pile — only then does a
	// hovered row mean "reorder to here" rather than "move into this pile generally".
	$: draggingIsOwnLine = $draggingLineId !== undefined && items.some((i) => i.lineId === $draggingLineId);

	function onDragStartItem(e: DragEvent, item: TCartItem) {
		if (!item.lineId) return;
		draggingLineId.set(item.lineId);
		e.dataTransfer?.setData('text/plain', item.lineId);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onDragEndItem() {
		draggingLineId.set(undefined);
		dragOverLineId = undefined;
	}

	function onDragOverRow(e: DragEvent, item: TCartItem) {
		e.preventDefault();
		if (draggingIsOwnLine) dragOverLineId = item.lineId;
	}

	// Reorders within THIS list only — a dragged line that isn't one of `items` came from
	// a different pile, so it's left alone here and the drop bubbles up to whichever
	// pile-section container actually owns that kind (see CartFulfilmentPiles.svelte).
	// Dropped onto another row of the SAME product, though, there's nothing left to tell
	// the two rows apart (same pile, same product) — merge instead of reordering, same as
	// a cross-pile drop onto a same-product line does (CartFulfilmentPiles' onDropOnPile).
	function onDropOnRow(e: DragEvent, targetItem: TCartItem) {
		const draggedId = e.dataTransfer?.getData('text/plain');
		dragOverLineId = undefined;
		if (!draggedId || draggedId === targetItem.lineId) return;
		const draggedItem = items.find((i) => i.lineId === draggedId);
		if (draggedItem && targetItem.lineId && draggedItem.product_id === targetItem.product_id) {
			e.preventDefault();
			e.stopPropagation();
			MergeCartLines(targetItem.lineId, draggedId);
			return;
		}
		const ids = items.map((i) => i.lineId).filter((id): id is string => !!id);
		const from = ids.indexOf(draggedId);
		const to = ids.indexOf(targetItem.lineId ?? '');
		if (from < 0 || to < 0) return;
		e.preventDefault();
		e.stopPropagation();
		const reordered = [...ids];
		reordered.splice(from, 1);
		reordered.splice(to, 0, draggedId);
		ReorderCartItems(reordered);
	}

	function _onUpdateItemQty(item: TCartItem) {
		if (item.qty === 0) {
			removeItem = item;
			showZeroQtyModal = true;
		}
		UpdateCartItemQty(item.lineId!, item.qty);
	}

	const loadKeywords = async () => {
		titleRemove = await i18nStore.get(
			'patona-sellercenter-sales-modal-remove-title-remove',
			$currentLanguage.code,
			'default'
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

<Modal
	toggleModal={toggleRemoveModal}
	id={`trash${modalIdSuffix}`}
	icon="outline-exclamation-circle"
	iconColor="#d97706"
	ShowModal={showRemoveModal}
	title={titleRemove}
>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={async () => {
			showRemoveModal = false;
		}}
	>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-remove-button-cancel"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button width="full" slot="modal-footer-right" on:click={_onRemoveOK}>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-remove-button-remove"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</Modal>

<Modal
	toggleModal={async () => {
		UpdateCartItemQty(removeItem.lineId ?? '', 1);
		toggleZeroQtyModal();
	}}
	id={`zero-qty${modalIdSuffix}`}
	icon="outline-exclamation-circle"
	iconColor="#d97706"
	ShowModal={showZeroQtyModal}
	title={titleRemove}
>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={async () => {
			UpdateCartItemQty(removeItem.lineId ?? '', 1);
			showZeroQtyModal = false;
		}}
	>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-remove-button-cancel"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button width="full" slot="modal-footer-right" on:click={_onZeroQtyOK}>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-remove-button-remove"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</Modal>

{#each items as item}
	{#if order}
		<div class="grid-container order">
			<div class="image">
				<img src={getImageUrl(item.image)} alt={item.product_name} />
			</div>
			<div class="detail">
				<div class="name"><ssk-text>{item.product_name}</ssk-text></div>
				{#if item.options}
					<div class="option">
						{#each item.options as option}
							<ssk-text size="xs">{option.key}: <span>{option.value}</span></ssk-text>
						{/each}
					</div>
				{/if}

				<div class="price">
					<ssk-text color="primary">{formatPriceWithBath(item.price)}</ssk-text>
				</div>
			</div>
			<div class="qty-order">
				<ssk-text>{item.qty}</ssk-text>
			</div>
		</div>
	{:else}
		<!-- Only the ship pile's rows can ever be blocked from moving up (a now-pile row
		     always CAN move down — see 1c/1e) — computed once here so both the button's
		     disabled/label logic and the reason line below read the same value. -->
		{@const blockReason = pile === 'ship' ? receiveNowBlockReason(item, { sellingOriginId }) : undefined}
		<div
			class="grid-container"
			class:dragging={$draggingLineId === item.lineId}
			class:drag-over={dragOverLineId === item.lineId && $draggingLineId !== item.lineId}
			draggable={true}
			on:click={() => _onClickCart(item)}
			on:dragstart={(e) => onDragStartItem(e, item)}
			on:dragend={onDragEndItem}
			on:dragover={(e) => onDragOverRow(e, item)}
			on:dragleave={() => (dragOverLineId = undefined)}
			on:drop={(e) => onDropOnRow(e, item)}
			data-testid={`sales.cart.line.row.${item.lineId}`}
		>
			<!-- The standalone trash column is gone: at qty 1 the minus below turns into the
			     trash, so removal lives in one place instead of two, and the row keeps the
			     width for the product name. Draggable so a line can be reordered or moved to
			     another fulfilment pile (see onDragStartItem/onDropOnRow and
			     CartFulfilmentPiles' own pile-level drop targets) — replaces the old per-line
			     dropdown now that "เพิ่มตัวเลือกรับสินค้า" opens piles up front instead. -->
			<div class="image">
				<img src={getImageUrl(item.image)} alt={item.product_name} />
			</div>
			<div class="detail">
				<!-- One line, ellipsised: the panel is ~340px at 1024 and this row also holds a
				     thumbnail and the qty stepper, so a wrapping name pushed the badge and the
				     price onto lines of their own. The full name stays reachable on hover. -->
				<div class="name" title={item.product_name}><ssk-text>{item.product_name}</ssk-text></div>
				{#if item.options}
					<div class="option">
						{#each item.options as option}
							<span class="overflow-ellipsis"
								>{option.key}: <span class="gray">{option.value}</span></span
							>
						{/each}
					</div>
				{/if}
				{#if item.input}
					<div class="input">
						{#each item.input as inp}
							{#if inp.value && inp.value.length + inp.key.length > 60}
								<ssk-tooltip
									size="sm"
									color="currentcolor"
									hideCloseButton={true}
									themeColor="white"
									placement="top"
									areaPosition="50%"
								>
									<div class="tooltip-content" slot="content">
										<ssk-text size="xs">{inp.value}</ssk-text>
									</div>
									<span class="overflow-ellipsis">
										{inp.key}:
										<span class="gray">{inp.value}</span>
									</span>
								</ssk-tooltip>
							{:else}
								<span class="overflow-ellipsis">
									{inp.key}:
									<span class="gray">{inp.value}</span>
								</span>
							{/if}
						{/each}
					</div>
				{/if}
				<!-- Badge and price share one line: both are short, and pairing them frees the
				     row of a line while putting the two things a cashier scans for — what kind
				     of item this is, and what it costs — side by side. -->
				<div class="meta-line">
					<!-- With the per-line picker, the section header already names the category. -->
					{#if $showDeliveryDetail && !fulfilmentOf}
						<div class="delivery-badges">
							{#if isServiceItem(item.fulfilmentType)}
								<!-- A service item joins no group (see syncDeliveryGroups), so it gets its
							     own badge instead of inheriting a parcel kind it doesn't have. -->
								<ssk-badge variant="subtle" themeColor="violet">
									<ssk-icon name="outline-sparkles" size="xs"></ssk-icon>
									บริการ
								</ssk-badge>
							{:else}
								{@const group = $deliveryGroups.find((g) => !!item.lineId && g.itemIds.includes(item.lineId))}
								{@const kind = badgeKindFor(item, group)}
								<!-- The pile header already says รับทันที/จัดส่ง, so the one badge that
								     would only repeat it is dropped — Digital/service/origin badges stay,
								     they say something the pile does not (1d). -->
								{@const suppressKindBadge =
									(pile === 'ship' && kind === DeliveryGroupKind.Shipping) ||
									(pile === 'now' && kind === DeliveryGroupKind.PickupInStore)}
								{#if !suppressKindBadge}
									<ssk-badge variant="subtle" themeColor={badgeThemeColor(kind)}>
										<ssk-icon name={groupKindIcon(kind)} size="xs"></ssk-icon>
										{groupKindLabel(kind)}
										{#if group?.locked}
											<ssk-tooltip
												size="sm"
												color="currentcolor"
												hideCloseButton={true}
												themeColor="white"
												placement="top"
											>
												<span slot="content">
													<ssk-text size="xs">{splitReasonText(group.splitReason)}</ssk-text>
												</span>
												<ssk-icon name="outline-lock-closed" size="xs"></ssk-icon>
											</ssk-tooltip>
										{/if}
										{#if !item.fulfilmentType}
											<ssk-tooltip
												size="sm"
												color="currentcolor"
												hideCloseButton={true}
												themeColor="white"
												placement="top"
											>
												<span slot="content">
													<ssk-text size="xs">ไม่ทราบประเภทสินค้า ระบบถือว่าต้องจัดส่ง</ssk-text>
												</span>
												<ssk-icon name="outline-exclamation-circle" size="xs"></ssk-icon>
											</ssk-tooltip>
										{/if}
									</ssk-badge>
								{/if}
								{#if item.originName && distinctOriginCount > 1}
									<ssk-badge variant="subtle" themeColor="gray">{item.originName}</ssk-badge>
								{/if}
							{/if}
						</div>
					{/if}
					<div class="price">
						<ssk-text color="primary">{formatPriceWithBath(item.price)}</ssk-text>
					</div>
				</div>
				{#if fulfilmentOptionsOf && fulfilmentOf}
					{@const options = fulfilmentOptionsOf(item)}
					{@const current = fulfilmentOf(item)}
					{#if options.length === 1 && current !== DeliveryGroupKind.Shipping}
						<!-- Digital/service have exactly one legal destination — shown as a
						     read-only badge; nothing to pick, and nowhere else it could be
						     dragged to (see lineFulfilmentOptions). Marketplace Shipping is
						     suppressed entirely per spec (B8: no per-line picker at all). -->
						<span
							class="line-fulfilment-badge"
							data-testid={`sales.cart.line.fulfilment.${item.lineId}`}
						>
							{labelOf(current)}
						</span>
					{/if}
				{/if}
				{#if pile === 'ship' && blockReason}
					<!-- Names the actual blocker on the row itself — what stops a cashier
					     pressing a dead ▲ and only finding out at the pay gate. -->
					<div class="block-reason">
						<ssk-icon name="outline-lock-closed" size="xs"></ssk-icon>
						<span>{blockReason}</span>
					</div>
				{/if}
			</div>
			<div class="qty">
				<CustomInputNumber
					bind:value={item.qty}
					layout="horizontal"
					removeAtMin
					onRemove={() => handleTrashButton(item)}
					onChange={() => _onUpdateItemQty(item)}
				/>
			</div>
		</div>
	{/if}
{/each}

<style>
	img {
		object-fit: cover;
		border-radius: 4px;
		width: 56px;
		height: 56px;
	}

	.detail {
		justify-self: left;
		/* Without this the text column refuses to shrink below its widest word, so the
		   grid's 1fr never actually gives ground and every child wraps instead. */
		min-width: 0;
		width: 100%;
	}

	/* Single line, ellipsised — see the comment on the element. */
	.name {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.name ssk-text {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta-line {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		margin-top: 0.125rem;
	}

	/* The price holds its ground; the badge is what gives way if the row runs out. */
	.meta-line .price {
		flex: 0 0 auto;
	}

	.delivery-badges {
		/* Only ever rendered when $showDeliveryDetail is true, so an ordinary single-parcel
		   physical sale never pays for this row's layout at all. */
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}

	/* Why a blocked ▲ is blocked, named on the row instead of only in a tooltip a
	   cashier has to think to hover. */
	.block-reason {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.125rem;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
		line-height: 1.4;
	}

	/* A badge must never break its own label: "รับที่ร้าน" split into two lines inside a
	   single pill at 1024px, which read as a rendering fault rather than a label. It
	   ellipsises as one piece instead, and the same word is in the parcel drawer. */
	.delivery-badges ssk-badge {
		flex: 0 1 auto;
		min-width: 0;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.line-fulfilment-badge {
		display: inline-block;
		/* 0.125rem matches the same stacked-line rhythm .meta-line and .block-reason
		   use elsewhere in this row, rather than the one-off 0.1875rem this used to carry. */
		margin-top: 0.125rem;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
	}

	.qty {
		/* Row of [+][value][−/trash]; wide enough that the three never wrap. */
		width: auto;
	}

	.qty-order {
		width: 1rem;
	}

	.grid-container {
		cursor: grab;
		display: grid;
		/* image | detail | qty — the trash column was folded into the qty control.
		   minmax(0, 1fr), not 1fr: a plain 1fr floors at the content's min-content width,
		   which is what let the middle column win space back from itself and wrap. */
		grid-template-columns: auto minmax(0, 1fr) auto;
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		align-items: center;
		margin-bottom: 1rem;
		gap: 1rem;
		padding: 0.5rem 1rem;
		transition: opacity 0.1s, border-color 0.1s;
	}

	/* Being dragged — kept visible rather than hidden so the cashier still has a visual
	   anchor for where it came from while deciding where to drop it. */
	.grid-container.dragging {
		opacity: 0.5;
	}

	/* The row currently under the dragged line — reordering lands it here on drop (see
	   onDropOnRow); a moved-to-a-different-pile drop is the pile section's own border
	   highlight instead (see CartFulfilmentPiles.svelte). */
	.grid-container.drag-over {
		border-color: var(--ssk-colors-primary-400, #ff8a4c);
		border-style: dashed;
	}

	/* The cart panel is ~340px at 1024px. A 56px thumbnail plus two 16px gutters plus the
	   qty stepper left the name about 100px — so the tighter geometry applies to the cart
	   row only; the read-only order row (.order) sits in a wide modal and keeps its own. */
	.grid-container:not(.order) {
		grid-template-columns: 2.75rem minmax(0, 1fr) auto;
		gap: 0.625rem;
		padding: 0.5rem 0.625rem;
	}

	.grid-container:not(.order) img {
		display: block;
		width: 44px;
		height: 44px;
	}

	/* The stepper is the row's fixed anchor: it never shrinks, so the text column is the
	   one that yields — which is the balance the row was missing. */
	.grid-container:not(.order) .qty {
		flex: none;
		white-space: nowrap;
		justify-self: end;
	}

	.grid-container.order {
		grid-template-columns: auto 1fr auto;
	}
	.grid-container:first-child {
		margin-top: 0.5rem;
	}
	.grid-container:last-child {
		margin-bottom: 0;
	}

	.grid-container > div {
		align-content: center;
	}

	.option {
		display: flex;
		/* 13rem was a hard 208px — wider than the whole text column at 1024px, so the
		   variant line pushed the row open no matter what the grid said. */
		max-width: 100%;
		min-width: 0;
		gap: 0.375rem;
	}

	.option > .overflow-ellipsis {
		width: fit-content;
		min-width: 0;
	}

	.overflow-ellipsis {
		display: block;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		/* Was 18px — larger than the 16px product name it sits under, which inverted the
		   hierarchy and cost the row width it did not have. Secondary line, secondary size,
		   same step the cart's other sub-lines use. */
		font-size: var(--ssk-font-size-xs);
	}

	span.gray {
		color: var(--ssk-colors-gray-500);
	}

	.tooltip-content {
		max-width: 14rem;
		word-wrap: break-word;
		white-space: normal;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* The cart panel is already tight at 1024px per the comment above (~340px, 56px
	   thumbnail + gutters + stepper leaves ~100px for the name). The panel stays side
	   by side with the product pane at every width (Sale.svelte never stacks them),
	   so on a 375px phone this panel is squeezed down to its own even narrower share
	   of the screen (see Sale.svelte's shrinking `.right-section` min-width) rather
	   than becoming full width — the same squeeze applies, just starting from less
	   room. Shrink the thumbnail and side padding a bit further so the name/price
	   keep a usable width instead of ellipsising almost immediately. */
	@media (max-width: 480px) {
		.grid-container:not(.order) {
			gap: 0.5rem;
			padding: 0.375rem 0.5rem;
		}

		.grid-container:not(.order) img {
			width: 36px;
			height: 36px;
		}
	}
</style>
