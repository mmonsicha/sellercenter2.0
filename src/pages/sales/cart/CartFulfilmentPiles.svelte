<script lang="ts">
	import type { TCartItem } from '$stores/cart';
	import {
		MergeCartLines,
		SetCartItemFulfilment,
		SetCartItemPickupStore,
		SetCartItemAddressId,
		type OpenFulfilmentPile
	} from '$stores/cart/cart';
	import type { Store } from '$lib/entities/store/store';
	import type { Address } from '$lib/entities/customer/customer';
	import { addressToDisplay } from '$utils/format-address';
	import {
		basicCategoryLabel,
		BASIC_CATEGORY_ORDER,
		displayKindOf,
		lineFulfilmentOptions,
		resolveLineKind,
		pickupDateTimeText,
		isGroupFulfilmentComplete,
		DeliveryGroupKind,
		type DeliveryGroup,
		type LineFulfilmentCtx
	} from '$lib/entities/order/delivery-group';
	import { standardDeliveries, sameDayDeliveries } from '$lib/entities/order/order';
	import { formatPriceWithBath } from '$utils/format-number';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import CartItem from './CartItem.svelte';

	/**
	 * Basic mode's own list renderer — replaces the old CartReceivePiles entirely. Splits
	 * the flat cart into one visual pile per fulfilment category actually present, same
	 * bucketing syncBasicGroups uses, so the piles always agree with the groups the store
	 * built. A single category collapses to the plain <CartItem> list — byte-identical to
	 * today's walk-in cart (B1/B6/B8).
	 */
	export let items: TCartItem[];
	export let saleDefaultKind: DeliveryGroupKind;
	export let lineCtx: LineFulfilmentCtx;
	// Mirrors syncBasicGroups' own honourReceiveMode gate — only a POS จัดส่งให้ลูกค้า
	// sale still means anything by a line's legacy receiveMode.
	export let honourReceiveMode: boolean = false;
	// "เพิ่มตัวเลือกรับสินค้า" — piles the cashier opened but hasn't put anything in yet
	// (see openFulfilmentPiles in $stores/cart/cart). Rendered as an empty, still-droppable
	// section below; `branches`/`salePickupStoreId` name a รับภายหลัง pile's own branch.
	export let openPiles: OpenFulfilmentPile[] = [];
	export let branches: Store[] = [];
	export let salePickupStoreId: string = '';
	// "เพิ่มตัวเลือกรับสินค้า" Shipping piles only — the customer's own address book, so a
	// non-default Shipping bucket's label can show the actual address, same as a
	// non-default PickupLater bucket shows the actual branch name via `branches` above.
	export let addresses: Address[] = [];
	// Read-only, for the badge's own detail line (branch+date / address-tag+courier+fee /
	// address-tag+fee below) — every write still goes through onEditPile's drawer, this
	// component never calls updateDeliveryGroup itself.
	export let deliveryGroups: DeliveryGroup[] = [];
	export let onRemoveOpenPile: ((pile: OpenFulfilmentPile) => void) | undefined = undefined;
	// Which pile a freshly-tapped product lands in right now (see activeFulfilmentPile in
	// $stores/cart/cart) — highlighted so the cashier can tell at a glance, and clicking
	// any pile's own header hands this to onSetActivePile to switch (or clear) it.
	export let activePile: OpenFulfilmentPile | undefined = undefined;
	export let onSetActivePile: ((pile: OpenFulfilmentPile | undefined) => void) | undefined =
		undefined;
	// Opens this pile's own settings drawer (branch/date/time for รับภายหลัง, address/fee for
	// Shipping/OnSite).
	export let onEditPile:
		| ((kind: DeliveryGroupKind, pickupStoreId?: string, addressId?: string) => void)
		| undefined = undefined;

	// PickupInStore is the only hard, system-decided kind with nothing of its own to set.
	// Digital has one thing to manage — where it's sent — same as every other kind here.
	function hasSettings(kind: DeliveryGroupKind): boolean {
		return (
			kind === DeliveryGroupKind.Shipping ||
			kind === DeliveryGroupKind.OnSite ||
			kind === DeliveryGroupKind.PickupLater ||
			kind === DeliveryGroupKind.Digital
		);
	}

	function settingsLabel(kind: DeliveryGroupKind): string {
		switch (kind) {
			case DeliveryGroupKind.Shipping:
				return 'ตั้งค่าการจัดส่ง';
			case DeliveryGroupKind.OnSite:
				return 'ตั้งค่าค่าเดินทาง';
			case DeliveryGroupKind.PickupLater:
				return 'ตั้งค่าการรับสินค้า';
			case DeliveryGroupKind.Digital:
				return 'ตั้งค่าการส่งดิจิทัล';
			default:
				return '';
		}
	}

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

	function branchName(id: string | undefined): string {
		const resolved = id || salePickupStoreId;
		return branches.find((b) => b.id === resolved)?.name ?? 'ไม่ระบุสาขา';
	}

	function addressLabel(id: string | undefined): string {
		if (!id) return '';
		const address = addresses.find((a) => String(a.id) === id);
		return address ? addressToDisplay(address) : 'ที่อยู่นี้';
	}

	// --- Badge detail line (รับภายหลัง: branch+date, จัดส่ง/ให้บริการนอกสถานที่: address
	// tag+courier+fee) — mirrors Cart.svelte's own pickupLaterGroupFor/shippingGroupFor so
	// a bucket's group resolves the exact same way its settings drawer does.
	function pickupLaterGroupOf(pickupStoreId: string | undefined): DeliveryGroup | undefined {
		return deliveryGroups.find(
			(g) =>
				g.kind === DeliveryGroupKind.PickupLater &&
				(g.pickupStoreId ?? salePickupStoreId) === (pickupStoreId ?? salePickupStoreId)
		);
	}

	function shippingGroupOf(addressId: string | undefined): DeliveryGroup | undefined {
		return deliveryGroups.find(
			(g) =>
				g.kind === DeliveryGroupKind.Shipping &&
				(addressId ? g.recipientAddressId === addressId : g.addressGroupSeq === 1)
		);
	}

	function onSiteGroupOf(): DeliveryGroup | undefined {
		return deliveryGroups.find((g) => g.kind === DeliveryGroupKind.OnSite);
	}

	// Full street-text address — same addressLabel/addressToDisplay this file already uses
	// elsewhere — truncated for the badge's own limited width, with the untruncated text
	// riding along for an <ssk-tooltip> on hover/tap.
	const ADDRESS_BADGE_MAX_CHARS = 20;

	function truncate(text: string, max: number): string {
		return text.length > max ? `${text.slice(0, max)}...` : text;
	}

	function addressFullText(addressId: string | undefined): string | undefined {
		const address = addresses.find((a) => String(a.id) === (addressId ?? ''));
		return address ? addressToDisplay(address) : undefined;
	}

	// Same courier list Cart.svelte's own methodLabel reads from, minus its
	// marketplace-channel special case — a multi-bucket sale's badges only need the plain
	// courier name, never "ตามแพลตฟอร์ม (Shopee)"'s own sub-channel detail.
	// 'unknown' ("ไม่ระบุ") is a real, selectable row in standardDeliveries/sameDayDeliveries
	// — once the cashier has actually picked it, the badge must say so, same as any real
	// courier (see isGroupFulfilmentComplete's own comment on this). Only a group nobody
	// has touched (method still undefined) shows nothing here.
	function courierLabel(method: string | undefined): string | undefined {
		if (!method) return undefined;
		if (method === 'platform') return 'ตามแพลตฟอร์ม';
		const found = [...standardDeliveries, ...sameDayDeliveries].find((o) => o.value === method);
		return found?.label.replace(/<br\s*\/?>/gi, ' ') ?? method;
	}

	function feeText(fee: number | undefined): string | undefined {
		return fee !== undefined ? formatPriceWithBath(fee) : undefined;
	}

	interface BucketDetail {
		/** Always shown as plain text — "Type" alone for จัดส่ง/ให้บริการนอกสถานที่ (their
		 *  address gets its own tooltip-bearing span instead), the full joined string for
		 *  รับภายหลัง (branch name is never long enough to need truncation/a tooltip). */
		label: string;
		/** จัดส่ง/ให้บริการนอกสถานที่ only — truncated address text + its untruncated
		 *  counterpart for the tooltip. Undefined when there's no resolved address yet. */
		addressText?: string;
		addressFull?: string;
		/** จัดส่ง only — courier + fee, joined, rendered after the address. */
		suffix?: string;
	}

	function pickupLaterDetail(pickupStoreId: string | undefined): BucketDetail {
		const group = pickupLaterGroupOf(pickupStoreId);
		return {
			label: [
				basicCategoryLabel(DeliveryGroupKind.PickupLater),
				branchName(pickupStoreId),
				pickupDateTimeText(group)
			]
				.filter(Boolean)
				.join(' · ')
		};
	}

	function shippingDetail(addressId: string | undefined): BucketDetail {
		const group = shippingGroupOf(addressId);
		const addressFull = addressFullText(addressId ?? group?.recipientAddressId);
		return {
			label: basicCategoryLabel(DeliveryGroupKind.Shipping),
			addressFull,
			addressText: addressFull ? truncate(addressFull, ADDRESS_BADGE_MAX_CHARS) : undefined,
			suffix: [courierLabel(group?.method), feeText(group?.shippingFee)].filter(Boolean).join(' · ')
		};
	}

	function onSiteDetail(): BucketDetail {
		const group = onSiteGroupOf();
		// At the store, there's no customer address to show at all — the branch itself says
		// where, same as a sought-after default already behaves for ไม่ระบุสาขา (branchName's
		// own fallback) when none is picked yet.
		if (group?.onSiteLocation === 'store') {
			const branch = branches.find((b) => b.id === group.onSiteStoreId)?.name ?? 'เลือกสาขา';
			return {
				label: basicCategoryLabel(DeliveryGroupKind.OnSite),
				suffix: [branch, feeText(group?.shippingFee)].filter(Boolean).join(' · ')
			};
		}
		if (group?.onSiteLocation === undefined) {
			return {
				label: basicCategoryLabel(DeliveryGroupKind.OnSite)
			};
		}
		const addressFull = addressFullText(group?.recipientAddressId);
		return {
			label: basicCategoryLabel(DeliveryGroupKind.OnSite),
			addressFull,
			addressText: addressFull ? truncate(addressFull, ADDRESS_BADGE_MAX_CHARS) : undefined,
			suffix: feeText(group?.shippingFee) ?? ''
		};
	}

	function onChangeFulfilment(
		item: TCartItem,
		kind: string,
		pickupStoreId?: string,
		addressId?: string
	): void {
		if (!item.lineId) return;
		const previousKind = item.lineFulfilment;
		const previousStore = item.linePickupStoreId;
		const previousAddressId = item.lineAddressId;
		SetCartItemFulfilment(item.lineId, kind);
		// A line's own รับภายหลัง branch/Shipping address only ever means something once it's
		// actually IN that specific pile — clearing it when a line leaves (or never touching
		// it when it isn't the kind moved into) keeps a stale branch/address from outliving
		// the pile it came from.
		if (kind === DeliveryGroupKind.PickupLater) {
			SetCartItemPickupStore(item.lineId, pickupStoreId);
		} else if (previousKind === DeliveryGroupKind.PickupLater) {
			SetCartItemPickupStore(item.lineId, undefined);
		}
		if (kind === DeliveryGroupKind.Shipping) {
			SetCartItemAddressId(item.lineId, addressId);
		} else if (previousKind === DeliveryGroupKind.Shipping) {
			SetCartItemAddressId(item.lineId, undefined);
		}
		const label =
			kind === DeliveryGroupKind.PickupLater
				? `${basicCategoryLabel(kind as DeliveryGroupKind)} · ${branchName(pickupStoreId)}`
				: kind === DeliveryGroupKind.Shipping && addressId
					? `${basicCategoryLabel(kind as DeliveryGroupKind)} · ${addressLabel(addressId)}`
					: basicCategoryLabel(kind as DeliveryGroupKind);
		toastStore.addToast({
			message: `ย้าย "${item.product_name}" ไป${label} แล้ว`,
			type: 'success',
			timeout: 5000,
			testId: 'sales.cart.line.fulfilment.move.toast',
			action: {
				label: 'เลิกทำ',
				onClick: () => {
					SetCartItemFulfilment(item.lineId!, previousKind);
					if (previousKind === DeliveryGroupKind.PickupLater || kind === DeliveryGroupKind.PickupLater) {
						SetCartItemPickupStore(item.lineId!, previousStore);
					}
					if (previousKind === DeliveryGroupKind.Shipping || kind === DeliveryGroupKind.Shipping) {
						SetCartItemAddressId(item.lineId!, previousAddressId);
					}
				}
			}
		});
	}

	interface Bucket {
		kind: DeliveryGroupKind;
		/** Unique across the whole list — plain kind, or kind+branch/address for รับภายหลัง/
		 *  Shipping. */
		key: string;
		/** รับภายหลัง only — which branch this specific bucket collects for. */
		pickupStoreId?: string;
		/** Shipping only — which address this specific bucket ships to. */
		addressId?: string;
		items: TCartItem[];
		detail: BucketDetail;
		/** Same rule deliverySummary.missing uses (isGroupFulfilmentComplete) — an empty
		 *  bucket is never incomplete, it's just waiting for items. */
		incomplete: boolean;
	}

	// Plain-text version of a bucket's detail — the full address (not the 20-char badge
	// truncation), for places that need one flat string instead of the tooltip markup
	// (aria-label, anywhere else a screen reader or title attribute reads it).
	function bucketPlainLabel(bucket: Bucket): string {
		return [bucket.detail.label, bucket.detail.addressFull, bucket.detail.suffix]
			.filter(Boolean)
			.join(' · ');
	}

	// A bucket with items but no resolved group yet is exactly as incomplete as one whose
	// group exists but fails isGroupFulfilmentComplete — neither has a spare type-unsafe
	// placeholder group to feed that check, so this is its own small wrapper instead.
	function bucketIncomplete(group: DeliveryGroup | undefined, hasItems: boolean): boolean {
		return hasItems && (!group || !isGroupFulfilmentComplete(group));
	}

	function isActiveBucket(bucket: { kind: DeliveryGroupKind; pickupStoreId?: string; addressId?: string }): boolean {
		return (
			!!activePile &&
			activePile.kind === bucket.kind &&
			activePile.pickupStoreId === bucket.pickupStoreId &&
			(activePile.addressId ?? '') === (bucket.addressId ?? '')
		);
	}

	// Buckets in the fixed BASIC_CATEGORY_ORDER — a kind with no items AND no open pile is
	// skipped entirely, never an empty section for a category nobody asked for. รับภายหลัง
	// and Shipping are the kinds that can produce several buckets at once (one per branch/
	// address in play) rather than exactly one — each pile the cashier opens for a NEW
	// branch/address needs its own drop target, not a shared one.
	$: buckets = BASIC_CATEGORY_ORDER.flatMap((kind): Bucket[] => {
		if (kind === DeliveryGroupKind.PickupLater) {
			const keys = new Set<string>([
				...items.filter((i) => displayKindOf(kindOf(i)) === kind).map((i) => i.linePickupStoreId ?? ''),
				...openPiles.filter((p) => p.kind === kind).map((p) => p.pickupStoreId ?? '')
			]);
			// Every bucket gets its own detail line now (branch+date), not just a second
			// รับภายหลัง bucket disambiguating itself from a first — badges only ever show
			// once a second bucket exists ANYWHERE (plainList above), so by the time any of
			// these render, the extra detail is exactly what tells piles apart at a glance.
			return Array.from(keys).map((key) => {
				const bucketItems = items.filter(
					(i) => displayKindOf(kindOf(i)) === kind && (i.linePickupStoreId ?? '') === key
				);
				return {
					kind,
					// Not `pickupLater:${key}` — this flows into CartItem's `instanceId`, which
					// becomes part of a DOM id Modal.svelte looks up via
					// `document.querySelector('#' + id)`. A colon there is parsed as a CSS
					// pseudo-class and throws (invalid selector), silently breaking that pile's
					// remove/zero-qty confirmation modal.
					key: `pickupLater-${key}`,
					pickupStoreId: key || undefined,
					items: bucketItems,
					detail: pickupLaterDetail(key || undefined),
					incomplete: bucketIncomplete(pickupLaterGroupOf(key || undefined), bucketItems.length > 0)
				};
			});
		}
		if (kind === DeliveryGroupKind.Shipping) {
			const keys = new Set<string>([
				...items.filter((i) => displayKindOf(kindOf(i)) === kind).map((i) => i.lineAddressId ?? ''),
				...openPiles.filter((p) => p.kind === kind).map((p) => p.addressId ?? '')
			]);
			return Array.from(keys).map((key) => {
				const bucketItems = items.filter(
					(i) => displayKindOf(kindOf(i)) === kind && (i.lineAddressId ?? '') === key
				);
				return {
					kind,
					key: `shipping-${key}`,
					addressId: key || undefined,
					items: bucketItems,
					detail: shippingDetail(key || undefined),
					incomplete: bucketIncomplete(shippingGroupOf(key || undefined), bucketItems.length > 0)
				};
			});
		}
		const bucketItems = items.filter((i) => displayKindOf(kindOf(i)) === kind);
		const isOpen = openPiles.some((p) => p.kind === kind);
		if (bucketItems.length === 0 && !isOpen) return [];
		const detail: BucketDetail =
			kind === DeliveryGroupKind.OnSite ? onSiteDetail() : { label: basicCategoryLabel(kind) };
		const incomplete =
			kind === DeliveryGroupKind.OnSite ? bucketIncomplete(onSiteGroupOf(), bucketItems.length > 0) : false;
		return [{ kind, key: kind, items: bucketItems, detail, incomplete }];
	});

	// "รูปแบบการรับสินค้า" at the top of the cart already states the sale's one fulfilment
	// kind whenever there's nothing to disambiguate — a lone bucket (any kind, not just
	// PickupInStore) needs no badge of its own repeating that, so it renders as a plain,
	// header-less item list instead (its own settings move to an inline row in Cart.svelte
	// — see needsPickupBranch/needsShippingInfo/needsOnSiteInfo there). The INSTANT a
	// second bucket exists for ANY reason (another kind present, or a second instance of
	// the SAME kind via "เพิ่มตัวเลือกรับสินค้า"), ambiguity exists and EVERY bucket shows
	// as a badge pile — simpler and unambiguous than gating this per-kind: a per-kind
	// version was tried and reverted because its "default" inline row and a same-kind
	// pile's own gear icon could independently resolve to different groups once 2+
	// instances of ONE kind existed; gating on the TOTAL bucket count sidesteps that
	// entirely, since "exactly one bucket" is never ambiguous regardless of kind. An
	// online sale used to be Shipping-only (see resolveLineKind/lineFulfilmentOptions), but
	// now gets the same 3-way choice (รับภายหลัง/จัดส่ง/ให้บริการ, PO brief) POS already had
	// minus รับทันที — so it badges exactly like POS once more than one bucket is in play,
	// gated by the same plain bucket count, not forced plain regardless of it.
	$: plainList = buckets.length <= 1;

	// Cross-pile drag target — dropping a line from a DIFFERENT pile here moves it (same
	// onChangeFulfilment the old per-line dropdown used); dropping within its OWN pile is
	// a no-op here since CartItem's own row-level drop already reorders it. Rejects a
	// destination the line isn't legally allowed to resolve to (digital/service/
	// marketplace lines only ever have one legal kind — see lineFulfilmentOptions).
	let dragOverKey: string | undefined;

	function onDragOverPile(e: DragEvent, key: string) {
		e.preventDefault();
		dragOverKey = key;
	}

	function keyOf(item: TCartItem): string {
		const kind = displayKindOf(kindOf(item));
		if (kind === DeliveryGroupKind.PickupLater) {
			return `pickupLater-${item.linePickupStoreId ?? ''}`;
		}
		if (kind === DeliveryGroupKind.Shipping) {
			return `shipping-${item.lineAddressId ?? ''}`;
		}
		return kind;
	}

	function onDropOnPile(e: DragEvent, bucket: Bucket) {
		e.preventDefault();
		dragOverKey = undefined;
		const lineId = e.dataTransfer?.getData('text/plain');
		const item = lineId ? items.find((i) => i.lineId === lineId) : undefined;
		if (!item) return;
		if (keyOf(item) === bucket.key || !fulfilmentOptionsOf(item).includes(bucket.kind)) return;
		// Already a line of this product sitting in the destination pile — nothing left to
		// tell the two apart once the dragged one lands there too, so fold into it instead
		// of creating a second identical-looking row (same fix as CartItem's own
		// same-pile onDropOnRow, for the cross-pile case).
		const existingInBucket = bucket.items.find((i) => i.product_id === item.product_id);
		if (existingInBucket?.lineId && item.lineId) {
			MergeCartLines(existingInBucket.lineId, item.lineId);
			return;
		}
		onChangeFulfilment(item, bucket.kind, bucket.pickupStoreId, bucket.addressId);
	}
</script>

{#if plainList}
	<CartItem {items} {fulfilmentOptionsOf} {fulfilmentOf} {onChangeFulfilment} />
{:else}
	{#each buckets as bucket (bucket.key)}
		<div
			class="pile-drop-target"
			class:drag-over={dragOverKey === bucket.key}
			class:active={isActiveBucket(bucket)}
			on:dragover={(e) => onDragOverPile(e, bucket.key)}
			on:dragleave={() => (dragOverKey = undefined)}
			on:drop={(e) => onDropOnPile(e, bucket)}
		>
			<div class="pile-badge" class:active={isActiveBucket(bucket)} class:incomplete={bucket.incomplete}>
				<button
					type="button"
					class="pile-badge-main"
					on:click={() => onSetActivePile?.(isActiveBucket(bucket) ? undefined : { kind: bucket.kind, pickupStoreId: bucket.pickupStoreId, addressId: bucket.addressId })}
					data-testid={`sales.cart.pile.${bucket.key}.activate`}
				>
					{#if bucket.incomplete}
						<ssk-icon
							name="solid-exclamation-circle"
							size="xs"
							themeColor="error"
							aria-label="ข้อมูลไม่ครบ"
						></ssk-icon>
					{/if}
					<span class="pile-badge-label">
						{bucket.detail.label}
						{#if bucket.detail.addressText}
							·
							<ssk-tooltip size="xs" themeColor="black" hideCloseButton={true} placement="top">
								<span slot="content" class="tooltip-content">{bucket.detail.addressFull}</span>
								<span class="pile-badge-address">{bucket.detail.addressText}</span>
							</ssk-tooltip>
						{/if}
						{#if bucket.detail.suffix}
							· {bucket.detail.suffix}
						{/if}
					</span>
					{#if isActiveBucket(bucket)}<span class="pile-active-tag">กำลังเพิ่ม</span>{/if}
					{#if bucket.incomplete}<span class="pile-incomplete-tag">ข้อมูลไม่ครบ</span>{/if}
					<span class="pile-badge-count">{bucket.items.length} รายการ</span>
				</button>
				{#if onEditPile && hasSettings(bucket.kind)}
					<button
						type="button"
						class="pile-settings"
						aria-label={settingsLabel(bucket.kind)}
						title={settingsLabel(bucket.kind)}
						on:click|stopPropagation={() => onEditPile?.(bucket.kind, bucket.pickupStoreId, bucket.addressId)}
						data-testid={`sales.cart.pile.${bucket.key}.settings`}
					>
						<ssk-icon name="outline-pencil" size="xs"></ssk-icon>
					</button>
				{/if}
				{#if bucket.items.length === 0 && onRemoveOpenPile}
					<button
						type="button"
						class="pile-remove"
						aria-label={`ปิด${bucketPlainLabel(bucket)}`}
						on:click|stopPropagation={() =>
							onRemoveOpenPile?.({ kind: bucket.kind, pickupStoreId: bucket.pickupStoreId, addressId: bucket.addressId })}
						data-testid={`sales.cart.pile.${bucket.key}.remove`}
					>
						<ssk-icon name="outline-x-mark" size="xs"></ssk-icon>
					</button>
				{/if}
			</div>
			<div class="pile-section">
				{#if bucket.items.length === 0}
					<div class="pile-empty-hint">ลากสินค้ามาวางที่นี่</div>
				{:else}
					<CartItem
						items={bucket.items}
						instanceId={bucket.key}
						{fulfilmentOptionsOf}
						{fulfilmentOf}
						{onChangeFulfilment}
					/>
				{/if}
			</div>
		</div>
	{/each}
{/if}

<style>
	.pile-badge {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		margin-bottom: 0.375rem;
		padding: 0.25rem 0.625rem;
		border-radius: 8px;
		background: var(--ssk-colors-gray-100, #f3f4f6);
		color: var(--ssk-colors-gray-700, #374151);
	}

	.pile-badge:not(:first-child) {
		margin-top: 0.75rem;
	}

	.pile-badge.active {
		background: #fff;
		color: var(--ssk-colors-primary-700, #c2410c);
	}

	.pile-badge-main {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex: 1 1 auto;
		min-width: 0;
		padding: 0;
		background: none;
		border: 0;
		font: inherit;
		font-size: var(--ssk-font-size-xs);
		font-weight: 600;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.pile-badge-label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* The address span itself stays underlined so it reads as "there's more on hover",
	   same convention a truncated value with its own tooltip uses elsewhere. */
	.pile-badge-address {
		text-decoration: underline dotted;
		text-underline-offset: 2px;
	}

	.tooltip-content {
		width: auto;
		max-width: 16rem;
		padding: 2px 4px;
		white-space: normal;
		word-break: break-word;
	}

	.pile-active-tag {
		font-weight: 700;
	}

	/* Mirrors .dest-trigger.empty's error treatment in Cart.svelte — same "still needs
	   something before pay" meaning, just on a pile badge instead of an inline field. */
	.pile-badge.incomplete {
		background: var(--ssk-colors-error-50, #fef2f2);
		color: var(--ssk-colors-error-700, #b91c1c);
	}

	.pile-incomplete-tag {
		font-weight: 700;
		color: var(--ssk-colors-error-600, #dc2626);
	}

	.pile-badge-count {
		margin-left: auto;
		font-weight: 700;
	}

	.pile-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 999px;
		color: inherit;
		cursor: pointer;
	}

	.pile-remove:hover {
		background: rgba(0, 0, 0, 0.08);
	}

	/* A real touch target — this is a touchscreen POS UI, and unlike .pile-remove (a rare
	   cleanup action) this is now a primary, frequently-tapped action per pile. */
	.pile-settings {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 40px;
		min-height: 40px;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 999px;
		color: inherit;
		cursor: pointer;
	}

	.pile-settings:hover {
		background: rgba(0, 0, 0, 0.08);
	}

	.pile-section {
		margin-bottom: 0.25rem;
	}

	.pile-empty-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 3.5rem;
		/* No own margin-bottom: the wrapping .pile-section already adds 0.25rem below
		   every bucket, populated or empty. This used to add its own 1rem on top,
		   which collapses with the parent's margin to leave an empty pile ~12px taller
		   a gap below it than a populated one before the next pile badge. */
		border: 1px dashed var(--ssk-colors-gray-200);
		border-radius: 8px;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-400);
	}

	.pile-drop-target {
		border-radius: 8px;
		padding: 0.25rem;
		/* Negative top/side margins cancel the padding above so it doesn't shift
		   surrounding layout; the bottom margin stays positive so the active/drag-over
		   outline (which extends outside the box via outline-offset) always has clear
		   room before the next pile instead of visually touching its top border. */
		margin: -0.25rem -0.25rem 0.5rem;
		transition:
			background-color 0.1s,
			outline-color 0.1s;
	}

	.pile-drop-target:last-child {
		margin-bottom: -0.25rem;
	}

	/* A pile's own drag highlight — distinct from a single row's .drag-over (reorder
	   within a pile, see CartItem.svelte) so the cashier can tell "moving into this pile"
	   apart from "reordering this one row" at a glance. */
	.pile-drop-target.drag-over {
		background: var(--ssk-colors-primary-50, #fff4ef);
		outline: 2px dashed var(--ssk-colors-primary-300, #ffac7a);
		outline-offset: 2px;
	}

	/* The pile a freshly-tapped product lands in right now — framed as one whole block
	   (badge + its items), not just the header, so it reads as "everything in here" rather
	   than a detail easy to miss on the small badge alone. */
	.pile-drop-target.active:not(.drag-over) {
		background: var(--ssk-colors-primary-50, #fff4ef);
		outline: 1.5px dashed var(--ssk-colors-primary-300, #ffac7a);
		outline-offset: 2px;
	}
</style>
