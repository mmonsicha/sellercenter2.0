<script lang="ts">
	import { getContext, onDestroy, onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { cartListInfo, ConsolidateCartLines, RemoveCartItem, UpdateCartItemQty } from '$stores/cart/cart';
	import type { TCartItem } from '$stores/cart';
	import {
		activeDeliveryGroupId,
		addUserDeliveryGroup,
		canRemoveDeliveryGroup,
		commitDeliveryGroupsToOrder,
		deliveryGroups,
		deliverySummary,
		moveItemToGroup,
		removeUserDeliveryGroup,
		resetDeliveryGroups,
		restoreDeliveryGroup,
		setActiveDeliveryGroup,
		updateDeliveryGroup
	} from '$stores/order/delivery-group';
	import {
		DeliveryGroupKind,
		SplitReason,
		canChangeGroupKind,
		groupKindHint,
		groupKindIcon,
		groupKindLabel,
		isDestinationReady,
		isHandoverGroup,
		isPickupKind,
		kindNeedsShippingMethod,
		kindNeedsTravelFee,
		splitReasonText,
		userSelectableKinds,
		type DeliveryGroup
	} from '$lib/entities/order/delivery-group';
	import { type Address } from '$lib/entities/customer/customer';
	import type { Store } from '$lib/entities/store/store';
	import {
		sameDayDeliveries,
		standardDeliveries,
		ShippingType,
		type DeliveryOption
	} from '$lib/entities/order/order';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { currentCompany } from '$stores/company/current-company';
	import { currentStore } from '$stores/store/current-store';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';
	import { setAction, setUnsavedChanges, unsavedChanges } from '$stores/saved-changes';
	import { addressToDisplay } from '$utils/format-address';
	import { formatPriceWithBath } from '$utils/format-number';
	import { getImageUrl } from '$utils/image-url';
	import { checkPermissionsEach } from '$utils/permission';
	import CustomFancyRadioGroup from '$components/CustomFancyRadioGroup.svelte';
	import CustomInputNumber from '$components/CustomInputNumber.svelte';
	import IconLabel from '$components/IconLabel.svelte';
	import PickList from './PickList.svelte';
	import PickCard from './PickCard.svelte';
	import ModalPickupBranch from './ModalPickupBranch.svelte';

	/**
	 * S3/S4 — the drawer every "จัดการ" click on the S2 row opens. One drawer, one body
	 * that switches view (same shape as DrawerCustomerAddress): the card list is the
	 * home screen, "เปลี่ยน" on a card's address/method drops into a sub-view and comes
	 * back, never a second drawer stacked on this one.
	 */
	export let showDrawer: boolean;
	export let toggleDrawer: () => void;
	// The customer's address book, from Cart — this drawer only ever picks from it.
	export let addresses: Address[] = [];
	// The company's branches, from Cart — a PickupLater group's own branch picker
	// (per-group, distinct from the sale-level pickupStoreId below) lists these.
	export let branches: Store[] = [];
	// The sale-level branch choice (Cart.svelte's own pickupStoreId / ModalPickupBranch) —
	// used only to seed a BRAND NEW PickupLater group with a sensible starting branch so
	// the cashier isn't forced to pick again for the common case; each group's own choice
	// (group.pickupStoreId) always wins once it has one of its own.
	export let defaultPickupStoreId: string = '';
	export let openMethodGroupId: string | undefined = undefined;
	// Handed back to Cart so it can reopen the customer drawer on its address half;
	// this drawer owns parcels, not the address form itself (no AddressPanel here).
	// Takes the parcel that asked, so Cart can stamp whatever address comes out of that
	// trip straight onto this SAME parcel instead of stranding the cashier back here with
	// nothing filled in (see pendingAddressGroupId in Cart.svelte).
	export let onCreateAddress: ((groupId?: string) => void) | undefined = undefined;
	// Same handoff for a digital parcel with no email yet — there is no "add email"
	// view in this drawer either, the email rides in on whichever customer is picked.
	export let onEditCustomer: (() => void) | undefined = undefined;
	// Buyer's name, used only as the fallback recipient when a newly-picked address
	// carries no contact name of its own.
	export let buyerName: string = '';
	// Distinguishes "no customer yet" from "customer chosen but has no email on file" —
	// the digital parcel's recipientEmail is stamped automatically the moment a customer
	// with an email is picked (syncDeliveryGroups' ctx.recipientEmail), so an empty email
	// with a buyer already selected means "add an email to this customer", never "pick a
	// customer" (§2 "เลือกลูกค้าแล้วให้ใช้ email อัตโนมัติไม่ต้องถามซ้ำ").
	export let hasBuyer: boolean = false;

	type View = 'list' | 'address' | 'method';

	const toastStore = getContext<ToastStore>('toast');

	// Local to this drawer, same as DrawerCustomerAddress's own FORM_ADDRESS — scopes
	// the app-wide unsaved-changes confirmation to just this view's draft (Task 4).
	const FORM_METHOD = 'sales-parcel-method';

	const titles: Record<View, string> = {
		list: 'จัดการคำสั่งขายกลุ่ม',
		address: 'เปลี่ยนที่อยู่จัดส่ง',
		method: 'เปลี่ยนวิธีส่ง'
	};

	let view: View = 'list';
	let prevShow = false;
	let activeGroupId = '';
	let showPickupBranchModal = false;
	let pickupBranchGroupId = '';
	// Gates the address view's "เพิ่มที่อยู่จัดส่ง" empty-state button — creating a new
	// address writes customer data, which a cashier may not hold CUSTOMERCREATE for
	// (§6 "no permission", mirrors DrawerCustomerAddress's own canCreateCustomer).
	let canCreateAddress = false;

	// Draft fields for the 'method' view — edited in place, written back only on บันทึก
	// (ยกเลิก must not touch the group), same "draft vs live" split CartFooter's own
	// discount/remark modals use.
	let draftShippingType: ShippingType = ShippingType.Standard;
	let draftMethod = 'unknown';
	let draftFee = '';

	// Reset to a known state every time the drawer opens; ✕ / เสร็จสิ้น never wipe the
	// groups themselves (the store holds them) — only this drawer's own view position.
	$: if (showDrawer && !prevShow) {
		prevShow = true;
		const methodGroup = openMethodGroupId
			? $deliveryGroups.find((group) => group.id === openMethodGroupId)
			: undefined;
		if (methodGroup) {
			openMethodView(methodGroup);
			openMethodGroupId = undefined;
		} else {
			view = 'list';
		}
		checkCreateAddressPermission();
	}
	$: if (!showDrawer && prevShow) {
		prevShow = false;
		view = 'list';
		activeGroupId = '';
	}

	// cartListInfo.data is populated synchronously from localStorage today and is never
	// actually empty-of-data by the time this drawer can open (Cart's onMount loads it
	// before any render) — this guard doesn't fire in practice, but is kept because the
	// wireframe requires a loading state and a future async cart source would hit it.
	$: cartLoading = !$cartListInfo.data;
	$: isCartEmpty = !cartLoading && $cartListInfo.data.length === 0;

	$: activeGroup = $deliveryGroups.find((g) => g.id === activeGroupId);
	$: activeSelectedAddress = addresses.find(
		(a) => String(a.id) === activeGroup?.recipientAddressId
	);
	$: pickupBranchGroup = $deliveryGroups.find((group) => group.id === pickupBranchGroupId);

	// The method view's draft vs. the group's own stored values — mirrored into the
	// app-wide unsaved-changes store so ✕ / on:close can gate through the same
	// confirmation DrawerCustomerAddress already gives the cashier, instead of
	// throwing an in-progress courier/fee edit away silently (§6 "ลูกค้าเปลี่ยนใจกลางคัน").
	// Never true outside the method view — closing from the list is left instant.
	$: methodDraftDirty =
		view === 'method' &&
		!!activeGroup &&
		(draftShippingType !== (activeGroup.shippingType ?? ShippingType.Standard) ||
			draftMethod !== (activeGroup.method ?? 'unknown') ||
			draftFee !== (activeGroup.shippingFee !== undefined ? String(activeGroup.shippingFee) : ''));
	$: setUnsavedChanges(methodDraftDirty, FORM_METHOD);

	// Parcel numbers shown everywhere in this feature (the S2 row's "พัสดุ N ยังไม่ระบุ
	// ที่อยู่", deliverySummary.firstMissingSeq, this drawer's own cards) all come from a
	// group's position in the raw store array — not from the reordered display list
	// below. Numbering cards by display position instead would let "พัสดุ 2" in the cart
	// row point at a different card than the one labelled "พัสดุ 2" in here.
	$: rawIndexOf = new Map($deliveryGroups.map((g, i) => [g.id, i] as const));

	// A new parcel is collected the same way the rest of this sale is — a walk-in sale
	// must not sprout a parcel that suddenly demands a shipping address. The default
	// group is the sale's own "no reason to be split" bucket, so its kind IS the sale's.
	$: physicalKind =
		($deliveryGroups.find((g) => !g.locked && g.splitReason === undefined) ??
			$deliveryGroups.find((g) => g.kind !== DeliveryGroupKind.Digital))?.kind ??
		DeliveryGroupKind.Shipping;

	// Cards render in the SAME order they're numbered in (raw store order) — re-sorting
	// them by "what needs attention" used to desync the visible card order from its own
	// "คำสั่งขายกลุ่ม N" title (card shown first could read "กลุ่ม 3"). The cart's own
	// summary cards (DeliveryGroupCards.svelte) already just render groups as-is for the
	// same reason; this drawer now matches.
	$: orderedGroups = $deliveryGroups;

	// Only the parcels whose fee is actually known get a line — an unresolved fee must
	// never show as ฿0 (§6). The handover pile is dropped before that test rather than
	// caught by it: its ฿0 is not a shipping fee that happened to come out at zero, it is
	// the absence of shipping, and "พัสดุ N ฿0" would price a pile that never travels.
	$: feeBreakdownParts = $deliveryGroups
		.map((g, i) => ({ seq: i + 1, group: g, fee: g.shippingFee }))
		.filter(
			(p): p is { seq: number; group: DeliveryGroup; fee: number } =>
				p.fee !== undefined && !isHandoverGroup(p.group)
		)
		.map((p) => `กลุ่ม ${p.seq} ${formatPriceWithBath(p.fee)}`);

	// A pickup or digital parcel has no courier and no fee to speak of — the fee
	// breakdown and "รวมค่าจัดส่ง" footer only earn their place once at least one parcel
	// in this sale could actually need one, otherwise a walk-in mixed sale would show
	// "รวมค่าจัดส่ง ฿0" for a total nobody is paying.
	$: hasShippingKindGroup = $deliveryGroups.some((g) => kindNeedsShippingMethod(g.kind));

	function itemsOf(group: DeliveryGroup): TCartItem[] {
		const byId = new Map($cartListInfo.data.filter((i) => !!i.lineId).map((i) => [i.lineId!, i] as const));
		return group.itemIds
			.map((id) => byId.get(id))
			.filter((i): i is TCartItem => i !== undefined);
	}

	// Mirrors DrawerCustomerAddress's own checkPermission — scoped to the current
	// company/store the same way, so a pending check from a company we've since
	// switched away from can never resolve into a stale "granted" here.
	async function checkCreateAddressPermission() {
		if (!$currentStore?.id) {
			canCreateAddress = false;
			return;
		}
		await waitForDialogPermissionReady($currentCompany?.id);

		// checkPermissionsEach never throws — it answers all-false on failure — so a
		// try/catch here would be dead code.
		const data = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
			EntityPermission.CUSTOMERCREATE
		]);
		canCreateAddress = data[EntityPermission.CUSTOMERCREATE];
	}

	// §4 S4 "success" — one level of undo, offered via the toast itself rather than a
	// history stack: each move gets its own closure over the exact source group it came
	// from, so a later move can never accidentally rewind an earlier one.
	function showMoveUndo(item: TCartItem, sourceGroupId: string, targetSeq: number) {
		const undo = () => {
			// A soft-split source that emptied out during the move auto-collapses (the
			// store's moveItemToGroup filters empty non-locked groups away) — its id is
			// gone by the time เลิกทำ is clicked, so recreate a parcel and drop the item
			// back into that instead of silently failing to restore anything.
			const stillExists = $deliveryGroups.some((g) => g.id === sourceGroupId);
			const restoreGroupId = stillExists ? sourceGroupId : addUserDeliveryGroup();
			moveItemToGroup(item.lineId!, restoreGroupId);
		};

		toastStore.addToast({
			message: `ย้าย "${item.product_name}" ไปกลุ่ม ${targetSeq} แล้ว`,
			type: 'success',
			timeout: 5000,
			testId: 'sales.delivery.move.toast',
			action: { label: 'เลิกทำ', onClick: undo }
		});
	}

	// §1 "เพิ่มพัสดุได้ แต่ลบไม่ได้" — only a cashier-made soft split ever reaches this
	// function: canRemoveDeliveryGroup already gates whether the ลบ button is even
	// rendered, so a locked (hard-split) card or the default parcel can never call this.
	// `seq` comes from the button's own render, i.e. from BEFORE the removal — the number
	// the cashier was looking at when they clicked it, which is the only number that can
	// honestly describe a parcel that no longer exists.
	function onRemoveGroup(group: DeliveryGroup, seq: number) {
		const removed = removeUserDeliveryGroup(group.id);
		if (!removed) return;

		// Down to one group (or none) — there is no more "split" left to manage, so this
		// exits group-order mode entirely rather than leaving a single, pointless parcel
		// card behind. Two things the plain merge-into-receiver path below does NOT do:
		// (1) any product that existed as separate lines across the groups being folded
		// together must fold back into one ordinary cart line (ConsolidateCartLines) —
		// otherwise it would sit there as visually duplicate rows with nothing left to
		// tell them apart, now that there's no group to explain the split — and (2) the
		// drawer itself must close, since the list it was managing no longer exists.
		// No "เลิกทำ" is offered here: cart lines just got merged (their old lineIds are
		// gone), so there is nothing left for an undo to coherently restore.
		if ($deliveryGroups.length <= 1) {
			ConsolidateCartLines();
			resetDeliveryGroups();
			toggleDrawer();
			toastStore.addToast({
				message: `ลบกลุ่ม ${seq} แล้ว — กลับเป็นคำสั่งขายปกติ`,
				type: 'success',
				timeout: 5000,
				testId: 'sales.delivery.remove.toast'
			});
			return;
		}

		// The receiver's number must be read AFTER the removal, from $deliveryGroups (a
		// plain store-subscribed variable, already updated synchronously — unlike the
		// `$:` rawIndexOf map, which is still a tick behind here). Deleting a parcel
		// renumbers every card below it, and the receiver is usually the default parcel,
		// which syncDeliveryGroups pushes LAST — so the pre-removal number would point at
		// a card that no longer wears it by the time the toast is on screen.
		const targetIndex = removed.targetGroupId
			? $deliveryGroups.findIndex((g) => g.id === removed.targetGroupId)
			: -1;

		toastStore.addToast({
			// The deleted parcel's own number is deliberately left out of the merge
			// message: it has just been freed up and taken over by the card below it, so
			// naming both numbers in one sentence could read as "ลบพัสดุ 2 — ย้ายไปพัสดุ 2".
			message:
				targetIndex >= 0
					? `ลบกลุ่มแล้ว — ย้ายสินค้าไปกลุ่ม ${targetIndex + 1}`
					: `ลบกลุ่ม ${seq} แล้ว`,
			type: 'success',
			timeout: 5000,
			testId: 'sales.delivery.remove.toast',
			action: { label: 'เลิกทำ', onClick: () => restoreDeliveryGroup(removed) }
		});
	}

	function moveItemToExistingGroup(item: TCartItem, targetGroupId: string, targetSeq: number) {
		const sourceGroupId = $deliveryGroups.find((g) => !!item.lineId && g.itemIds.includes(item.lineId))?.id;
		moveItemToGroup(item.lineId!, targetGroupId);
		if (sourceGroupId) showMoveUndo(item, sourceGroupId, targetSeq);
	}


	// §6 "กลุ่มเกิน 5" — the mini-nav chip target. Scrolling by DOM id (not a bound
	// element array) because the chips iterate raw store order while the cards render
	// in `orderedGroups` order — an id keyed on the group survives that reshuffle.
	function parcelCardId(groupId: string): string {
		return `sales-delivery-parcel-${groupId}`;
	}

	function scrollToParcel(groupId: string) {
		const el = document.getElementById(parcelCardId(groupId));
		if (!el) return;
		const reduceMotion =
			typeof window !== 'undefined' &&
			!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
	}

	// §4 "ปุ่มแยกพัสดุเพิ่ม กดใช้งานจริงไม่ได้" — a manually-added parcel takes the sale's
	// own physical kind (never a bare Shipping default), so a รับที่ร้าน/รับทีหลัง sale
	// doesn't suddenly grow a parcel demanding a shipping address; and it scrolls itself
	// into view once it exists in the DOM, so clicking the button always has a visible
	// result even when the new card lands below the fold.
	async function onAddGroup() {
		const id = addUserDeliveryGroup(physicalKind);
		// A freshly-made PickupLater group starts from the sale's own branch choice
		// (ModalPickupBranch's pickupStoreId) rather than forcing the cashier to pick
		// again for the common case — they can still change it per-group right below.
		if (physicalKind === DeliveryGroupKind.PickupLater && defaultPickupStoreId) {
			updateDeliveryGroup(id, { pickupStoreId: defaultPickupStoreId });
		}
		// "Create the parcels first, then shop into the one you want" — the parcel the
		// cashier just made is where the next product they tap goes.
		setActiveDeliveryGroup(id);
		await tick();
		scrollToParcel(id);
	}

	function openAddressView(group: DeliveryGroup) {
		activeGroupId = group.id;
		view = 'address';
	}

	function openPickupBranchModal(group: DeliveryGroup) {
		pickupBranchGroupId = group.id;
		showPickupBranchModal = true;
	}

	function onSelectPickupBranch(branch: Store) {
		if (!pickupBranchGroupId) return;
		updateDeliveryGroup(pickupBranchGroupId, { pickupStoreId: branch.id });
	}

	function pickAddressForActiveGroup(a: Address) {
		if (!activeGroupId) return;
		updateDeliveryGroup(activeGroupId, {
			recipientAddressId: a.id != null ? String(a.id) : undefined,
			recipientAddress: addressToDisplay(a),
			recipientName: a.contactName ?? buyerName
		});
		view = 'list';
	}

	function openMethodView(group: DeliveryGroup) {
		activeGroupId = group.id;
		draftShippingType = group.shippingType ?? ShippingType.Standard;
		draftMethod = group.method ?? 'unknown';
		draftFee = group.shippingFee !== undefined ? String(group.shippingFee) : '';
		view = 'method';
	}

	// Switching a soft-split group's kind must clear whatever fields no longer apply —
	// same clearing rule syncDeliveryGroups' own kind-flips already use (step 4's "A
	// pickup parcel is collected in person" clearing, and the origin step's own). The
	// cart's own group cards show the kind as a plain, read-only badge (§ "หน้าแรกแสดงแค่
	// badge") — this drawer is the one and only place a cashier can actually change it.
	function onChangeKind(group: DeliveryGroup, kind: DeliveryGroupKind) {
		if (kind === group.kind) return;
		const clearShipping = kind !== DeliveryGroupKind.Shipping;
		const clearAddress = kind !== DeliveryGroupKind.Shipping && kind !== DeliveryGroupKind.OnSite;
		updateDeliveryGroup(group.id, {
			kind,
			...(clearShipping ? { method: undefined, shippingType: undefined, courier: undefined } : {}),
			...(clearAddress ? { recipientAddress: undefined, recipientAddressId: undefined } : {}),
			...(kind !== DeliveryGroupKind.OnSite && group.kind === DeliveryGroupKind.OnSite
				? { shippingFee: undefined }
				: {}),
			// Same seeding onAddGroup gives a brand-new PickupLater group — flipping an
			// existing group's kind into PickupLater for the first time should not leave
			// its branch picker sitting on "ยังไม่เลือกสาขา" when the sale already has one.
			...(kind === DeliveryGroupKind.PickupLater && !group.pickupStoreId && defaultPickupStoreId
				? { pickupStoreId: defaultPickupStoreId }
				: {})
		});
	}

	function onSelectShippingType(type: ShippingType) {
		draftShippingType = type;
		// Switching tabs invalidates the choice from the other list — the same rule
		// ChannelDetail.svelte applies to its own Standard/Same-day toggle.
		draftMethod = 'unknown';
	}

	function onDraftFeeInput(e: Event) {
		draftFee = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
		(e.target as HTMLInputElement).value = draftFee;
	}

	// OnSite's own fee field — written straight to the group, no draft/save step like the
	// method sub-view's courier+fee has: there's no second field (courier/type) riding
	// alongside it that a cancel could need to roll back together with this one.
	function onTravelFeeInput(e: Event, group: DeliveryGroup) {
		const digits = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
		(e.target as HTMLInputElement).value = digits;
		updateDeliveryGroup(group.id, { shippingFee: digits === '' ? undefined : Number(digits) });
	}

	// Template expressions aren't full TypeScript — an inline `(e: Event) => ...` arrow in
	// markup is a parse error, unlike here in <script>. Curried so the markup stays a plain
	// expression (`on:input={travelFeeInputHandler(group)}`), no inline annotation needed.
	function travelFeeInputHandler(group: DeliveryGroup) {
		return (e: Event) => onTravelFeeInput(e, group);
	}

	function saveMethod() {
		if (!activeGroupId) return;
		updateDeliveryGroup(activeGroupId, {
			// Every Delivery in this app carries this same fixed courier label today
			// (see DrawerChannel.svelte) — POS has no concept of who physically drives
			// a parcel, only which provider/tier was picked, and that lives in
			// `method` + `shippingType` so the folded-back Delivery
			// (commitDeliveryGroupsToOrder) looks exactly like a non-split order's.
			courier: 'Seller Owned Fleet',
			method: draftMethod,
			shippingType: draftShippingType,
			shippingFee: draftFee === '' ? undefined : Number(draftFee) || 0
		});
		view = 'list';
	}

	function methodLabel(group: DeliveryGroup): string {
		const found = [...standardDeliveries, ...sameDayDeliveries].find(
			(o) => o.value === group.method
		);
		return found?.label.replace(/<br\s*\/?>/gi, ' ') ?? group.method ?? '';
	}

	function shippingTypeLabel(type?: ShippingType): string {
		return type === ShippingType.SameDay ? 'Same Day' : 'Standard';
	}

	// Mirrors ChannelDetail.svelte's own renderOptions — CustomFancyRadioGroup renders
	// each option through IconLabel so the courier logo sits beside its label.
	const renderOptions = (items: DeliveryOption[]) =>
		items.map(({ value, label, icon }) => ({
			value,
			label: IconLabel,
			labelProps: { label, icon }
		}));

	function onFinish() {
		if ($deliverySummary.missing.length > 0) return;
		commitDeliveryGroupsToOrder();
		toastStore.addToast({
			message: 'บันทึกการจัดส่งแล้ว',
			type: 'success',
			timeout: 3000,
			testId: 'sales.delivery.toast.success'
		});
		toggleDrawer();
	}

	// ✕ / backdrop / Escape all raise ssk-drawer's `close` event, and the header's own
	// [x] calls this same function directly — same dual wiring DrawerCustomerAddress
	// uses for its handleClose. Closing from the list (or address) view is left instant
	// (§6 "ลูกค้าเปลี่ยนใจกลางคัน" only calls out the method view's draft); only a dirty
	// method draft routes through the app-wide unsaved-changes confirmation.
	function handleClose() {
		const close = () => {
			setUnsavedChanges(false, FORM_METHOD);
			toggleDrawer();
		};

		if (view === 'method' && $unsavedChanges[FORM_METHOD]) {
			setAction(close, FORM_METHOD);
		} else {
			close();
		}
	}

	// No backdrop (Fact 1 / requirement 7) means there is no click-outside to close this
	// panel with — Escape is the one keyboard path left, same affordance ssk-drawer's own
	// backdrop/Escape wiring used to provide for free.
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showDrawer) handleClose();
	}

	onMount(() => window.addEventListener('keydown', handleKeydown));
	onDestroy(() => {
		if (typeof window !== 'undefined') window.removeEventListener('keydown', handleKeydown);
	});

	// Mirrors DeliveryGroupCards.svelte's own canActivate — only a cashier-made soft split
	// is ever a place to "shop into" (a hard split is the engine's decision, not a choice),
	// same restriction setActiveDeliveryGroup already enforces at the store layer.
	function canActivateCard(g: DeliveryGroup): boolean {
		return !g.locked && g.splitReason === SplitReason.User;
	}

	function onCardActivate(group: DeliveryGroup) {
		if (!canActivateCard(group)) return;
		setActiveDeliveryGroup($activeDeliveryGroupId === group.id ? undefined : group.id);
	}

	// Activating a card is meant for the header area only — the kind dropdown, ✕, product
	// rows and destination/method buttons each stopPropagation on their own click handlers
	// (see the markup) so this only ever fires from a plain click on the card body itself.
	function onCardKeydown(e: KeyboardEvent, group: DeliveryGroup) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onCardActivate(group);
		}
	}

	// Pointer Events, not HTML5 native drag-and-drop — native DnD never fires on a
	// touchscreen at all, and this is a POS till (FULFILLMENT_LOGIC.md §3.5). A pointerdown
	// on the handle starts tracking; pointermove walks document.elementFromPoint under the
	// finger/cursor to find whichever .parcel-card it's currently over (native DnD's
	// dragover/drop targets this for free — Pointer Events does not, so this is the one
	// piece that replaces them); pointerup resolves the move, same moveItemToExistingGroup
	// the ย้าย dropdown already uses, so toast/undo behaviour is identical either way.
	let dragItem: TCartItem | null = null;
	let dragSourceGroupId = '';
	let dragOverGroupId = '';
	// Floating ghost card position, in viewport px — lets the cashier SEE which product
	// is being carried and where it is right now, instead of guessing from the highlight
	// alone (requirement: "ต้องแสดงให้เห็นการ์ดลอยๆ... จะได้รู้ว่าย้ายสินค้าชิ้นไหน ไปกลุ่มไหน").
	let dragGhostX = 0;
	let dragGhostY = 0;

	function onItemPointerDown(e: PointerEvent, item: TCartItem, group: DeliveryGroup) {
		if (group.locked) return;
		// Only the primary button/touch contact starts a drag — a right-click or a second
		// simultaneous touch must not hijack the gesture mid-scroll.
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		// Without this, dragging the pointer across the item rows below also starts the
		// browser's own native text selection (the product name/price getting "painted"
		// black as the cursor passes over it) — same gesture the browser reads as
		// click-and-drag-to-select. preventDefault stops that at the source; the
		// `.panel.dragging` class below is a belt-and-braces net for anything already
		// mid-selection before this pointerdown fired.
		e.preventDefault();
		dragItem = item;
		dragSourceGroupId = group.id;
		dragGhostX = e.clientX;
		dragGhostY = e.clientY;
		window.addEventListener('pointermove', onDragPointerMove);
		window.addEventListener('pointerup', onDragPointerUp, { once: true });
		window.addEventListener('pointercancel', onDragPointerUp, { once: true });
	}

	function onDragPointerMove(e: PointerEvent) {
		if (!dragItem) return;
		dragGhostX = e.clientX;
		dragGhostY = e.clientY;
		// elementFromPoint, not e.target — Pointer Events keeps dispatching to the element
		// the gesture STARTED on, never to whatever is visually under the pointer now.
		const el = document.elementFromPoint(e.clientX, e.clientY);
		const card = el?.closest<HTMLElement>('.parcel-card[data-group-id]');
		const groupId = card?.dataset.groupId ?? '';
		const group = groupId ? $deliveryGroups.find((g) => g.id === groupId) : undefined;
		// A locked target (Digital, the service-forced OnSite group, the handover pile)
		// never highlights — same exclusion the move-into-locked-group rule already enforced
		// on the removed ย้าย dropdown's own disabled targets.
		dragOverGroupId = group && !group.locked ? groupId : '';
	}

	function onDragPointerUp() {
		window.removeEventListener('pointermove', onDragPointerMove);
		const item = dragItem;
		const sourceGroupId = dragSourceGroupId;
		const targetGroupId = dragOverGroupId;
		dragItem = null;
		dragSourceGroupId = '';
		dragOverGroupId = '';
		if (!item || !targetGroupId || targetGroupId === sourceGroupId) return;
		const targetSeq = (rawIndexOf.get(targetGroupId) ?? 0) + 1;
		moveItemToExistingGroup(item, targetGroupId, targetSeq);
	}

	function onItemQtyChange(item: TCartItem) {
		if (item.qty === 0) {
			RemoveCartItem(item.lineId!);
			return;
		}
		UpdateCartItemQty(item.lineId!, item.qty);
	}
</script>

{#if showDrawer}
	<div class="panel-root" transition:fly={{ x: 400, duration: 200 }}>
		<div
			class="panel"
			class:dragging={!!dragItem}
			role="dialog"
			aria-modal="false"
			aria-label={titles[view]}
		>
			<div class="panel-header">
				<span class="panel-title">{titles[view]}</span>
				<button type="button" class="panel-close" on:click={handleClose} aria-label="ปิด">
					<ssk-icon name="outline-x-mark" size="sm"></ssk-icon>
				</button>
			</div>

		{#if view === 'list'}
			<div class="panel-body body">
				{#if cartLoading}
					<div class="centered"><ssk-spinner size="md" color="primary"></ssk-spinner></div>
				{:else if isCartEmpty}
					<div class="centered"><ssk-text color="gray.500">ยังไม่มีสินค้า</ssk-text></div>
				{:else}
					{#each orderedGroups as group (group.id)}
						{@const seq = (rawIndexOf.get(group.id) ?? 0) + 1}
						{@const active = group.id === $activeDeliveryGroupId}
						{@const canActivate = canActivateCard(group)}
						{@const selectedAddress = addresses.find(
							(address) => String(address.id) === group.recipientAddressId
						)}
						{@const selectedPickupBranch = branches.find(
							(branch) => branch.id === group.pickupStoreId
						)}
						<!-- Plain div, not a button: unlike DeliveryGroupCards.svelte's own card-main
						     (a <button> with no interactive descendants), this card wraps the kind
						     dropdown, ✕, product rows (draggable + qty stepper) and destination/method
						     buttons — a <button> containing those is invalid HTML and breaks their own
						     click targets. Every one of those descendants stopPropagation's its own
						     click so none of them also toggles the card's active state. -->
						<div
							id={parcelCardId(group.id)}
							data-group-id={group.id}
							class="parcel-card"
							class:locked={group.locked}
							class:handover={isHandoverGroup(group)}
							class:active
							class:activatable={canActivate}
							class:drag-over={dragOverGroupId === group.id}
							role={canActivate ? 'button' : undefined}
							tabindex={canActivate ? 0 : undefined}
							on:click={() => onCardActivate(group)}
							on:keydown={(e) => onCardKeydown(e, group)}
						>
							<div class="parcel-head">
								<span class="parcel-title">คำสั่งขายกลุ่ม {seq}</span>
								<span class="parcel-count">{group.itemIds.length} รายการ</span>
								<span class="parcel-head-trailing">
									{#if active}
										<span class="parcel-active-label">กำลังเพิ่มสินค้า</span>
									{/if}
									{#if group.originName}
										<span class="parcel-origin">จาก{group.originName}</span>
									{/if}
									{#if group.locked}
										<ssk-tooltip
											size="xs"
											themeColor="black"
											hideCloseButton={true}
											placement="top"
										>
											<span slot="content" class="tooltip-content">
												<ssk-text size="xs" color="white">
													{isHandoverGroup(group)
														? 'สลับได้ที่รายการสินค้า'
														: splitReasonText(group.splitReason)}
												</ssk-text>
											</span>
											<span class="parcel-locked">
												<ssk-icon name="outline-lock-closed" size="xs"></ssk-icon>
											</span>
										</ssk-tooltip>
									{:else if canRemoveDeliveryGroup($deliveryGroups, group.id)}
										<!-- §1 "เพิ่มพัสดุได้ แต่ลบไม่ได้" — only a cashier-made soft split is
										     ever deletable. A bare icon, not a labelled button — the card already
										     reads top-to-bottom as "this group", so "ลบ" would just repeat what
										     the icon alone already says. -->
										<button
											type="button"
											class="parcel-remove"
											on:click|stopPropagation={() => onRemoveGroup(group, seq)}
											aria-label={`ลบคำสั่งขายกลุ่ม ${seq}`}
											data-testid={`sales.delivery.parcel.${seq}.remove`}
										>
											<ssk-icon name="outline-x-mark" size="sm" themeColor="error"></ssk-icon>
										</button>
									{/if}
								</span>
							</div>

							<!-- A prominent, full-width row — the kind must be obvious at a glance, not
							     a small inline detail. Only a cashier-made soft split is a kind choice;
							     the real hard splits (Digital, the service-forced OnSite group, the
							     handover pile) render through the SAME <ssk-dropdown>, just `disabled` —
							     two different elements (a real dropdown vs. a hand-styled lookalike span)
							     never reliably agree on height/padding with each other, which is exactly
							     why "รับทันที"/"รับภายหลัง" and "จัดส่งเข้าระบบ" used to render at visibly
							     different sizes. One component, one size, always. -->
							<span
								class="parcel-kind-row"
								role="presentation"
								on:click|stopPropagation
								on:keydown|stopPropagation
							>
								<ssk-dropdown
									class="parcel-kind-dropdown selector"
									size="sm"
									width="100%"
									optionswidth="100%"
									value={group.kind}
									disabled={!canChangeGroupKind(group)}
									aria-label={`เปลี่ยนรูปแบบของคำสั่งขายกลุ่ม ${seq}`}
									data-testid={`sales.delivery.parcel.${seq}.kind`}
								>
									<ssk-dropdown-button slot="selected" value={group.kind}>
										<!-- Same .selector-body/.selector-text/.selector-title structure as Cart.svelte's
										     own channel/fulfilment selectors (the "ช่องทางการขาย" look) — copied, not
										     shared, since Svelte scopes styles per component; kept byte-identical so
										     the two dropdowns read as one visual family. -->
										<span class="selector-body">
											<ssk-icon
												name={groupKindIcon(group.kind)}
												size="md"
												themeColor={canChangeGroupKind(group) ? 'primary' : 'gray'}
											></ssk-icon>
											<span class="selector-text">
												<span class="selector-title">{groupKindLabel(group.kind)}</span>
											</span>
										</span>
									</ssk-dropdown-button>
									{#each userSelectableKinds as kindOption}
										<ssk-dropdown-option
											value={kindOption}
											aria-selected={kindOption === group.kind}
											on:click={() => onChangeKind(group, kindOption)}
											data-testid={`sales.delivery.parcel.${seq}.kind.${kindOption}`}
										>
											<span class="option-body">
												<ssk-icon name={groupKindIcon(kindOption)} size="sm" themeColor="stroke"
												></ssk-icon>
												<span class="selector-text">
													<span class="selector-title">{groupKindLabel(kindOption)}</span>
													<span class="selector-hint">{groupKindHint(kindOption)}</span>
												</span>
											</span>
										</ssk-dropdown-option>
									{/each}
								</ssk-dropdown>
							</span>

								{#if isPickupKind(group.kind)}
									<!-- Pickup details are identified by the type selector. -->
									{#if group.kind === DeliveryGroupKind.PickupLater && !isHandoverGroup(group)}
										<div class="parcel-dest">
										<button
											type="button"
											class="dest-trigger"
											disabled={group.locked}
											aria-label={`เลือกสาขาที่รับสำหรับคำสั่งขายกลุ่ม ${seq}`}
											title={selectedPickupBranch?.name ?? 'เลือกสาขาที่รับสินค้า'}
											on:click|stopPropagation={() => openPickupBranchModal(group)}
											data-testid={`sales.delivery.parcel.${seq}.pickupBranch`}
										>
											<ssk-icon
												name="outline-building-storefront"
												size="sm"
												themeColor={group.locked ? 'gray' : 'primary'}
											></ssk-icon>
											<span class="dest-trigger-value">
												{selectedPickupBranch?.name ?? 'เลือกสาขาที่รับสินค้า'}
											</span>
											<ssk-icon name="solid-chevron-down" size="xs" themeColor="stroke"></ssk-icon>
										</button>
										</div>
									{/if}
								{:else if group.kind === DeliveryGroupKind.Digital}
									<div class="parcel-dest">
									{#if group.recipientEmail}
										<!-- §2 "ใช้ email อัตโนมัติไม่ต้องถามซ้ำ" — the email is a settled fact
										     taken straight from the buyer (syncDeliveryGroups' ctx.recipientEmail);
										     there is nothing left to ask, so no action button belongs beside it. -->
										<div class="dest-info">
											<span class="dest-name">{group.recipientEmail}</span>
											<span class="dest-sub">ส่งทางอีเมลทันทีหลังชำระเงิน</span>
										</div>
									{:else}
										<!-- §2 restyle — same bordered, full-width dropdown-row shape as the other
										     3 triggers below (.dest-trigger), only the behaviour stays onEditCustomer
										     (no sub-view to navigate to), and the empty/warning coloring carries over
										     from the old .dest-missing box so an unfilled destination still stands
										     out at a glance. -->
										<button
											type="button"
											class="dest-trigger empty"
											on:click|stopPropagation={() => onEditCustomer?.()}
											data-testid={`sales.delivery.parcel.${seq}.digital.editCustomer`}
										>
											<ssk-icon name="outline-exclamation-triangle" size="sm" themeColor="error"
											></ssk-icon>
											<span class="dest-trigger-value">
												<!-- A customer already picked but with no email on file needs "add an
												     email to this customer"; no customer picked at all needs "pick
												     someone" — two different dead ends, so two different prompts. -->
												{hasBuyer ? 'เพิ่มอีเมลให้ลูกค้า' : 'เลือกลูกค้าเพื่อส่งอีเมล'}
											</span>
											<ssk-icon name="solid-chevron-right" size="xs" themeColor="error"></ssk-icon>
										</button>
									{/if}
									</div>
								{:else if hasBuyer && isDestinationReady(group)}
									<div class="parcel-dest">
									<!-- §2 restyle — was a small underlined "เปลี่ยน" text link; now the same
									     full-width bordered trigger-row shape as .parcel-kind-dropdown (icon +
									     value + chevron). Behaviour is unchanged: still openAddressView. -->
									<button
										type="button"
										class="dest-trigger"
										title={group.recipientAddress}
										on:click|stopPropagation={() => openAddressView(group)}
										data-testid={`sales.delivery.parcel.${seq}.address`}
									>
										<span class="address-choice-badge" class:default={selectedAddress?.isDefault}>
											{selectedAddress?.isDefault ? 'ที่อยู่หลัก' : 'ที่อยู่รอง'}
										</span>
										<span class="dest-trigger-value">{group.recipientAddress}</span>
										<ssk-icon name="solid-chevron-down" size="xs" themeColor="stroke"></ssk-icon>
									</button>
									</div>
								{:else if hasBuyer}
									<div class="parcel-dest">
									<!-- §3 "ตัดการส่งลิ้งให้กรอกที่อยู่เอง" — the send-a-link option never had a
									     backend behind it (see isDestinationReady's own history) and is gone;
									     openAddressView is now the one and only way to give this parcel a
									     destination. Same testid as the filled card's own trigger above — both
									     mean "set this parcel's address," just from opposite starting states. -->
									<button
										type="button"
										class="dest-trigger empty"
										on:click|stopPropagation={() => openAddressView(group)}
										data-testid={`sales.delivery.parcel.${seq}.address`}
									>
										<ssk-icon name="outline-exclamation-triangle" size="sm" themeColor="error"
										></ssk-icon>
										<span class="dest-trigger-value">เลือกที่อยู่จัดส่ง</span>
										<ssk-icon name="solid-chevron-right" size="xs" themeColor="error"></ssk-icon>
									</button>
									</div>
								{:else}
									<div class="parcel-dest">
									<!-- No customer picked at all yet — there is no address book to open
									     (openAddressView would just show an empty list). Same dead-end the
									     Digital branch above already names explicitly: send the cashier to
									     pick a customer FIRST (onCreateAddress stashes this group so Cart can
									     stamp whatever address comes out of that trip straight back onto it —
									     see pendingAddressGroupId in Cart.svelte), never straight into a
									     picker with nothing in it. -->
									<button
										type="button"
										class="dest-trigger empty"
										on:click|stopPropagation={() => onCreateAddress?.(group.id)}
										data-testid={`sales.delivery.parcel.${seq}.address.needsCustomer`}
									>
										<ssk-icon name="outline-exclamation-triangle" size="sm" themeColor="error"
										></ssk-icon>
										<span class="dest-trigger-value">เลือกลูกค้าก่อนเพื่อระบุที่อยู่จัดส่ง</span>
										<ssk-icon name="solid-chevron-right" size="xs" themeColor="error"></ssk-icon>
									</button>
									</div>
								{/if}
								{#if kindNeedsTravelFee(group.kind)}
									<div class="parcel-method">
										<!-- sm, not md — this sits inline in the same card row as the
										     .dest-trigger-value/.selector-title text beside it (both sm); md
										     (ssk-input's own font-size token for that size) read visibly larger
										     than its neighbors, the same mismatch the kind dropdown had. -->
										<ssk-input
											size="sm"
											placeholder="ระบุจำนวน"
											autoComplete="off"
											type="number"
											min="0"
											step="1"
											value={group.shippingFee !== undefined ? String(group.shippingFee) : ''}
											on:input={travelFeeInputHandler(group)}
											on:change={travelFeeInputHandler(group)}
											on:click|stopPropagation
											data-testid={`sales.delivery.parcel.${seq}.travelFee`}
										>
											<ssk-input-addon slot="prefix">
												<span class="travel-fee-addon">
													<ssk-icon
														name="outline-wrench-screwdriver"
														size="sm"
														themeColor="primary"
													></ssk-icon>
													<span>ค่าเดินทาง</span>
												</span>
											</ssk-input-addon>
											<ssk-input-addon slot="postfix">
												<span>บาท</span>
											</ssk-input-addon>
										</ssk-input>
									</div>
								{/if}
								{#if kindNeedsShippingMethod(group.kind)}
									<div class="parcel-dest">
									<button
										type="button"
										class="dest-trigger"
										on:click|stopPropagation={() => openMethodView(group)}
										data-testid={`sales.delivery.parcel.${seq}.method`}
									>
										<ssk-icon
											name="outline-truck"
											size="sm"
											themeColor="primary"
										></ssk-icon>
										<span class="dest-trigger-value">
											{#if group.method}
												{methodLabel(group)} · {shippingTypeLabel(group.shippingType)} · {group.shippingFee !==
												undefined
													? formatPriceWithBath(group.shippingFee)
													: 'ยังไม่ระบุค่าส่ง'}
											{:else}
												เลือกวิธีส่ง
											{/if}
										</span>
										<ssk-icon
											name="solid-chevron-right"
											size="xs"
											themeColor="stroke"
										></ssk-icon>
									</button>
									</div>
								{/if}

							<ssk-divider
								class="parcel-divider"
								size="xs"
								margin="sm"
								color="transparent"
							></ssk-divider>

							<div class="parcel-items">
								{#if itemsOf(group).length === 0}
									<!-- A parcel the cashier just created: say what it is waiting for, rather
									     than showing a card that looks broken. It collapses on its own if the
									     cart changes before anything is moved in. -->
									<span class="parcel-item-empty">
										ยังไม่มีสินค้าในกลุ่มนี้ — กด “ย้าย” ที่สินค้าในกลุ่มอื่นเพื่อย้ายเข้ามา
									</span>
								{/if}
								{#each itemsOf(group) as item, idx (item.lineId)}
									<div class="parcel-item" class:dragging={dragItem?.lineId === item.lineId}>
										{#if !group.locked}
											<!-- touch-action: none — without it, a touch-drag starting here scrolls
											     the panel instead of being read as a drag gesture (requirement 6's
											     "ต้องไม่มี overlay" already leaves the rest of the page interactive;
											     this handle is the one new pointer-capture surface on top of it). -->
											<span
												class="parcel-item-handle"
												aria-hidden="true"
												on:pointerdown={(e) => onItemPointerDown(e, item, group)}
												on:click|stopPropagation
											>
												<ssk-icon name="outline-bars-3" size="xs" themeColor="stroke"></ssk-icon>
											</span>
										{/if}
										<img class="parcel-item-image" src={getImageUrl(item.image)} alt="" />
										<div class="parcel-item-main">
											<div class="parcel-item-top">
												<span class="parcel-item-name" title={item.product_name}
													>{item.product_name}</span
												>
												<span class="parcel-item-total"
													>{formatPriceWithBath(item.price * item.qty)}</span
												>
											</div>
											<div class="parcel-item-bottom">
												<span class="parcel-item-sub"
													>{formatPriceWithBath(item.price)} · {item.code}</span
												>
												<!-- stopPropagation here, not per-control — qty stepper, move dropdown
												     and its options all live inside this one wrapper, and the card's own
												     activate-on-click must never fire from any of them. -->
												<span
													class="parcel-item-actions"
													role="presentation"
													on:click|stopPropagation
													on:keydown|stopPropagation
												>
													<CustomInputNumber
														bind:value={item.qty}
														layout="horizontal"
														removeAtMin
														onRemove={() => RemoveCartItem(item.lineId ?? '')}
														onChange={() => onItemQtyChange(item)}
													/>
												</span>
											</div>
										</div>
									</div>
								{/each}
							</div>

							{#if group.locked}
								<div class="parcel-footnote">
									<ssk-icon name="outline-lock-closed" size="xs" themeColor="gray"></ssk-icon>
									<!-- The lock on this card is a pointer, not a dead end — the switch that
									     built this pile is one screen back, on the cart line itself. -->
									{#if isHandoverGroup(group)}
										สลับ “รับทันที / จัดส่ง” ได้ที่รายการสินค้าในตะกร้า
									{:else}
										แยกอัตโนมัติ — {splitReasonText(group.splitReason)}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				{/if}

				{#if isCartEmpty}
					<ssk-tooltip size="xs" themeColor="black" hideCloseButton={true} placement="top">
						<span slot="content" class="tooltip-content">
							<ssk-text size="xs" color="white">ตะกร้ายังไม่มีสินค้าให้จัดกลุ่ม</ssk-text>
						</span>
						<ssk-button size="sm" variant="ghost" disabled data-testid="sales.delivery.add">
							+ เพิ่มกลุ่ม
						</ssk-button>
					</ssk-tooltip>
				{:else if !cartLoading}
					<ssk-button
						size="sm"
						variant="ghost"
						on:click={onAddGroup}
						data-testid="sales.delivery.add"
					>
						+ เพิ่มกลุ่ม
					</ssk-button>
				{/if}
			</div>

			<div class="panel-footer footer-list">
				{#if hasShippingKindGroup}
					{#if feeBreakdownParts.length > 0}
						<div class="fee-breakdown">{feeBreakdownParts.join(' · ')}</div>
					{/if}
					<div class="fee-total">
						<span>รวมค่าจัดส่ง</span>
						<span>{formatPriceWithBath($deliverySummary.totalFee)}</span>
					</div>
				{/if}
				<ssk-button
					width="full"
					disabled={$deliverySummary.missing.length > 0}
					on:click={onFinish}
					data-testid="sales.delivery.done"
				>
					{$deliverySummary.missing.length > 0 ? 'ยังระบุปลายทางไม่ครบ' : 'เสร็จสิ้น'}
				</ssk-button>
			</div>
		{:else if view === 'address'}
			<div class="panel-body">
				{#if addresses.length === 0}
					<!-- Only the create path is gated (§6 "no permission") — it writes customer
					     data, which a cashier may lack CUSTOMERCREATE for. Picking among addresses
					     the customer already has, in the PickList below, stays open to everyone. -->
					{#if canCreateAddress}
						<button
							type="button"
							class="empty"
							on:click={() => onCreateAddress?.(activeGroupId)}
							data-testid="sales.delivery.address.create"
						>
							<ssk-icon name="outline-map-pin" size="sm" themeColor="stroke"></ssk-icon>
							เพิ่มที่อยู่จัดส่งของลูกค้ารายนี้
						</button>
					{:else}
						<ssk-tooltip size="xs" themeColor="black" hideCloseButton={true} placement="top">
							<span slot="content" class="tooltip-content">
								<ssk-text size="xs" color="white">จำกัดสิทธิ์การเข้าถึง</ssk-text>
							</span>
							<button
								type="button"
								class="empty"
								disabled
								data-testid="sales.delivery.address.create"
							>
								<ssk-icon name="outline-map-pin" size="sm" themeColor="stroke"></ssk-icon>
								เพิ่มที่อยู่จัดส่งของลูกค้ารายนี้
							</button>
						</ssk-tooltip>
					{/if}
				{:else}
					<PickList
						label="ที่อยู่จัดส่ง"
						count={addresses.length}
						selectedIndex={addresses.findIndex(
							(a) => String(a.id) === activeGroup?.recipientAddressId
						)}
						onMove={(i) => {
							const a = addresses[i];
							if (a) pickAddressForActiveGroup(a);
						}}
					>
						{#each addresses as address, index (address.id ?? index)}
							<PickCard
								title={address.contactName || 'ที่อยู่จัดส่ง'}
								badge={address.isDefault ? 'ที่อยู่หลัก' : ''}
								lines={[
									addressToDisplay(address),
									address.phone ? `โทร ${address.phone}` : ''
								].filter(Boolean)}
								selected={String(address.id) === activeGroup?.recipientAddressId}
								tabbable={String(address.id) === activeGroup?.recipientAddressId ||
									(!activeSelectedAddress && index === 0)}
								onSelect={() => pickAddressForActiveGroup(address)}
								testId={`sales.delivery.address.option.${address.id ?? index}`}
							/>
						{/each}
					</PickList>
				{/if}
			</div>
			<div class="panel-footer footer">
				<ssk-button
					variant="outline"
					themeColor="gray"
					width="full"
					on:click={() => (view = 'list')}
					data-testid="sales.delivery.address.back"
				>
					กลับ
				</ssk-button>
			</div>
		{:else}
			<div class="panel-body method-body">
				<ssk-tab-header
					class="tabs"
					variant="button"
					size="sm"
					align="center"
					color="primary"
					buttonwidth="auto"
				>
					<ssk-tab-button
						variant="button"
						size="sm"
						align="center"
						buttonwidth="auto"
						width="100%"
						active={draftShippingType === ShippingType.Standard}
						on:click={() => onSelectShippingType(ShippingType.Standard)}
					>
						<div class="tab-text">Standard</div>
					</ssk-tab-button>
					<ssk-tab-button
						variant="button"
						size="sm"
						align="center"
						buttonwidth="auto"
						width="100%"
						active={draftShippingType === ShippingType.SameDay}
						on:click={() => onSelectShippingType(ShippingType.SameDay)}
					>
						<div class="tab-text">Same Day</div>
					</ssk-tab-button>
				</ssk-tab-header>

				<div class="grid">
					<CustomFancyRadioGroup
						label=""
						options={renderOptions(
							draftShippingType === ShippingType.Standard ? standardDeliveries : sameDayDeliveries
						)}
						optionsPerRow={2}
						value={draftMethod}
						onChange={(v) => (draftMethod = v)}
					/>
					<ssk-input
						size="lg"
						label="ค่าจัดส่ง"
						placeholder="ระบุค่าจัดส่ง"
						autoComplete="off"
						limit="255"
						value={draftFee}
						on:input={onDraftFeeInput}
						on:change={onDraftFeeInput}
						data-testid="sales.delivery.method.fee"
					/>
				</div>
			</div>
			<div class="panel-footer footer">
				<ssk-button
					variant="outline"
					themeColor="gray"
					width="full"
					on:click={() => (view = 'list')}
					data-testid="sales.delivery.method.cancel"
				>
					ยกเลิก
				</ssk-button>
				<ssk-button width="full" on:click={saveMethod} data-testid="sales.delivery.method.save">
					บันทึก
				</ssk-button>
			</div>
		{/if}
		</div>

		{#if dragItem}
			<!-- position: absolute inside .panel-root (which is itself position:fixed, inset:0
			     — exactly the viewport box), so clientX/clientY map directly to top/left with
			     no extra offset math. pointer-events: none so it never steals the
			     elementFromPoint lookup onDragPointerMove depends on to find the card
			     underneath it. -->
			<div class="drag-ghost" style={`left:${dragGhostX}px; top:${dragGhostY}px`}>
				<img class="drag-ghost-image" src={getImageUrl(dragItem.image)} alt="" />
				<span class="drag-ghost-name">{dragItem.product_name}</span>
			</div>
		{/if}
	</div>
{/if}

<ModalPickupBranch
	show={showPickupBranchModal}
	{branches}
	selectedStoreId={pickupBranchGroup?.pickupStoreId ?? ''}
	sellingStoreId={defaultPickupStoreId}
	onSelect={onSelectPickupBranch}
	close={() => (showPickupBranchModal = false)}
	modalId="delivery-group-pickup-branch"
	testIdPrefix="sales.delivery.group.pickup"
/>

<style>
	/* Blanket border-box — content clipping mid-digit ("฿80.", "3 ราย...") at the panel's
	   right edge traced back to a content-box/percentage-width mismatch somewhere in this
	   subtree (several rows mix explicit padding with width:100% children). Rather than
	   hunt every remaining offender one at a time, every element in the panel is put on
	   the same box model so padding/border is never silently added on top of a width
	   that already assumed it wasn't. */
	.panel-root,
	.panel-root *,
	.panel-root *::before,
	.panel-root *::after {
		box-sizing: border-box;
	}

	/* position: fixed + inset keeps this a true floating panel over the page, same as
	   ssk-drawer used to render it — only the backdrop is gone (requirement 7), not the
	   "floats on top" part. pointer-events: none on the outer wrapper is what makes the
	   product grid behind it clickable with no dimming overlay at all; .panel re-enables
	   pointer-events on itself so the panel's own content still works normally. */
	.panel-root {
		position: fixed;
		inset: 0;
		z-index: 15;
		pointer-events: none;
	}

	.drag-ghost {
		position: absolute;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: 12rem;
		padding: 0.5rem 0.75rem;
		background: #fff;
		border: 1px solid var(--ssk-colors-primary-500);
		border-radius: 10px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
		pointer-events: none;
		/* Offset from the finger/cursor, not centered under it — a card sitting exactly
		   under the pointer would hide the very thing elementFromPoint is trying to read. */
		transform: translate(-50%, -125%);
	}

	.drag-ghost-image {
		flex: 0 0 auto;
		width: 2rem;
		height: 2rem;
		border-radius: 6px;
		object-fit: cover;
		background: var(--ssk-colors-gray-100);
	}

	.drag-ghost-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		color: var(--ssk-colors-gray-800);
	}

	.panel {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 550px;
		/* 100%, not 100vw — .panel-root is already position:fixed; inset:0, so it already
		   matches the real visible viewport. 100vw instead measures the viewport INCLUDING
		   the width a scrollbar occupies, which is wider than what's actually on screen —
		   exactly what was pushing this panel's right edge past the window's right edge. */
		max-width: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: #fff;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
		pointer-events: auto;
	}

	/* While a drag is in flight (dragItem set), block text selection across the WHOLE
	   panel, not just the row the drag started on — onItemPointerDown's preventDefault
	   stops the browser's native click-and-drag text selection at the source, but this
	   is the net for a selection that was already begun a moment before (e.g. a slightly
	   sloppy press-and-hold) so the product names/prices the pointer sweeps over while
	   carrying the ghost card never "paint" black mid-drag. */
	.panel.dragging,
	.panel.dragging * {
		user-select: none;
	}

	/* Narrow viewport (phones, a split/narrow POS window) — the fixed 550px would
	   otherwise get clamped flush against both edges with no breathing room at all;
	   tighten the side padding to match so the panel still reads as a bordered sheet,
	   not a second full-bleed page. */
	@media (max-width: 480px) {
		.panel-header,
		.panel-body,
		.panel-footer {
			padding-left: 0.875rem;
			padding-right: 0.875rem;
		}
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex: 0 0 auto;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--ssk-colors-gray-200);
	}

	.panel-title {
		font-size: var(--ssk-font-size-md, 1rem);
		font-weight: 600;
		color: var(--ssk-colors-gray-900);
	}

	.panel-close {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem;
		border: 0;
		background: none;
		cursor: pointer;
		color: var(--ssk-colors-gray-500);
	}

	.panel-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		/* Only vertical scroll is ever intentional here — explicit, not left to default
		   (overflow-x's initial value is visible, which lets any descendant that's even a
		   px wider than this box — a layout slip, not actual extra content — show up as a
		   horizontal scrollbar nobody meant to add). */
		overflow-x: hidden;
		/* 1.25rem — same unit (rem, not px) and same horizontal gutter as .panel-header/
		   .panel-footer below, so the whole panel reads as one consistent column. */
		padding: 1.25rem;
	}

	.panel-footer {
		flex: 0 0 auto;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--ssk-colors-gray-200);
	}

	.body {
		display: grid;
		align-content: start;
		gap: 1rem;
	}

	.centered {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 12rem;
	}

	.parcel-card {
		display: grid;
		gap: 0.75rem;
		min-width: 0;
		padding: 1rem 1.25rem;
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 12px;
	}

	/* A cashier-made card is a real click target (role="button") — same cursor/focus
	   affordance a <button> gets for free. */
	.parcel-card.activatable {
		cursor: pointer;
	}

	.parcel-card.activatable:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 2px;
	}

	/* Same active styling language as the cart's own DeliveryGroupCards.svelte — one
	   visual vocabulary for "this is the group new products land in" everywhere it shows. */
	.parcel-card.active {
		border-color: var(--ssk-colors-primary-500);
		background: var(--ssk-colors-primary-50, #fff4ef);
	}

	.parcel-card.drag-over {
		border: 2px dashed var(--ssk-colors-primary-500);
		background: var(--ssk-colors-primary-50, #fff4ef);
	}

	/* Dashed + sunken: a locked card cannot be changed the way the others can, and the
	   border says so before the tooltip does. */
	.parcel-card.locked {
		border-style: dashed;
		background: var(--ssk-colors-gray-50);
	}

	/* A handover card is locked too, so this must sit AFTER .locked: both selectors weigh
	   the same and source order is what settles the properties they both set. Green, but
	   still the same dashed, sunken locked card — the accent says "this one is already in
	   the customer's hands", not "this is a different kind of thing". */
	.parcel-card.handover {
		border-color: var(--ssk-colors-success-600, #16a34a);
	}

	/* The band bleeds back out over the card's own padding so it reads as the card's
	   header rather than a green rectangle floating inside it; 9px is the card's 10px
	   radius less its 1px border. */
	.parcel-card.handover .parcel-head {
		margin: -0.75rem -0.875rem 0;
		padding: 0.5rem 0.875rem;
		background: var(--ssk-colors-success-50, #f0fdf4);
		border-radius: 9px 9px 0 0;
	}

	.parcel-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.parcel-title {
		font-size: var(--ssk-font-size-md, 1rem);
		font-weight: 600;
		color: var(--ssk-colors-gray-800);
	}

	/* Everything but the title clusters at the right edge — one group, not several
	   independently-floating auto-margined pieces (active label, count, lock/remove are
	   never all present together, but whichever subset is just follows in order). */
	.parcel-head-trailing {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.parcel-active-label {
		font-size: var(--ssk-font-size-sm);
		font-weight: 600;
		color: var(--ssk-colors-primary-500);
	}

	.parcel-count {
		display: inline-flex;
		align-items: center;
		padding: 0 0.375rem;
		border-radius: 999px;
		background: var(--ssk-colors-gray-100);
		font-size: var(--ssk-font-size-xs);
		font-weight: 500;
		color: var(--ssk-colors-gray-700);
	}

	.parcel-divider {
		background-image: repeating-linear-gradient(
			to right,
			var(--ssk-colors-gray-300) 0 4px,
			transparent 4px 8px
		);
		background-position: center;
		background-repeat: no-repeat;
		background-size: 100% 1px;
	}

	.parcel-origin {
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
	}

	.parcel-locked {
		display: inline-flex;
		align-items: center;
		color: var(--ssk-colors-gray-400);
	}

	.parcel-remove {
		display: inline-flex;
		align-items: center;
		/* Same 0.25rem hit-area padding as .panel-close — a bare icon button on a touch
		   POS needs more than its own glyph to be reliably tappable. */
		padding: 0.25rem;
		margin: -0.25rem;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.parcel-remove:focus-visible {
		outline: 2px solid var(--ssk-colors-error-500, #ef4444);
		outline-offset: 1px;
	}

	.parcel-dest {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.375rem;
		min-width: 0;
		width: 100%;
	}

	/* §6 — grid, not a wrapping flex+baseline row: name and address/sub-line stack as a
	   clean column instead of jostling for baseline alignment against each other. */
	.dest-info {
		display: grid;
		gap: 0.125rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	.dest-name {
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		line-height: 1.5;
		color: var(--ssk-colors-gray-800);
	}

	/* The digital parcel's own sub-line, muted like every other secondary line in this
	   drawer. */
	.dest-sub {
		font-size: var(--ssk-font-size-xs);
		line-height: 1.5;
		color: var(--ssk-colors-gray-500);
	}

	/* §2 — the shared dropdown-shaped trigger row every "เปลี่ยน"/empty-state button in
	   this card now renders through: icon, grow value, trailing chevron, spanning the
	   card's width. One class, one shape, for the shipping address, shipping method and
	   digital-email triggers alike — a hand-tuned button per card kind is exactly what
	   made these inconsistent and easy to miss before. flex-basis 100% (not width: 100%
	   alone) is what actually pushes it onto its own line inside .parcel-dest's
	   flex-wrap row; .parcel-method opts into the same wrap for its own copy. */
	.dest-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1 0 100%;
		min-width: 0;
		padding: 0.625rem 0.75rem;
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		box-sizing: border-box;
	}

	.dest-trigger:hover {
		background: var(--ssk-colors-gray-50);
	}

	.dest-trigger:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}

	.dest-trigger-value {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-800);
	}

	.address-choice-badge {
		flex: 0 0 auto;
		padding: 0.125rem 0.375rem;
		border-radius: 999px;
		background: var(--ssk-colors-gray-100);
		font-size: var(--ssk-font-size-xs);
		font-weight: 500;
		color: var(--ssk-colors-gray-600);
		white-space: nowrap;
	}

	.address-choice-badge.default {
		background: var(--ssk-colors-success-50);
		color: var(--ssk-colors-success-600);
	}

	/* The empty-state variant — same bordered row shape, but carrying the same
	   warning coloring the old .dest-missing box used, so an unfilled destination still
	   visually stands out as a bigger, friendlier row instead of fading into the rest of
	   the card now that it's no longer sitting in its own tinted box. */
	.dest-trigger.empty {
		background: var(--ssk-colors-error-50, #fef2f2);
		border-color: var(--ssk-colors-error-200, #fecaca);
	}

	.dest-trigger.empty:hover {
		background: var(--ssk-colors-error-100, #fee2e2);
	}

	.dest-trigger.empty .dest-trigger-value {
		color: var(--ssk-colors-error-600, #dc2626);
	}

	.parcel-items {
		display: grid;
		gap: 0;
	}

	.parcel-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-height: 3.25rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--ssk-colors-gray-100);
	}

	/* The row being carried fades instead of disappearing — the ghost card is the only
	   thing that should read as "this is moving," not a gap where the row used to be. */
	.parcel-item.dragging {
		opacity: 0.4;
	}

	.parcel-item:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}

	.parcel-item:first-child {
		padding-top: 0;
	}

	.parcel-item-handle {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		height: 3rem;
		color: var(--ssk-colors-gray-400);
		cursor: grab;
		/* Without this, a touch-drag starting on the handle scrolls the panel instead of
		   being read as a drag gesture — see onItemPointerDown's own comment. */
		touch-action: none;
		/* Baseline guard so much as a plain press-and-hold on the handle itself never
		   starts a text selection — the `.panel.dragging` rule above covers the rest of
		   the row/panel only once a drag has actually started. */
		user-select: none;
	}

	.parcel-item-image {
		flex: 0 0 auto;
		width: 3rem;
		height: 3rem;
		border-radius: 8px;
		object-fit: cover;
		background: var(--ssk-colors-gray-100);
	}

	.parcel-item-main {
		flex: 1 1 auto;
		min-width: 0;
		display: grid;
		gap: 0.25rem;
	}

	.parcel-item-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.parcel-item-total {
		flex: 0 0 auto;
		font-size: var(--ssk-font-size-md, 1rem);
		font-weight: 600;
		color: var(--ssk-colors-gray-900);
	}

	.parcel-item-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.parcel-item-sub {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-500);
	}

	.parcel-item-actions {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* block, not inline-flex — a `width: 100%` child's percentage resolves against this
	   box's own computed width, and an inline-flex box with no explicit width of its own
	   sizes itself via shrink-to-fit INCLUDING that same child, a circular resolution some
	   browsers get wrong and stretch past the card's real edge. */
	.parcel-kind-row {
		display: block;
		width: 100%;
		padding-bottom: 0;
	}

	.parcel-kind-dropdown {
		display: block;
		width: 100%;
	}

	.parcel-kind-dropdown ssk-dropdown-button {
		display: flex;
		min-height: 44px;
	}

	/* Copied (not shared — Svelte scopes styles per component) from Cart.svelte's own
	   .selector-body/.selector-text/.selector-title/.option-body, so this dropdown and
	   the "ช่องทางการขาย" channel selector read as one visual family, byte-for-byte. */
	.selector-body {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--ssk-font-family-sans, 'Noto Sans Thai', Roboto, sans-serif);
		min-width: 0;
		text-align: start;
	}

	.selector-text {
		display: grid;
		row-gap: 0.125rem;
		min-width: 0;
	}

	.selector-title {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		/* var(--ssk-font-size-sm), not the 13px Cart.svelte's own .selector-title drops to —
		   that 13px exists there only to fit "จัดส่งจากหน้าร้าน" inside a cramped ~175px
		   card on the main cart page (see its own comment). This dropdown sits in a
		   full-width row inside a 550px drawer panel instead, right next to every
		   .dest-trigger-value row (address/method/fee/branch), which all use this same
		   token — so matching it here is what makes every field in the drawer read as
		   one size, instead of this one dropdown sitting 1px smaller than its neighbors. */
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		line-height: 1.35;
		color: var(--ssk-colors-gray-800);
	}

	.selector-hint {
		font-size: var(--ssk-font-size-xs);
		line-height: 1.3;
		color: var(--ssk-colors-gray-500);
	}

	.option-body {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		min-height: 1.75rem;
	}

	.parcel-item-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--ssk-font-size-md, 1rem);
		line-height: 1.5;
		font-weight: 500;
		color: var(--ssk-colors-gray-800);
	}

	.parcel-item-empty {
		display: block;
		padding: 0.25rem 0;
		font-size: var(--ssk-font-size-xs);
		line-height: 1.4;
		color: var(--ssk-colors-gray-500);
	}


	.parcel-method {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.5rem;
		min-width: 0;
		width: 100%;
	}

	.parcel-method ssk-input {
		width: 100%;
		max-width: 100%;
		min-width: 0;
		height: 44px;
		box-sizing: border-box;
	}

	.travel-fee-addon {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.parcel-footnote {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
	}

	/* A fact about the cart, not a card the cashier can act on. */
	.parcel-note {
		padding: 0.25rem 0.125rem;
		font-size: var(--ssk-font-size-xs);
		line-height: 1.4;
		color: var(--ssk-colors-gray-500);
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.875rem;
		width: 100%;
		background: none;
		border: 1px dashed var(--ssk-colors-gray-300);
		border-radius: 10px;
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		color: var(--ssk-colors-primary-500);
		cursor: pointer;
	}

	.empty:hover {
		background: var(--ssk-colors-gray-50);
	}

	.empty:disabled {
		color: var(--ssk-colors-gray-400);
		border-color: var(--ssk-colors-gray-200);
		cursor: not-allowed;
	}

	.empty:disabled:hover {
		background: none;
	}

	.footer {
		display: flex;
		gap: 0.75rem;
		width: 100%;
	}

	.footer ssk-button {
		flex: 1 1 0;
		min-width: 0;
	}

	.footer-list {
		display: grid;
		gap: 0.5rem;
		width: 100%;
	}

	.fee-breakdown {
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
	}

	.fee-total {
		display: flex;
		justify-content: space-between;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		color: var(--ssk-colors-gray-800);
	}

	.method-body {
		display: grid;
		align-content: start;
		gap: 0.75rem;
	}

	.tabs {
		display: block;
		width: 100%;
		padding-bottom: 0.75rem;
	}

	.grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}

	.tab-text {
		padding: 0.3rem;
	}

	.tooltip-content {
		padding: 2px 4px;
		max-width: 20rem;
		word-wrap: break-word;
		white-space: normal;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
