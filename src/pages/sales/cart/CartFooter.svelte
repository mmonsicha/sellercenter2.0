<script lang="ts">
	import Modal from '$components/modal/Modal.svelte';

	import type { discountType } from '$stores/cart';
	import {
		calculateDiscount,
		calculateSummary,
		cartListInfo,
		ClearAllItem
	} from '$stores/cart/cart';
	import {
		clearOrderMeta,
		createOrder,
		getOrder,
		makeOrder,
		orderData,
		shippingFee
	} from '$stores/order/order';
	import {
		commitDeliveryGroupsToOrder,
		deliveryGroups,
		deliverySummary,
		showDeliveryDetail
	} from '$stores/order/delivery-group';
	import { DeliveryGroupKind, handoverItemQty } from '$lib/entities/order/delivery-group';
	import {
		clearPayment,
		makeAttributesPayment,
		paymentInfo,
		showPaymentModal,
		togglePaymentModal,
		updatePayment,
		updateTaskInfoAndPaymentAmount
	} from '$stores/payment';
	import { currentStore } from '$stores/store/current-store';
	import { formatPriceWithBath } from '$utils/format-number';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { isDiscountValueValid } from './util.cart';
	import { isDiscountCodeEnabled } from '$lib/feature-flags';
	import {
		discountCodeMessage,
		lookupDiscountCode,
		normalizeDiscountCode,
		suggestDiscountCodes,
		type DiscountCodeSuggestion
	} from '$service/discount-code';
	import { currentCompany } from '$stores/company/current-company';
	import { newPartyInfo, OrderFlow, PaymentType, FullfilmentType } from '$lib/entities/order/order';
	import { currentLanguage } from '$stores/i18n';
	import { configurationStore } from '$stores/configuration';
	import { PaymentMode } from '$lib/entities/configuration/configuration';
	import { resolveOrderFlow } from '$utils/order-flow';
	import {
		openPaymentModal,
		initPaymentTransaction,
		resolveAvailablePaymentMethods,
		showNoPaymentChannelModal
	} from '$stores/payment/payment-transaction';
	import {
		ONLINE_PAYMENT_METHODS,
		OFFLINE_PAYMENT_METHODS,
		type PaymentMethod
	} from '$lib/entities/payment/payment-method';
	import {
		getCustomerByIdWithAccess,
		updateCustomerWithAccess
	} from '../../../service/customer-book-v2-rest';
	import { marketplaceValues, shouldUseSukipayOnline } from '$utils/utils-order';

	export let total: number;
	export let discount: number;
	export let hasItem: boolean;
	export let summary: number;
	export let isDeliveryLater: boolean;
	export let isBuyerValid: boolean;
	export let isOnline: boolean;
	// LINK_BILL sends the buyer a payment link instead of taking payment at the counter.
	// The link endpoint does not exist yet, so the action is visible but inert — better
	// than pretending an order was created.
	export let isLinkBill: boolean = false;
	export let fullfilmentType: string = FullfilmentType.PickupImmediate;
	// Branch the customer will collect a pick-up-later order at. Empty for every other
	// fulfilment type, and the order builder then behaves exactly as before.
	export let pickupStoreId: string = '';
	// Fired whenever a sale actually ENDS — order created, or the cashier explicitly clears
	// the cart — so Cart.svelte can put its own channel/fulfilment selection (POS/ออนไลน์/
	// ลิงก์, รูปแบบการรับสินค้า) back to the system default for the NEXT sale. clearData()
	// below already resets $orderData's own saleChannel via clearOrderMeta, but that's the
	// order's backing data, not Cart.svelte's own local `channel`/`fullfilmentType` — nothing
	// read it back, so a sale finished on, say, ออนไลน์ + digital left the NEXT sale's UI
	// still showing that instead of starting fresh at POS + รับทันที.
	export let onSaleReset: () => void = () => {};

	let isProcessing = false;
	var remark: string = '';

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');
	const helperText = 'รูปแบบไม่ถูกต้อง';
	var isError: boolean = false;
	var value: string = '';
	var dType: discountType = 'percentage';
	var phdValue: string;
	var showClearCartModal: boolean = false;
	// Discount and note moved out of the cart into their own modals; the row keeps two
	// buttons instead of three always-on fields. Each modal edits a draft copy so
	// "ยกเลิก" really cancels — the live `value` / `dType` / `remark` (which the
	// reactive block below turns into the order total) only change on confirm.
	var showDiscountModal: boolean = false;
	var showRemarkModal: boolean = false;
	var draftDType: discountType = 'percentage';
	var draftValue: string = '';
	var draftError: boolean = false;
	var draftRemark: string = '';
	// The code behind the committed discount, and the modal's own draft of it. Kept apart
	// from `value` because a code sets an amount but an amount does not imply a code.
	var discountCode: string | undefined = undefined;
	var draftCode: string | undefined = undefined;
	// The preset REASON chip behind a MANUAL discount (never set alongside discountCode —
	// a code already names itself as the reason, see applyDiscount/makeOrder).
	var reason: string | undefined = undefined;
	var draftReason: string | undefined = undefined;
	// Which of the 3 sections the modal is showing. Separate from `dType`/`draftDType`
	// (percentage/fixed only) because `coupon` isn't a discount TYPE at all — it is a
	// different way to arrive at one, and resolving a code still writes its type/value
	// into draftDType/draftValue same as always (submitDiscountCode).
	type DiscountTab = discountType | 'coupon';
	var draftTab: DiscountTab = 'percentage';
	var codeInput: string = '';
	var codeMessage: string = '';
	var codeOk: boolean = false;
	const phd = {
		fixed: 'patona-sellercenter-sales-placeholder-fixed',
		percentage: 'patona-sellercenter-sales-placeholder-percentage'
	};
	let titleClearCart: string;
	let descriptionClearCart: string;

	let tooltipItems: string[] = [];
	let typePayment: string = '';

	// Collapsible so the item list gets the height back on short screens (e.g. 1366x768
	// laptops) — persisted per-device so a cashier's pick sticks across sales, defaulting
	// to expanded only on screens tall enough to show it without pushing the pay button off.
	const SUMMARY_EXPANDED_KEY = 'pos.cart.summaryExpanded';
	function readStoredSummaryExpanded(): boolean | undefined {
		try {
			const raw = localStorage.getItem(SUMMARY_EXPANDED_KEY);
			return raw === null ? undefined : raw === 'true';
		} catch {
			return undefined;
		}
	}
	let summaryExpanded =
		readStoredSummaryExpanded() ?? (typeof window !== 'undefined' ? window.innerHeight >= 900 : true);

	function toggleSummaryExpanded() {
		summaryExpanded = !summaryExpanded;
		try {
			localStorage.setItem(SUMMARY_EXPANDED_KEY, String(summaryExpanded));
		} catch {
			// best-effort — collapsing/expanding still works for this session
		}
	}

	cartListInfo.subscribe((c) => {
		summary = c.summaryPrice;

		if (c.data.length === 0) {
			clearDiscountErrorValue();
			clearRemarkValue();
		}
	});

	function _onChangeRemark(e: Event) {
		draftRemark = (e.target as HTMLTextAreaElement).value;
	}

	// The 3 sections are mutually exclusive ways to reach ONE discount, so switching
	// between them clears whatever the other two had drafted: a 50 typed as a percentage
	// must not carry over into a ฿ discount, and leaving the coupon tab drops whatever it
	// resolved (clearDraftCode) so a stale code can't silently ride along with a manually
	// picked amount.
	const DISCOUNT_TABS: { tab: DiscountTab; label: string; icon: string }[] = [
		{ tab: 'percentage', label: 'ส่วนลด %', icon: 'outline-receipt-percent' },
		{ tab: 'fixed', label: 'ส่วนลดบาท', icon: 'outline-banknotes' },
		{ tab: 'coupon', label: 'คูปอง', icon: 'outline-ticket' }
	];
	// Coupon only shows up when the feature flag is on — filtered once here so the
	// template, the keyboard nav below and focusOption's own index all agree on the same
	// list, instead of each re-deriving (or forgetting to re-derive) the same filter.
	$: visibleDiscountTabs = DISCOUNT_TABS.filter((t) => t.tab !== 'coupon' || isDiscountCodeEnabled());

	const selectDraftTab = (tab: DiscountTab) => {
		if (tab === draftTab) return;
		draftTab = tab;
		draftError = false;
		draftValue = '';
		clearDraftCode();
		if (tab !== 'coupon') draftDType = tab;
	};

	// ssk-tab-button renders a plain <div> with no role and no tabindex, so the
	// roving-tabindex behaviour a tablist needs lives here, same pattern Cart.svelte's own
	// channel/fulfilment segmented controls use (rovingTarget/focusOption).
	function rovingDiscountTarget(event: KeyboardEvent, index: number, length: number): number | undefined {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') return (index + 1) % length;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') return (index - 1 + length) % length;
		if (event.key === 'Enter' || event.key === ' ') return index;
		return undefined;
	}

	const onDiscountTabKeydown = (index: number) => (event: KeyboardEvent) => {
		const next = rovingDiscountTarget(event, index, visibleDiscountTabs.length);
		if (next === undefined) return;

		event.preventDefault();
		const target = visibleDiscountTabs[next]?.tab;
		if (target) selectDraftTab(target);
		(event.currentTarget as HTMLElement).parentElement
			?.querySelectorAll<HTMLElement>('ssk-tab-button')
			[next]?.focus();
	};

	// A short, consistent preset list instead of a free-text field — a reason picked from
	// 5 options reads the same way every time a bill is reviewed later; a typed one
	// wouldn't. Optional (§ "REASON (OPTIONAL)") and only meaningful for a manual
	// discount — a coupon already names itself as the reason, see applyDiscount.
	const REASON_OPTIONS = [
		'ผู้จัดการอนุมัติ',
		'สินค้ามีตำหนิ',
		'ปรับตามราคาคู่แข่ง',
		'ของขวัญสะสมแต้ม',
		'วันเกิดลูกค้า'
	];

	// Tapping the already-picked reason again clears it — same "pick or unpick" rule
	// the quick-amount chips already use (class:active + re-tap), not a radiogroup.
	const selectDraftReason = (option: string) => {
		draftReason = draftReason === option ? undefined : option;
	};

	function _onChangeInput(e: Event) {
		draftValue = (e.target as HTMLInputElement).value.replace(/[^\d.-]/g, '');
		draftError = !isDiscountValueValid(draftValue, draftDType);

		if (draftDType === 'percentage' && +draftValue > 100) {
			draftValue = '100';
		}

		(e.target as HTMLInputElement).value = draftValue;
	}

	// Amounts a cashier reaches for constantly, one tap instead of typing. Percent and
	// baht get their own set, each its own realistic range for what it's used for.
	const QUICK_DISCOUNTS: Record<discountType, number[]> = {
		percentage: [5, 10, 15, 20, 25, 50],
		fixed: [20, 50, 100, 200, 500]
	};

	const applyQuickDiscount = (amount: number) => {
		draftValue = String(amount);
		draftError = false;
		// A tapped amount is the cashier's own, not a code's — drop any code that was
		// applied, or the bill would claim a discount the code did not give.
		clearDraftCode();
	};

	const openDiscountModal = () => {
		draftDType = dType;
		draftValue = value;
		draftError = isError;
		draftCode = discountCode;
		draftReason = reason;
		// A committed code lands back on the coupon tab (that's how it got here); a
		// committed reason or a plain amount lands on whichever type it actually is.
		draftTab = discountCode ? 'coupon' : dType;
		codeInput = discountCode ?? '';
		codeMessage = '';
		codeOk = false;
		showDiscountModal = true;
	};

	// A handler, not an inline expression: a TS cast inside markup does not parse (the
	// same reason the discount amount's own handler lives up here).
	function _onChangeCodeInput(e: Event) {
		codeInput = (e.target as HTMLInputElement).value;
		// Editing the code invalidates the verdict shown under it.
		if (codeMessage) {
			codeMessage = '';
			codeOk = false;
		}
	}

	function clearDraftCode() {
		draftCode = undefined;
		codeMessage = '';
		codeOk = false;
	}

	async function submitDiscountCode() {
		const result = await lookupDiscountCode(codeInput);
		codeMessage = discountCodeMessage(result);
		codeOk = result.status === 'ok';

		if (result.status !== 'ok') {
			draftCode = undefined;
			return;
		}

		// A code decides both the kind of discount and its amount — showing them in the
		// fields above keeps one visible source of truth instead of a second hidden one.
		draftDType = result.type;
		draftValue = String(result.value);
		draftError = false;
		draftCode = result.code;
	}

	// Codes that still match what's typed so far, live — see suggestDiscountCodes.
	$: codeSuggestions = suggestDiscountCodes(codeInput);

	// Tapping a suggestion fills the field AND applies it in one tap, rather than just
	// autocompleting text the cashier would still have to press ใช้รหัส on.
	async function applySuggestedCode(suggestion: DiscountCodeSuggestion) {
		codeInput = suggestion.code;
		await submitDiscountCode();
	}

	const closeDiscountModal = () => (showDiscountModal = false);

	const applyDiscount = () => {
		// The coupon tab can only commit a code that actually resolved — typing something
		// that never got looked up (or failed) must not silently apply as if it had.
		if (draftTab === 'coupon' ? !codeOk : draftError) return;
		dType = draftDType;
		value = draftValue;
		discountCode = draftValue ? draftCode : undefined;
		// A code already names itself as the reason (see makeOrder) — a reason from the
		// percent/amount tabs must not ride along once the coupon tab is what actually
		// committed.
		reason = discountCode ? undefined : draftReason;
		isError = false;
		showDiscountModal = false;
	};

	const clearDraftDiscount = () => {
		draftValue = '';
		draftError = false;
		draftReason = undefined;
		clearDraftCode();
		codeInput = '';
	};

	const openRemarkModal = () => {
		draftRemark = remark;
		showRemarkModal = true;
	};

	const closeRemarkModal = () => (showRemarkModal = false);

	const applyRemark = () => {
		remark = draftRemark;
		showRemarkModal = false;
	};

	// Same limit the field already validated against before this redesign (255) — the
	// mockup's own "280" is illustrative, not a confirmed backend column width, so it's
	// not worth risking a save failure over to match a screenshot exactly.
	const REMARK_LIMIT = 255;

	// Short, common phrases a cashier can tap in instead of typing — appended onto
	// whatever is already drafted rather than replacing it, since a note is often more
	// than one of these at once (e.g. "Gift wrap, no straw").
	const quickRemarkPhrases = [
		'ห่อของขวัญ',
		'ไม่รับหลอด',
		'หวานน้อย',
		'ทานที่ร้าน',
		'ลูกค้าเร่งด่วน',
		'โทรก่อนจัดส่ง'
	];

	function appendQuickRemark(phrase: string) {
		const next = draftRemark ? `${draftRemark}, ${phrase}` : phrase;
		draftRemark = next.slice(0, REMARK_LIMIT);
	}

	function clearDraftRemark() {
		draftRemark = '';
	}

	// Cmd (Mac) / Ctrl (everything else) + Enter saves without reaching for the mouse —
	// a plain Enter stays a newline, same as any other multi-line field.
	function onRemarkKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			applyRemark();
		}
	}

	// Label the buttons with what they hold, so the row states the order's extras
	// without opening anything.
	$: discountLabel =
		+value > 0 && !isError
			? dType === 'percentage'
				? `ส่วนลด ${value}%`
				: `ส่วนลด ${formatPriceWithBath(+value)}`
			: 'เพิ่มส่วนลด';
	$: hasDiscount = +value > 0 && !isError;
	// The active chip's own title — just the type+amount ("10%"/"฿50"), the baht it
	// actually took off already rides as the chip's subtitle, so repeating "ส่วนลด"
	// in both places would be redundant on a card this small.
	$: discountChipTitle = dType === 'percentage' ? `${value}% ส่วนลด` : `ส่วนลด ${formatPriceWithBath(+value)}`;

	// The modal's own live preview — subtotal/discount/new total — so the cashier sees
	// the actual baht it takes off WHILE picking %, not only after applying. On the
	// coupon tab there's nothing to preview until a code has actually resolved (codeOk) —
	// draftDType/draftValue hold stale values from before the code was typed otherwise.
	$: previewDiscountAmount =
		draftTab === 'coupon' && !codeOk
			? 0
			: draftDType === 'fixed'
				? Math.max(0, +draftValue || 0)
				: Math.max(0, ((+draftValue || 0) / 100) * total);
	$: previewNewTotal = Math.max(0, total - previewDiscountAmount);

	// The ✕ on the active discount chip — clears the committed discount outright,
	// without opening the modal first (unlike "ยกเลิก" in the modal, which only
	// discards an in-progress draft). Also drops any applied code: a code gave this
	// amount, so clearing the amount must not leave a "still applied" code behind.
	function clearCommittedDiscount() {
		value = '';
		isError = false;
		discountCode = undefined;
		reason = undefined;
	}

	// The modal's own "ลบส่วนลด" footer link — same clear, but also closes the modal
	// since there is nothing left in it worth looking at once the discount is gone.
	function removeCommittedDiscountAndClose() {
		clearCommittedDiscount();
		showDiscountModal = false;
	}

	// Pieces, not lines — the cashier counts objects into the bag. qty lives on the cart
	// line rather than on the group, so the cart has to be handed in (handoverItemQty);
	// deliverySummary stays a pure function of deliveryGroups and never reads it itself.
	$: handoverQty = $deliverySummary.handoverGroup
		? handoverItemQty($deliverySummary.handoverGroup, $cartListInfo.data)
		: 0;

	// Every piece in the cart, across every group combined — only worth a row once there's
	// a real multi-group picture to summarize (gated on $showDeliveryDetail at the call
	// site), otherwise a plain single-group sale shows nothing new.
	$: totalItemCount = ($cartListInfo.data ?? []).reduce(
		(sum, i) => sum + (isNaN(i.qty) ? 0 : i.qty),
		0
	);
	// Only ever shown in the COLLAPSED bar, next to the grand-total label — the cashier
	// gets a quick glance at what's inside without reopening the section, which is the
	// whole point of being collapsed; the expanded view already itemizes every line below,
	// so this is deliberately left off the expanded grand-total row to avoid saying it
	// twice. ส่วนลด only joins in once one is applied (hasDiscount), same gate the
	// quick-action chip above already uses, so a sale with no discount reads as a plain
	// "N รายการ" instead of a redundant "ส่วนลด -฿0".
	$: summaryHeaderText = [
		`${totalItemCount} รายการ`,
		...(hasDiscount ? [`ส่วนลด -${formatPriceWithBath(discount)}`] : [])
	].join(' · ');

	// Keep courier shipping and on-site travel fees on separate rows so each amount has
	// an unambiguous label in the compact cart summary.
	$: shippingFeeGroups = $deliveryGroups.filter((group) => group.kind === DeliveryGroupKind.Shipping);
	$: onSiteFeeGroups = $deliveryGroups.filter((group) => group.kind === DeliveryGroupKind.OnSite);
	$: shippingFeeTotal = shippingFeeGroups.reduce((sum, group) => sum + (group.shippingFee ?? 0), 0);
	$: onSiteFeeTotal = onSiteFeeGroups.reduce((sum, group) => sum + (group.shippingFee ?? 0), 0);

	// Same figure the (now optionally hidden) breakdown's own grand-total row shows —
	// the collapsed bar needs it too. Gated on $deliveryGroups.length (not
	// $showDeliveryDetail) — a single-bucket sale (the common case) already has its fee
	// live on that one group the moment the cashier saves it in ข้อมูลการจัดส่ง, but
	// $showDeliveryDetail stays false for it (needs 2+ groups or Digital/OnSite), which
	// was leaving this reading the stale order-level $shippingFee (only ever synced into
	// $orderData at checkout via commitDeliveryGroupsToOrder) instead — the fee looked
	// like it never saved. $deliveryGroups is only ever empty when multi-parcel is off
	// (VITE_DISABLE_MULTI_PARCEL, staging/production today) or the cart itself is, both
	// cases where $shippingFee is correctly the only real source left.
	$: grandTotal = summary + ($deliveryGroups.length > 0 ? $deliverySummary.totalFee : $shippingFee);

	function toggleClearCartModal() {
		showClearCartModal = !showClearCartModal;
	}

	function clearData() {
		clearDiscountErrorValue();
		clearRemarkValue();
		ClearAllItem();
		$orderData.buyer = newPartyInfo();
		clearOrderMeta();
		onSaleReset();
	}

	function isValidPaymentType(type?: string): boolean {
		const ignoredPlatformTypes = ['unknown', ...marketplaceValues];
		return !!type && type.trim() !== '' && !ignoredPlatformTypes.includes(type);
	}

	async function handleOrder({
		flow,
		beforeMakeOrder,
		onSuccess
	}: {
		flow: OrderFlow;
		beforeMakeOrder?: () => void;
		onSuccess?: () => void;
	}) {
		if (isProcessing) return;
		isProcessing = true;

		try {
			beforeMakeOrder?.();

			await makeOrder(
				$cartListInfo,
				+value,
				$currentStore.id!,
				$currentCompany.id!,
				$orderData.buyer,
				flow,
				$orderData.saleChannel!,
				remark,
				pickupStoreId
			);

			await createOrder($orderData, $currentStore.id!);
			onSuccess?.();

			if (isValidPaymentType($orderData.paymentType)) {
				typePayment = $orderData.paymentType ?? '';
			}

			toastStore.addToast({
				message: 'บันทึกสำเร็จ',
				type: 'success',
				timeout: 5000
			});
		} catch (error) {
			toastStore.addToast({
				message: 'เกิดข้อผิดพลาดกรุณาลองใหม่อีกครั้ง',
				type: 'error',
				timeout: 5000
			});
		} finally {
			isProcessing = false;
		}
	}

	// Appends this order to the buyer's Customer Book v2 order history.
	// Payment-agnostic — safe for any flow (does NOT touch payment-task attributes).
	async function appendOrderToCustomer() {
		if (!$orderData.buyer.refId) return;

		const customer = await getCustomerByIdWithAccess(
			$orderData.buyer.refId,
			`sellsuki.company:${$currentCompany.id}`
		);

		customer.orderList = customer.orderList ?? [];
		customer.latestOrder = $orderData.createdAt ? new Date($orderData.createdAt) : undefined;

		if (!customer.orderList.includes($orderData.orderId!)) {
			customer.orderList.push($orderData.orderId!);
		}

		await updateCustomerWithAccess(customer);
	}

	// Legacy (non-sukipay) online linkage: writes the legacy payment-task attributes
	// (payment_ref/payment_note/payment_type) then appends the order to the customer.
	// NOTE: only valid for legacy flows — the sukipay flow's payments task rejects these
	// attributes, so the sukipay path uses appendOrderToCustomer() directly instead.
	async function linkOrderToCustomer() {
		if (!$orderData.buyer.refId) return;

		if (isValidPaymentType(typePayment)) {
			updatePayment({
				type: typePayment,
				total: summary
			});

			let attributes = makeAttributesPayment($paymentInfo);
			await updateTaskInfoAndPaymentAmount(
				$currentStore.id!,
				$orderData?.orderId!,
				attributes,
				$orderData!
			);
		}

		await appendOrderToCustomer();
	}

	async function _onClickOnlineSave() {
		const companyId = $currentCompany?.id ?? '';
		const storeId = $currentStore?.id ?? '';
		const cfg = $configurationStore.data.companies[companyId];
		// SukiPay online is used ONLY when the chosen payment method is bank transfer;
		// any other method falls back to the legacy POS_ONLINE flow (no payment modal).
		const useSukipay = shouldUseSukipayOnline(cfg?.paymentMode, $orderData.paymentType);

		if (useSukipay) {
			// Resolved before creating the order so we can bail out early when the store
			// has no usable payment channel, and drive the modal's tabs from real config.
			let availableMethods: PaymentMethod[] = [];
			if (storeId) {
				availableMethods = await resolveAvailablePaymentMethods(
					companyId,
					storeId,
					ONLINE_PAYMENT_METHODS
				);
				if (availableMethods.length === 0) {
					showNoPaymentChannelModal();
					return;
				}
			}

			await handleOrder({
				flow: OrderFlow.POS_ONLINE_SUKIPAY_V1,
				beforeMakeOrder: () => {
					// Folds the groups' combined shipping fee into the order's single Delivery
					// right before makeOrder reads it — see delivery-group.ts's own comment on
					// why this stays a fold rather than a real per-group payload today.
					// Fold the delivery group(s) into the order's single Delivery before checkout reads
				// it — not just on a split: a single-group sale (POS ShopDelivery/OnSite, or any
				// online sale) sets its method/fee on the group via the fulfilment-info panel
				// now, not on orderData.deliveries directly, so this must run whenever a group
				// exists at all. commitDeliveryGroupsToOrder() is already a no-op on an empty list.
				if ($deliveryGroups.length > 0) commitDeliveryGroupsToOrder();
				},
				onSuccess: async () => {
					const orderId = $orderData.orderId ?? '';
					// createOrder returns only the orderId — fetch the order to get its
					// serial (running number) so the modal title shows it, not '-'.
					try {
						await getOrder(storeId, orderId);
					} catch (err) {
						console.warn('[payment] fetch order for serial failed:', err);
					}

					// SukiPay owns payment for this flow — open the modal + init the
					// transaction. Do NOT write legacy payment-task attributes here
					// (payment_ref/note/type): POS-ONLINE-SUKIPAY-V1's payments task
					// rejects them, which previously threw before the modal could open.
					openPaymentModal({
						orderId,
						orderSerial: $orderData.orderSerial ?? '',
						totalAmount: summary,
						methods: availableMethods
					});
					try {
						await initPaymentTransaction({ storeId, orderId });
					} catch (err) {
						// Error already surfaced via store; modal will show 'failed' state
						console.warn('[payment] init transaction failed:', err);
					}

					// Best-effort customer-book linkage — must run before clearData (needs
					// buyer/order ids) and must not block the payment modal on failure.
					try {
						await appendOrderToCustomer();
					} catch (err) {
						console.warn('[order] append to customer book failed:', err);
					}

					clearData();
					clearPayment();
					typePayment = '';
				}
			});
			return;
		}

		// non-sukipay online: unchanged legacy path
		await handleOrder({
			flow: OrderFlow.POS_ONLINE,
			beforeMakeOrder: () => {
				// Fold the delivery group(s) into the order's single Delivery before checkout reads
				// it — not just on a split: a single-group sale (POS ShopDelivery/OnSite, or any
				// online sale) sets its method/fee on the group via the fulfilment-info panel
				// now, not on orderData.deliveries directly, so this must run whenever a group
				// exists at all. commitDeliveryGroupsToOrder() is already a no-op on an empty list.
				if ($deliveryGroups.length > 0) commitDeliveryGroupsToOrder();
			},
			onSuccess: async () => {
				await getOrder($currentStore.id!, $orderData.orderId!);

				await linkOrderToCustomer();

				clearData();
				clearPayment();
				typePayment = '';
			}
		});
	}

	async function _onClickPayment() {
		const companyId = $currentCompany?.id ?? '';
		const storeId = $currentStore?.id ?? '';
		const cfg = $configurationStore.data.companies[companyId];
		const isSukipay = cfg?.paymentMode === PaymentMode.Sukipay;

		// Resolved before creating the order so we can bail out early when the store
		// has no usable payment channel, and drive the modal's tabs from real config.
		let availableMethods: PaymentMethod[] = [];
		if (isSukipay && storeId) {
			const contextMethods = isOnline ? ONLINE_PAYMENT_METHODS : OFFLINE_PAYMENT_METHODS;
			availableMethods = await resolveAvailablePaymentMethods(companyId, storeId, contextMethods);
			if (availableMethods.length === 0) {
				showNoPaymentChannelModal();
				return;
			}
		}

		const flow = resolveOrderFlow({
			isSukipay,
			isOnline,
			fullfilmentType: fullfilmentType as FullfilmentType,
			hasBuyer: !!$orderData.buyer?.refId,
			isDeliveryLater
		});

		await handleOrder({
			flow,
			beforeMakeOrder: () => {
				// Fold the delivery group(s) into the order's single Delivery before checkout reads
				// it — not just on a split: a single-group sale (POS ShopDelivery/OnSite, or any
				// online sale) sets its method/fee on the group via the fulfilment-info panel
				// now, not on orderData.deliveries directly, so this must run whenever a group
				// exists at all. commitDeliveryGroupsToOrder() is already a no-op on an empty list.
				if ($deliveryGroups.length > 0) commitDeliveryGroupsToOrder();
				updatePayment({
					type: PaymentType.Cash,
					total: summary
				});
			},
			onSuccess: async () => {
				if (isSukipay) {
					const orderId = $orderData.orderId ?? '';
					// createOrder returns only the orderId — fetch the order to get its
					// serial (running number) so the modal title shows it, not '-'.
					try {
						await getOrder(storeId, orderId);
					} catch (err) {
						console.warn('[payment] fetch order for serial failed:', err);
					}
					openPaymentModal({
						orderId,
						orderSerial: $orderData.orderSerial ?? '',
						totalAmount: summary,
						methods: availableMethods
					});
					try {
						await initPaymentTransaction({ storeId, orderId });
					} catch (err) {
						// Error already surfaced via store; modal will show 'failed' state
						console.warn('[payment] init transaction failed:', err);
					}
				} else {
					togglePaymentModal($showPaymentModal);
				}
			}
		});
	}

	function _onClearCartOK() {
		showClearCartModal = false;
		clearDiscountErrorValue();
		clearRemarkValue();
		ClearAllItem();
		onSaleReset();
		toastStore.addToast({
			message: 'นำสินค้าออกสำเร็จ',
			type: 'success',
			timeout: 5000
		});
	}

	function _onBlur() {
		if (value === '') isError = false;
	}

	function clearDiscountErrorValue() {
		value = '';
		isError = false;
	}

	$: {
		if ($cartListInfo.data.length === 0) {
			value = '';
			remark = '';
		}

		if (!isError || !value) {
			calculateDiscount(total, dType, +value, discountCode, reason);
			calculateSummary(total, discount);
		}
	}

	const loadKeywords = async () => {
		const covertKey = await i18nStore.get(
			'patona-sellercenter-sales-tooltip',
			$currentLanguage.code,
			'default'
		);
		tooltipItems = covertKey
			.split('\n')
			.map((t) => t.trim())
			.filter(Boolean);

		titleClearCart = await i18nStore.get(
			'patona-sellercenter-sales-modal-clear-title-clearcart',
			$currentLanguage.code,
			'default'
		);
		descriptionClearCart = await i18nStore.get(
			'patona-sellercenter-sales-modal-clear-description-clearcart',
			$currentLanguage.code,
			'default'
		);
		descriptionClearCart = descriptionClearCart.replace(/\n/g, '<br />');
	};

	function clearRemarkValue() {
		remark = '';
	}

	$: if ($currentLanguage.code) {
		loadKeywords();
	}

	// The field's placeholder follows the *draft* type — the old afterUpdate read the
	// committed dType, so it labelled the input one confirm behind what was selected.
	const loadPlaceholder = async (t: discountType) => {
		phdValue = await i18nStore.get(
			phd[t as 'fixed' | 'percentage'],
			$currentLanguage.code,
			'default'
		);
	};
	$: if ($currentLanguage.code) loadPlaceholder(draftDType);
</script>

<!-- Discount, in a modal. The fields are the same ones that used to sit in the cart;
     they bind to the draft copy, so closing without confirming changes nothing. -->
<Modal
	toggleModal={closeDiscountModal}
	id="discount"
	ShowModal={showDiscountModal}
	title="เพิ่มส่วนลด"
	description={`ใช้กับยอดรวม ${formatPriceWithBath(total)}`}
	hPosition="left"
	width="min(36rem, calc(100vw - 2.5rem))"
>
	<div class="modal-fields" slot="body">
		<!-- 3 mutually exclusive ways to reach one discount: a %, a flat บาท amount, or a
		     coupon code. Each own tab (not the old 2-way ประเภท toggle beside a code row
		     underneath) since a coupon isn't a third VALUE for the same field, it's a
		     different ROUTE to one — picking it swaps the whole panel below, not just a
		     unit label. DS's own ssk-tab-header/ssk-tab-button, same pattern as Cart.svelte's
		     channel/shipping-method segmented controls, not a bespoke button row. -->
		<ssk-tab-header
			class="tabs discount-tabs"
			variant="button"
			size="sm"
			align="center"
			color="primary"
			buttonwidth="auto"
			role="radiogroup"
			aria-label="วิธีให้ส่วนลด"
		>
			{#each visibleDiscountTabs as t, index}
				<ssk-tab-button
					active={draftTab === t.tab}
					variant="button"
					size="sm"
					align="center"
					buttonwidth="auto"
					width="100%"
					role="radio"
					aria-checked={draftTab === t.tab}
					tabindex={draftTab === t.tab ? 0 : -1}
					on:click={() => selectDraftTab(t.tab)}
					on:keydown={onDiscountTabKeydown(index)}
					data-testid={`sales.cart.discount.tab.${t.tab}`}
				>
					<div class="tab-text">
						<ssk-icon name={t.icon} size="xs"></ssk-icon>
						<span>{t.label}</span>
					</div>
				</ssk-tab-button>
			{/each}
		</ssk-tab-header>

		<!-- A fixed-height floor around the tab-dependent content — ส่วนลด %/บาท (input +
		     quick-chips + reason chips) is the tallest of the 3 panels, and คูปอง (just an
		     input + button, taller only once a message/suggestion list appears) used to
		     leave the modal visibly shrinking and growing every time the cashier switched
		     tabs. min-height pins it to the tallest panel's own height instead, so a
		     shorter panel just leaves blank space rather than resizing the modal. -->
		<div class="discount-panel">
		{#if draftTab === 'coupon'}
			<!-- Coupon panel — its own text field, no stepper/unit (a code isn't a number),
			     and a sample-code row that doubles as a hint and a shortcut: it starts as
			     every active code and narrows to whatever's typed (suggestDiscountCodes),
			     so there's always something tappable even before the cashier knows a code
			     by heart. -->
			<span class="code-label">รหัสคูปอง</span>
			<div class="code-controls">
				<ssk-input
					size="sm"
					value={codeInput}
					placeholder="เช่น SAVE10"
					autoComplete="off"
					on:input={_onChangeCodeInput}
					on:change={_onChangeCodeInput}
					data-testid="sales.cart.discount.code.input"
				></ssk-input>
				<ssk-button
					size="sm"
					variant="outline"
					themeColor="button"
					disabled={!codeInput.trim()}
					on:click={submitDiscountCode}
					data-testid="sales.cart.discount.code.apply"
				>
					ใช้รหัส
				</ssk-button>
			</div>
			{#if codeMessage}
				<span class="code-message" class:ok={codeOk} data-testid="sales.cart.discount.code.message">
					{codeMessage}
				</span>
			{/if}
			{#if codeSuggestions.length > 0}
				<div class="code-suggest">
					<span class="code-suggest-label">ลองโค้ดตัวอย่าง</span>
					<div class="code-suggest-chips">
						{#each codeSuggestions as suggestion}
							<button
								type="button"
								class="remark-chip"
								class:active={normalizeDiscountCode(codeInput) === suggestion.code}
								on:click={() => applySuggestedCode(suggestion)}
								data-testid={`sales.cart.discount.code.suggest.${suggestion.code}`}
							>
								{suggestion.code}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		{:else}
			<!-- Percent/Amount panel. -->
			<span class="code-label">{draftTab === 'percentage' ? 'ส่วนลดเปอร์เซ็นต์' : 'ส่วนลดเป็นบาท'}</span>
			{#key draftTab}
				<ssk-input
					class="discount-value"
					value={draftValue}
					size="lg"
					placeholder={phdValue}
					error={draftError}
					autoComplete="off"
					helperText={draftError ? helperText : ''}
					on:input={_onChangeInput}
					on:change={_onChangeInput}
					data-testid="sales.cart.discount.input"
				>
					{#if draftTab === 'fixed'}
						<ssk-input-addon slot="prefix">
							<span class="unit">฿</span>
						</ssk-input-addon>
					{/if}
					<!-- One addon: the DS pins each postfix addon to the right edge, so a second
					     one lands on top of the first. Unit and clear share this one instead. -->
					<ssk-input-addon slot="postfix">
						<span class="postfix-group">
							{#if draftTab === 'percentage'}
								<span class="unit">%</span>
							{/if}
							{#if draftValue}
								<button
									type="button"
									class="clear-value"
									aria-label="ล้างส่วนลด"
									on:click={clearDraftDiscount}
								>
									<ssk-icon name="outline-x-circle"></ssk-icon>
								</button>
							{/if}
						</span>
					</ssk-input-addon>
				</ssk-input>
			{/key}
			<!-- The amounts a cashier actually uses, one tap each. -->
			<div class="quick-row" role="group" aria-label="ส่วนลดที่ใช้บ่อย">
				{#each QUICK_DISCOUNTS[draftTab] as amount}
					<button
						type="button"
						class="quick-chip"
						class:active={draftValue === String(amount)}
						aria-pressed={draftValue === String(amount)}
						on:click={() => applyQuickDiscount(amount)}
						data-testid={`sales.cart.discount.quick.${amount}`}
					>
						{draftTab === 'percentage' ? `${amount}%` : `฿${amount}`}
					</button>
				{/each}
			</div>
			<!-- Why — optional, preset so a bill reads the same reason the same way every
			     time instead of however it happened to get typed. -->
			<div class="reason-block">
				<span class="code-label">เหตุผล (ไม่บังคับ)</span>
				<div class="reason-row" role="group" aria-label="เหตุผลส่วนลด">
					{#each REASON_OPTIONS as option}
						<button
							type="button"
							class="reason-chip"
							class:active={draftReason === option}
							aria-pressed={draftReason === option}
							on:click={() => selectDraftReason(option)}
							data-testid={`sales.cart.discount.reason.${option}`}
						>
							{option}
						</button>
					{/each}
				</div>
			</div>
		{/if}
		</div>

		<!-- The actual math, live — subtotal, what's coming off, what's left — so the
		     cashier sees the real baht before committing, not just a % in the abstract. -->
		<div class="discount-breakdown">
			<div class="breakdown-row">
				<span>ยอดรวม</span>
				<span>{formatPriceWithBath(total)}</span>
			</div>
			<div class="breakdown-row breakdown-discount">
				<span>ส่วนลด</span>
				<span>-{formatPriceWithBath(previewDiscountAmount)}</span>
			</div>
			<div class="breakdown-row breakdown-total">
				<span>ยอดใหม่</span>
				<span>{formatPriceWithBath(previewNewTotal)}</span>
			</div>
		</div>

		<div class="modal-hint">
			<ssk-text size="xs" color="gray.500">
				{#each tooltipItems as item}
					<div>{item}</div>
				{/each}
			</ssk-text>
		</div>
	</div>
	<div class="remark-footer-left" slot="modal-footer-left">
		{#if hasDiscount}
			<button
				type="button"
				class="remark-clear-link"
				on:click={removeCommittedDiscountAndClose}
				data-testid="sales.cart.discount.remove"
			>
				ลบส่วนลด
			</button>
		{/if}
	</div>
	<div class="remark-footer-right" slot="modal-footer-right">
		<ssk-button
			variant="outline"
			themeColor="gray"
			on:click={closeDiscountModal}
			data-testid="sales.cart.discount.cancel"
		>
			<ssk-i18n-translate
				key="patona-sellercenter-sales-modal-add-button-cancel"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button
			disabled={draftTab === 'coupon' ? !codeOk : draftError}
			on:click={applyDiscount}
			data-testid="sales.cart.discount.apply"
		>
			<ssk-icon slot="prefix" name="outline-check" themeColor="white"></ssk-icon>
			{previewDiscountAmount > 0
				? `ใช้ส่วนลด -${formatPriceWithBath(previewDiscountAmount)}`
				: 'ใช้ส่วนลด'}
		</ssk-button>
	</div>
</Modal>

<!-- Note, in a modal. -->
<Modal
	toggleModal={closeRemarkModal}
	id="remark"
	ShowModal={showRemarkModal}
	title="หมายเหตุคำสั่งขาย"
	description="พนักงานแพ็คสินค้าและใบเสร็จจะเห็นข้อความนี้"
	hPosition="left"
	width="min(26rem, calc(100vw - 2.5rem))"
>
	<div class="modal-fields remark-fields" slot="body">
		<ssk-textarea
			size="sm"
			rows={4}
			placeholder="เช่น ห่อของขวัญ"
			limit={REMARK_LIMIT}
			helperText="กด Cmd/Ctrl+Enter เพื่อบันทึก"
			value={draftRemark}
			on:input={_onChangeRemark}
			on:change={_onChangeRemark}
			on:keydown={onRemarkKeydown}
			data-testid="sales.cart.remark.input"
		></ssk-textarea>
		<div class="remark-quick-add">
			<span class="remark-quick-add-label">เพิ่มด่วน</span>
			<div class="remark-quick-add-chips">
				{#each quickRemarkPhrases as phrase}
					<button
						type="button"
						class="remark-chip"
						on:click={() => appendQuickRemark(phrase)}
						data-testid={`sales.cart.remark.quickadd.${phrase}`}
					>
						+ {phrase}
					</button>
				{/each}
			</div>
		</div>
	</div>
	<div class="remark-footer-left" slot="modal-footer-left">
		<button
			type="button"
			class="remark-clear-link"
			disabled={!draftRemark}
			on:click={clearDraftRemark}
			data-testid="sales.cart.remark.clear"
		>
			ล้างหมายเหตุ
		</button>
	</div>
	<div class="remark-footer-right" slot="modal-footer-right">
		<ssk-button
			variant="outline"
			themeColor="gray"
			on:click={closeRemarkModal}
			data-testid="sales.cart.remark.cancel"
		>
			<ssk-i18n-translate
				key="patona-sellercenter-sales-modal-add-button-cancel"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button
			class="remark-apply"
			on:click={applyRemark}
			data-testid="sales.cart.remark.apply"
		>
			<ssk-icon slot="prefix" name="outline-check" themeColor="white"></ssk-icon>
			บันทึกหมายเหตุ
		</ssk-button>
	</div>
</Modal>

<Modal
	toggleModal={toggleClearCartModal}
	id="clear-cart"
	icon="outline-exclamation-circle"
	iconColor="#d97706"
	ShowModal={showClearCartModal}
	title={titleClearCart}
	body="<center>{descriptionClearCart}</center>"
>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={async () => {
			showClearCartModal = false;
		}}
	>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-clear-button-close"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button width="full" slot="modal-footer-right" on:click={_onClearCartOK}>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-clear-button-clearcart"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</Modal>

<div class="summary">
	{#if summaryExpanded}
	<!-- Two buttons instead of three standing fields: both extras live in modals now,
	     and each button states whether it is holding anything (filled = has content,
	     matching the reference). -->
	<div class="quick-actions">
		<div class="quick-action" class:has-value={hasDiscount}>
			{#if hasDiscount}
				<!-- Active state — a chip, not the same ghost/solid button: the type+amount
				     and the baht it actually took off are two different facts, so they get
				     two lines (title/subtitle) instead of being squeezed into one button
				     label. ✕ is its own sibling button (not nested in the chip's own button —
				     see DeliveryGroupCards.svelte's card-main/card-delete for the same reason)
				     so clearing never also opens the modal. -->
				<div class="chip-wrap">
					<button
						type="button"
						class="chip-active"
						on:click={openDiscountModal}
						data-testid="sales.cart.discount.open"
					>
						<span class="chip-icon">
							<ssk-icon name="outline-receipt-percent" size="xs" themeColor="white"></ssk-icon>
						</span>
						<span class="chip-text">
							<span class="chip-title">{discountChipTitle}</span>
							<span class="chip-subtitle">-{formatPriceWithBath(discount)}</span>
						</span>
					</button>
					<button
						type="button"
						class="chip-remove"
						aria-label="ลบส่วนลด"
						on:click|stopPropagation={clearCommittedDiscount}
						data-testid="sales.cart.discount.clear"
					>
						<ssk-icon name="outline-x-mark" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				</div>
			{:else}
				<ssk-button
					size="sm"
					width="full"
					variant="ghost"
					themeColor="button"
					disabled={!hasItem}
					on:click={openDiscountModal}
					data-testid="sales.cart.discount.open"
				>
					<ssk-icon slot="prefix" name="outline-receipt-percent" themeColor="stroke"></ssk-icon>
					<ssk-text slot="prefix" size="sm" color="gray.800">{discountLabel}</ssk-text>
				</ssk-button>
			{/if}
		</div>
		<div class="quick-action" class:has-value={!!remark}>
			{#if remark}
				<div class="chip-wrap">
					<button
						type="button"
						class="chip-active"
						on:click={openRemarkModal}
						data-testid="sales.cart.remark.open"
					>
						<span class="chip-icon">
							<ssk-icon name="outline-document-text" size="xs" themeColor="white"></ssk-icon>
						</span>
						<span class="chip-text">
							<span class="chip-title">หมายเหตุ</span>
							<span class="chip-subtitle">{remark}</span>
						</span>
					</button>
					<button
						type="button"
						class="chip-remove"
						aria-label="ลบหมายเหตุ"
						on:click|stopPropagation={clearRemarkValue}
						data-testid="sales.cart.remark.clear"
					>
						<ssk-icon name="outline-x-mark" size="xs" themeColor="stroke"></ssk-icon>
					</button>
				</div>
			{:else}
				<ssk-button
					size="sm"
					width="full"
					variant="ghost"
					themeColor="button"
					on:click={openRemarkModal}
					data-testid="sales.cart.remark.open"
				>
					<ssk-icon slot="prefix" name="outline-document-text" themeColor="stroke"></ssk-icon>
					<ssk-text slot="prefix" size="sm" color="gray.800">เพิ่มหมายเหตุ</ssk-text>
				</ssk-button>
			{/if}
		</div>
	</div>

	<!-- Every line of money the cashier reads before taking payment, always at full
	     height. The item list above is what gives up space, never this. -->
	<div class="detail">
		<button
			type="button"
			class="summary-collapse-toggle"
			on:click={toggleSummaryExpanded}
			aria-label="ย่อสรุปยอด"
			data-testid="sales.cart.summary.toggle"
		>
			<ssk-icon name="outline-chevron-down" size="xs" themeColor="stroke"></ssk-icon>
		</button>

		<div class="summary-row summary-subtotal">
			<ssk-text fontSize="24px" color="gray.700" fontWeight="medium">
				<ssk-i18n-translate
					key="patona-sellercenter-sales-summary-totalprice"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
			<ssk-text fontSize="24px" color="gray.700" fontWeight="medium"
				>{formatPriceWithBath(total)}</ssk-text
			>
		</div>
		{#if value}
			<div class="summary-row summary-row-single summary-secondary">
				<ssk-text fontSize="20px" color="gray.500">
					<ssk-i18n-translate
						key="patona-sellercenter-sales-summary-discount"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				<ssk-text fontSize="20px" color="rose.600">
					-{formatPriceWithBath(discount)}
				</ssk-text>
			</div>
		{/if}
		{#if $showDeliveryDetail}
			<div class="summary-row summary-secondary">
				<ssk-text fontSize="20px" color="gray.500"
					>{totalItemCount} รายการรวม (รวมทุกกลุ่ม)</ssk-text
				>
			</div>
			{#if $deliverySummary.shippingCount > 0}
				<div class="summary-row summary-secondary">
					<ssk-text class="summary-row-label" fontSize="20px" color="gray.500">
						ค่าจัดส่ง ({$deliverySummary.shippingCount} พัสดุ)
					</ssk-text>
					<ssk-text fontSize="20px" color="gray.500">
						{formatPriceWithBath(shippingFeeTotal)}
					</ssk-text>
				</div>
			{/if}
			{#if $deliverySummary.onSiteCount > 0}
				<div class="summary-row summary-secondary">
					<ssk-text class="summary-row-label" fontSize="20px" color="gray.500">
						ค่าเดินทาง ({$deliverySummary.onSiteCount} กลุ่ม)
					</ssk-text>
					<ssk-text fontSize="20px" color="gray.500">
						{formatPriceWithBath(onSiteFeeTotal)}
					</ssk-text>
				</div>
			{/if}
		{:else if isOnline}
			<div class="summary-row summary-secondary">
				<ssk-text fontSize="20px" color="gray.500">
					<ssk-i18n-translate
						key="patona-sellercenter-sales-summary-shippingfee"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
				</ssk-text>
				<ssk-text fontSize="20px" color="gray.500">
					{#if $deliveryGroups.length > 0}
						{formatPriceWithBath(shippingFeeTotal)}
					{:else}
						{formatPriceWithBath($shippingFee)}
					{/if}
				</ssk-text>
			</div>
		{/if}
		<div class="summary-row summary-grand-total">
			<ssk-text fontSize="24px" color="gray.900" fontWeight="bold">
				<ssk-i18n-translate
					key="patona-sellercenter-sales-summary-grandtotal"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
			<ssk-text fontSize="24px" color="primary" fontWeight="bold">
				{formatPriceWithBath(grandTotal)}
			</ssk-text>
		</div>
	</div>
	{:else}
	<!-- Collapsed: one compact row carries the number that matters most (grand total)
	     plus the "· N รายการ · ส่วนลด ..." detail — the cashier gets a quick glance at
	     the breakdown WITHOUT reopening the section, which is the whole point of this
	     being the collapsed state. Expanded already shows every line itemized below, so
	     this suffix only lives here, not duplicated onto the expanded grand-total row too. -->
	<button
		type="button"
		class="summary-collapsed"
		on:click={toggleSummaryExpanded}
		data-testid="sales.cart.summary.toggle"
	>
		<span class="summary-collapsed-label">
			<ssk-i18n-translate
				key="patona-sellercenter-sales-summary-grandtotal"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
			<span class="summary-collapsed-discount"> · {summaryHeaderText}</span>
		</span>
		<span class="summary-collapsed-right">
			<span class="summary-collapsed-total">{formatPriceWithBath(grandTotal)}</span>
			<ssk-icon name="outline-chevron-up" size="xs" themeColor="stroke"></ssk-icon>
		</span>
	</button>
	{/if}
	<div class="footer">
		<!-- The two terminal actions keep the DS default size: they are the last thing a
		     cashier should have to aim at, and they sit side by side so they match. -->
		<ssk-button
			disabled={!hasItem}
			on:click={toggleClearCartModal}
			variant="outline"
			themeColor="secondary"
			width="full"
		>
			<ssk-i18n-translate
				key="patona-sellercenter-sales-button-clearcart"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		{#if isLinkBill}
			<ssk-button
				width="full"
				disabled
				title="รอ endpoint สร้างลิงก์ชำระเงินจากฝั่ง backend"
				data-testid="sales.cart.linkbill.generate"
			>
				สร้างลิงก์ชำระเงิน
			</ssk-button>
		{:else if isOnline}
			<ssk-button
				width="full"
				disabled={!hasItem ||
					isProcessing ||
					(isOnline && !isBuyerValid) ||
					($showDeliveryDetail && $deliverySummary.missing.length > 0)}
				on:click={_onClickOnlineSave}
			>
				บันทึก
			</ssk-button>
		{:else}
			<ssk-button
				width="full"
				disabled={!hasItem ||
					isError ||
					isProcessing ||
					(isDeliveryLater && !isBuyerValid) ||
					($showDeliveryDetail && $deliverySummary.missing.length > 0)}
				on:click={_onClickPayment}
			>
				<ssk-i18n-translate
					key="patona-sellercenter-sales-button-checkout"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-button>
		{/if}
	</div>
</div>

<style>
	.summary {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		/* Neither grows nor shrinks: the discount row, the totals and the two terminal
		   buttons are what a cashier must always be able to read and reach. The item
		   list above absorbs every spare pixel and gives them back when it needs to. */
		flex: 0 0 auto;
		min-height: 0;
		/* Pin the whole block — totals and the two terminal buttons — to the bottom of
		   the panel. Shortening the item list then opens a gap above the totals, not a
		   dead band under the pay button. */
		margin-top: auto;
	}
	/* Two equal buttons, one row — the whole discount block used to be ~106px here. */
	.quick-actions {
		display: flex;
		gap: 0.5rem;
		flex: 0 0 auto;
	}

	.quick-action {
		display: flex;
		flex: 1 1 0;
		align-items: center;
		min-width: 0;
		width: 100%;
		border: 1px dashed var(--ssk-colors-gray-300);
		border-radius: 8px;
		overflow: hidden;
	}

	.quick-action.has-value {
		align-items: stretch;
		width: 100%;
		border-color: transparent;
	}

	.quick-action:focus-within {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 2px;
	}

	.quick-action ssk-button {
		display: block;
		width: 100%;
	}

	/* The active discount/note chip — a card of its own, not the same ghost/solid
	   button the empty state uses: an icon badge + two-line title/subtitle reads as
	   "here's what's applied" at a glance, which a single button label ("ส่วนลด 10%")
	   couldn't say alongside the actual baht amount or the note text itself. */
	.chip-wrap {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.chip-active {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		padding: 0.5rem 1.75rem;
		background: var(--ssk-colors-primary-50, #fff4ef);
		border: 1px solid var(--ssk-colors-primary-100, #ffe4d6);
		border-radius: 8px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.chip-active:hover {
		background: var(--ssk-colors-primary-100, #ffe4d6);
	}

	.chip-active:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}

	.chip-icon {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		background: var(--ssk-colors-primary-500);
	}

	.chip-text {
		display: grid;
		row-gap: 0.0625rem;
		min-width: 0;
	}

	.chip-title {
		font-size: var(--ssk-font-size-sm);
		font-weight: 600;
		color: var(--ssk-colors-gray-900);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.chip-subtitle {
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	/* Sibling of .chip-active (not nested in it — same reason DeliveryGroupCards.svelte's
	   card-delete sits beside card-main, not inside it), overlapped onto the chip's own
	   top-right corner so clearing is its own tap target, separate from opening the
	   modal. */
	.chip-remove {
		position: absolute;
		top: 0.375rem;
		right: 0.375rem;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 999px;
		cursor: pointer;
	}

	.chip-remove:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.chip-remove:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}

	.modal-fields {
		display: grid;
		gap: 0.625rem;
		/* The DS modal centres its body slot, so a grid here sizes to max-content —
		   i.e. to the longest line of the hint. Fill the body instead, or the fields
		   end up ~210px wide inside a 368px modal. */
		width: 100%;
		box-sizing: border-box;
		padding: 0.25rem 0 0;
	}

	.remark-fields {
		gap: 0.875rem;
	}

	.remark-fields ssk-textarea {
		width: 100%;
		display: block;
	}

	.remark-quick-add {
		display: grid;
		gap: 0.5rem;
	}

	.remark-quick-add-label {
		font-size: var(--ssk-font-size-xs);
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--ssk-colors-gray-500);
	}

	.remark-quick-add-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.remark-chip {
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-700);
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 999px;
		padding: 0.375rem 0.75rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.remark-chip:hover {
		background: var(--ssk-colors-gray-50);
		border-color: var(--ssk-colors-gray-300);
	}

	/* The two footer slots sit side by side (Modal.svelte's own width-full wrappers) —
	   the left one holds just the plain text link, left-aligned in its own half; the
	   right one holds both ยกเลิก/บันทึกหมายเหตุ, grouped and pushed to its own right
	   edge, so the pair together reads as "far-left link, far-right action group"
	   instead of four quadrants. */
	.remark-footer-left {
		display: flex;
		align-items: center;
		height: 100%;
	}

	.remark-footer-right {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		width: 100%;
	}

	/* ยกเลิก + บันทึกหมายเหตุ are content-sized (no width="full"), unlike the main
	   .footer pair. At ~320px of remaining modal width on a phone the Thai label
	   "บันทึกหมายเหตุ" plus its icon can crowd "ยกเลิก" into wrapping onto two lines.
	   Stack them full-width instead so each keeps one line and a full-height tap
	   target. */
	@media (max-width: 480px) {
		.remark-footer-right {
			flex-direction: column-reverse;
		}

		.remark-footer-right ssk-button {
			width: 100%;
		}
	}

	.remark-apply {
		white-space: nowrap;
	}

	.remark-clear-link {
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		color: var(--ssk-colors-error-600, #dc2626);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.remark-clear-link:disabled {
		color: var(--ssk-colors-gray-300);
		cursor: not-allowed;
	}

	.modal-hint {
		display: grid;
		gap: 0.125rem;
	}

	/* Segmented ประเภท picker: two equal cells in a tray, the active one lifted. */
	/* Equal thirds so the three amounts read as one control, not three loose buttons. */
	.quick-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.375rem;
	}

	.quick-chip {
		min-height: 2.25rem;
		padding: 0 0.5rem;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		background: #fff;
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
		font-weight: 600;
		color: var(--ssk-colors-gray-700, #374151);
		cursor: pointer;
	}

	.quick-chip:hover {
		border-color: var(--ssk-colors-gray-300);
	}

	.quick-chip.active {
		border-color: var(--ssk-colors-primary-500);
		background: var(--ssk-colors-primary-50, #fdf0ea);
		color: var(--ssk-colors-primary-500);
	}

	.quick-chip:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}

	.code-label {
		font-family: inherit;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
	}

	/* The field takes the room; the button keeps its own width so its label never wraps. */
	.code-controls {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.code-controls ssk-input {
		flex: 1 1 auto;
		min-width: 0;
	}

	.code-controls ssk-button {
		flex: 0 0 auto;
	}

	.code-suggest-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.375rem;
	}

	.code-message {
		font-family: inherit;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-secondary-500, #d90005);
	}

	.code-message.ok {
		color: var(--ssk-colors-success-600, #16a34a);
	}

	/* The 3 ways to reach one discount — a tablist, not a 2-way toggle beside a code
	   row: picking one swaps the whole panel below (amount field vs. code field), which
	   reads as "a different section" rather than "a different unit on the same field". */
	/* ssk-tab-header is a custom element, so it defaults to display: inline — same fix
	   Cart.svelte's own .tabs rule already carries for its channel/shipping-method tabs. */
	.tabs {
		display: block;
		width: 100%;
	}

	.discount-tabs {
		margin-bottom: 0.625rem;
	}

	/* Wraps whichever tab's own fields are showing — see the markup comment on why this
	   carries a min-height. Grid + the same 0.625rem gap .modal-fields itself uses, since
	   this div now sits between those fields and .modal-fields instead of each being a
	   direct (and so directly gapped) child of it. */
	.discount-panel {
		display: grid;
		align-content: start;
		gap: 0.625rem;
		min-height: 14rem;
	}

	.tab-text {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.3rem;
	}

	.tab-text span {
		white-space: nowrap;
	}

	ssk-tab-button:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: -2px;
		border-radius: 8px;
	}

	.code-suggest {
		display: grid;
		gap: 0.375rem;
	}

	.code-suggest-label {
		font-family: inherit;
		font-size: var(--ssk-font-size-xs);
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--ssk-colors-gray-500);
	}

	.reason-block {
		display: grid;
		gap: 0.375rem;
	}

	.reason-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.reason-chip {
		font-family: inherit;
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-700);
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 999px;
		padding: 0.3125rem 0.625rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.reason-chip:hover:not(.active) {
		background: var(--ssk-colors-gray-50);
		border-color: var(--ssk-colors-gray-300);
	}

	.reason-chip.active {
		border-color: var(--ssk-colors-primary-500);
		background: var(--ssk-colors-primary-50, #fdf0ea);
		color: var(--ssk-colors-primary-500);
		font-weight: 600;
	}

	.discount-breakdown {
		display: grid;
		gap: 0.25rem;
		padding: 0.75rem;
		background: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		font-family: inherit;
	}

	.breakdown-row {
		display: flex;
		justify-content: space-between;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-600);
	}

	.breakdown-discount {
		color: var(--ssk-colors-success-600, #16a34a);
		padding-bottom: 0.25rem;
		border-bottom: 1px dashed var(--ssk-colors-gray-300);
	}

	.breakdown-total {
		font-weight: 700;
		color: var(--ssk-colors-gray-900);
	}

	.postfix-group {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.clear-value {
		display: inline-flex;
		align-items: center;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ssk-colors-gray-400);
		cursor: pointer;
	}

	.clear-value:hover {
		color: var(--ssk-colors-gray-600);
	}

	.unit {
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-gray-500);
		white-space: nowrap;
	}

	.footer {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		/* The last thing a cashier aims at never shrinks. */
		flex: 0 0 auto;
	}

	.discount-value {
		display: block;
		width: 100%;
	}

	/* Totals and the button row never shrink — they are the last thing a cashier may
	   lose sight of. */
	.detail {
		/* Money is never scrolled. This used to be `flex: 0 1 auto` with its own
		   overflow-y, so the block yielded first and clipped a row in half — half a
		   "ค่าจัดส่ง" line hiding behind the buttons above it, with no scrollbar wide
		   enough to notice. The item list is the one region that scrolls (see
		   .cart-item in Cart.svelte); everything below it now keeps its full height. */
		flex: 0 0 auto;
		overflow: visible;
		position: relative;
		background-color: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		color: var(--ssk-colors-gray-500);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.summary-collapse-toggle {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		background: none;
		border: 0;
		border-radius: 999px;
		cursor: pointer;
		color: var(--ssk-colors-gray-500);
	}

	.summary-collapse-toggle:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.summary-collapse-toggle:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}


	/* Collapsed state: the whole breakdown box becomes one tappable row — grand total
	   plus a hint for anything the breakdown would otherwise have surfaced. */
	.summary-collapsed {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		box-sizing: border-box;
		padding: 0.625rem 0.875rem;
		background-color: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		font-family: inherit;
		cursor: pointer;
		flex: 0 0 auto;
	}

	.summary-collapsed:hover {
		background-color: var(--ssk-colors-gray-100);
	}

	.summary-collapsed:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}

	.summary-collapsed-label {
		font-size: var(--ssk-font-size-sm);
		font-weight: 600;
		color: var(--ssk-colors-gray-700);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		min-width: 0;
	}

	/* Carries "N รายการ · ส่วนลด ..." now, not only the discount it was named for — kept
	   neutral gray rather than the old discount-green since an item count alone isn't a
	   positive/savings fact the way a discount amount is. */
	.summary-collapsed-discount {
		color: var(--ssk-colors-success-600, #16a34a);
		font-weight: 500;
	}

	.summary-collapsed-right {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex: 0 0 auto;
	}

	.summary-collapsed-total {
		font-size: 20px;
		font-weight: 700;
		color: var(--ssk-colors-primary-500, var(--ssk-colors-primary));
	}

	.summary-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		min-width: 0;
	}

	.summary-row:not(.summary-row-single) > :last-child {
		flex: 0 0 auto;
		text-align: right;
	}

	.summary-subtotal {
		color: var(--ssk-colors-gray-700);
		padding-right: 2rem;
	}

	.summary-secondary {
		color: var(--ssk-colors-gray-500);
	}

	.summary-grand-total {
		border-top: 1px solid var(--ssk-colors-gray-200);
		padding-top: 0.5rem;
	}

	.summary-row-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.right {
		text-align: right;
	}


	/* The 3-up quick-discount row and the 2-up ประเภท toggle stay the same column
	   count down to 480px — they're already equal fractional columns, so they just
	   get narrower rather than overflow — but the chip's own horizontal padding was
	   sized for the wider desktop cell and eats into the amount label once the cell
	   itself shrinks on a phone. Declared last so it wins over the earlier base
	   .quick-row/.quick-chip rules at equal specificity. */
	@media (max-width: 480px) {
		.quick-row {
			gap: 0.25rem;
		}

		.quick-chip {
			padding: 0 0.25rem;
		}
	}
</style>
