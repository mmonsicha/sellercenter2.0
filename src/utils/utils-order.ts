import {
	OrderFlow,
	PaymentType,
	OrderTaskName,
	Status,
	type Order,
	type Task,
	ShippingType,
	sameDayDeliveries,
	standardDeliveries,
	paymentMethods,
	type DeliveryOption
} from '$lib/entities/order/order';
import { PaymentMode } from '$lib/entities/configuration/configuration';
import { SlipPaymentState } from '$lib/entities/payment/payment-transaction';
import {
	deliveryTaskStatusI18nKey,
	paymentTaskStatusI18nKey,
	paymentTypeTableI18nKey
} from '$utils/i18n-keys';

type TasksType = 'payments' | 'delivery';

export function mapOrderPayment(tasks?: Task[], paymentType?: string) {
	const paymentTask = tasks?.find((task) => task.name === 'payments');
	const status = paymentDisplayStatus(paymentTask);

	return {
		status,
		label: paymentTaskStatusI18nKey(status, paymentTask?.state),
		type: paymentTypeTableI18nKey(paymentType)
	};
}

// paymentDisplayStatus adjusts the OMS-projected task status for display.
//
// OMS derives the payments task status from the money position, so rejecting one
// of several concurrent slips can leave a shortfall and project `partial_completed`
// while another slip is still UNDER_REVIEW — inconsistent with approving a slip,
// which keeps the order `under_review` (PAT-2295). A slip awaiting review is not
// settled money, so while any slip is under review we surface `under_review` until
// every slip is resolved. Terminal `completed`/`canceled` are never overridden.
const paymentDisplayStatus = (task?: Task): string => {
	const status = task?.status ?? '';
	if (status === Status.Completed || status === Status.Canceled) {
		return status;
	}
	return hasSlipUnderReview(task) ? Status.Processing : status;
};

// orderDisplayStatus adjusts the OMS parent order status for the badge.
// OMS derives it from non-rejected coverage (UNDER_REVIEW counts), so once
// approved + under_review reaches the order total it flips to `processing` even
// though only part is actually approved. The badge must reflect CONFIRMED money:
//   0 < approved < total → partially_paid  (regardless of how much is under review)
//   approved == 0 & a slip under review → processing (nothing confirmed yet)
//   otherwise → the OMS status (pending, or approved-covers-total awaiting close)
// Terminal completed/canceled pass through unchanged.
export const orderDisplayStatus = (order: Order): string => {
	const status = order.status ?? '';
	// Terminal statuses pass through unchanged — no coverage math. `refunded`/`voided`
	// are terminal reversal outcomes (main's flows), grouped with completed/canceled.
	if (
		status === Status.Completed ||
		status === Status.Canceled ||
		status === Status.Refunded ||
		status === Status.Voided
	) {
		return status;
	}
	const paymentTask = order.tasks?.find((t) => t.name === OrderTaskName.Payments);
	const approved = completedPaidAmount(paymentTask);
	// Compare against the NET amount owed (after discounts/adjustments), not the
	// gross line-item total. A 50%-off order owes net_price 64 on a total_Price 128;
	// approving all 64 must read `processing`, not `partially_paid`.
	const total = order.buyerStatement?.netPrice ?? 0;
	if (approved > 0 && (total <= 0 || approved < total)) {
		return Status.PartialCompleted;
	}
	if (approved <= 0 && hasSlipUnderReview(paymentTask)) {
		return Status.Processing;
	}
	return status;
};

const hasSlipUnderReview = (task?: Task): boolean => hasSlipInState(task, SlipPaymentState.UNDER_REVIEW);

const hasSlipInState = (task: Task | undefined, state: SlipPaymentState): boolean => {
	const payments = paymentTaskAttributes(task).payments;
	return Array.isArray(payments) && payments.some((p) => p?.payment_state === state);
};

// completedPaidAmount sums only approved (COMPLETED) slips — money actually
// confirmed in. UNDER_REVIEW and REJECTED slips do not count.
const completedPaidAmount = (task?: Task): number => {
	const payments = paymentTaskAttributes(task).payments;
	if (!Array.isArray(payments)) return 0;
	return payments.reduce(
		(sum, p) =>
			p?.payment_state === SlipPaymentState.COMPLETED ? sum + (Number(p?.amount) || 0) : sum,
		0
	);
};

// task.attributes is raw OMS JSON — either an object or a JSON string.
// Mirrors toPaymentTransaction's handling in payment-adapter.ts.
const paymentTaskAttributes = (task?: Task): Record<string, any> => {
	const raw = task?.attributes;
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw) ?? {};
		} catch {
			return {};
		}
	}
	return raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
};

export const getBadgeOrderStatus = (status?: string): string => {
	switch (status) {
		case Status.Completed:
			return 'success';
		// refunded/voided are terminal reversal outcomes — neutral like canceled
		case Status.Canceled:
		case Status.Refunded:
		case Status.Voided:
			return 'gray';
		case Status.Refunding:
			return 'warning';
		default:
			return 'sky';
	}
};

export const getBadgeThemeFromTaskStatus = (status?: string) => {
	switch (status) {
		case Status.Completed:
			return 'success';
		case Status.Canceled:
			return 'gray';
		case Status.Refunding:
			return 'warning';
		default:
			return 'warning';
	}
};

export const slipStatusTheme = (state?: SlipPaymentState): string => {
	switch (state) {
		case SlipPaymentState.UNDER_REVIEW:
			return 'warning';
		case SlipPaymentState.COMPLETED:
			return 'success';
		case SlipPaymentState.REJECTED:
			return 'error';
		// Compensation (order-cancel) payment states.
		case SlipPaymentState.VOIDED:
			return 'gray';
		case SlipPaymentState.REFUND_PENDING:
			return 'warning';
		case SlipPaymentState.REFUNDED:
			return 'success';
		case SlipPaymentState.REFUND_REJECTED:
			return 'error';
		default:
			// unknown/undefined state shows the neutral '-' label — badge matches (gray, not pending-yellow)
			return 'gray';
	}
};

export const mapOrderTaskIcon = (taskName?: string): string => {
	switch (taskName) {
		case 'payments':
			return 'outline-banknotes';
		case 'delivery':
			return 'outline-hand-coins';
		case 'refund':
			return 'outline-banknotes';
		default:
			return '';
	}
};

export const mapTaskStatus = (task: Task): string => {
	const mapper = {
		payments: (s?: string) => paymentTaskStatusI18nKey(s, task.state),
		delivery: (s?: string) => deliveryTaskStatusI18nKey(s),
		refund: (s?: string) => paymentTaskStatusI18nKey(s, task.state)
	};

	if (task.name && task.name in mapper) {
		return mapper[task.name as TasksType](task.status);
	}

	return task.status ?? '';
};

// Sums every delivery's fee, instead of reading only deliveries[0] — the backend has no
// per-group Delivery yet (see delivery-group.ts's own comment on this), but
// MULTI-DESTINATION-REWORK.md §3 asks every read path to tolerate `deliveries[]` growing
// past 1 BEFORE that lands, so a row total does not silently drop real fees the moment
// it does. With 0 or 1 delivery this is byte-identical to the old `deliveries?.[0]`.
export const totalShippingFee = (order: Order): number =>
	order.deliveries?.reduce((sum, d) => sum + (d.shippingFee ?? 0), 0) ?? 0;

export function getDeliveryMethod(order: Order) {
	const deliveryType = order.deliveries?.[0]?.type;
	let deliveryMethod = order.deliveries?.[0]?.method;
	const isOrderFromMarketplace =
		order.saleChannel?.saleOrigin && marketplaceValues.includes(order.saleChannel.saleOrigin);

	let deliveryOptions: DeliveryOption[] = [];
	if (isOrderFromMarketplace || deliveryType === ShippingType.Standard) {
		deliveryOptions = standardDeliveries;
		if (isOrderFromMarketplace) {
			deliveryMethod = order.saleChannel?.saleOrigin;
		}
	} else if (deliveryType === ShippingType.SameDay) {
		deliveryOptions = sameDayDeliveries;
	}

	const found = deliveryOptions.find((d) => d.value === deliveryMethod);

	if (found?.label && typeof found.label === 'string') {
		const cleanLabel = found.label.replace(/<br\s*\/?>/gi, ' ');
		return { ...found, label: cleanLabel, type: deliveryType };
	}

	return found;
}

// What an order-list row should PRINT for its delivery column. Deliberately separate
// from getDeliveryMethod: that one answers "which courier option is this order set to",
// and its result is fed straight into DrawerChannel as the selected option — so it must
// keep returning a real option a cashier could have picked, never a synthetic one. An
// order with several parcels has no single courier to name, so only the label changes.
export const deliveryMethodLabel = (order: Order): string => {
	const count = order.deliveries?.length ?? 0;
	if (count > 1) return `${count} พัสดุ`;

	return getDeliveryMethod(order)?.label ?? '-';
};

export const marketplaceValues = ['shopee', 'lazada', 'tiktok', 'lineShopping'];

export enum OrderRowActionKind {
	View = 'view',
	Pay = 'pay',
	PayMore = 'pay-more',
	Deliver = 'deliver'
}

export interface OrderRowAction {
	labelKey: string;
	variant: 'solid' | 'outline' | 'ghost';
	kind: OrderRowActionKind;
}
// Statuses with no cashier action — terminal orders plus the refund family
// (refunding/refunded/voided, owned by PAT-2038). These fall through to View.
const NON_ACTIONABLE_STATUSES = new Set<string>([
	Status.Completed,
	Status.Canceled,
	Status.Refunding,
	Status.Refunded,
	Status.Voided
]);

export function getOrderRowAction(order: Order): OrderRowAction {
	if (order.status && NON_ACTIONABLE_STATUSES.has(order.status)) {
		return { labelKey: 'order.row_action.view', variant: 'outline', kind: OrderRowActionKind.View };
	}

	const paymentTask = order.tasks?.find((t) => t.name === OrderTaskName.Payments);

	// The action follows the money position OMS projects into the payments task —
	// non-rejected coverage (UNDER_REVIEW + COMPLETED) vs total. A submitted slip
	// counts as money in even while under review, so a fully-covered order offers
	// no pay button (nothing to collect) and a partial one offers ชำระเพิ่ม:
	//   pending           = nothing submitted → collect (Pay)
	//   partial_completed = buyer still owes → collect the rest (PayMore)
	//   completed         = fully paid → Deliver
	//   processing (fully covered, a slip awaiting review) → nothing to collect → View
	switch (paymentTask?.status) {
		case Status.Completed:
			return {
				labelKey: 'patona-sellercenter-orderdetail-button-deliver',
				variant: 'outline',
				kind: OrderRowActionKind.Deliver
			};
		case Status.PartialCompleted:
			return {
				labelKey: 'order.payment.pay_more_btn',
				variant: 'outline',
				kind: OrderRowActionKind.PayMore
			};
		case Status.Pending:
			return {
				labelKey: 'patona-sellercenter-orderdetail-button-checkout',
				variant: 'outline',
				kind: OrderRowActionKind.Pay
			};
		default:
			return {
				labelKey: 'order.row_action.view',
				variant: 'outline',
				kind: OrderRowActionKind.View
			};
	}
}

export function mapOrderStateForPaymentCompleteByFlow(flow: string): string {
	switch (flow) {
		case OrderFlow.POS_OFFLINE_DELIVERY_LATER:
			return 'paid:waiting_delivery';
		case OrderFlow.POS_OFFLINE:
			return 'paid:pickedup_at_store';
		case OrderFlow.POS_ONLINE:
		case OrderFlow.POS_ONLINE_SUKIPAY_V1:
			return 'paid:not_deliver';
		default:
			return '';
	}
}

export function mapOrderStateForDeliveryCompleteByFlow(flow: string): string {
	switch (flow) {
		case OrderFlow.POS_OFFLINE_DELIVERY_LATER:
		case OrderFlow.POS_OFFLINE:
			return 'paid:pickedup_at_store';
		case OrderFlow.POS_ONLINE:
		case OrderFlow.POS_ONLINE_SUKIPAY_V1:
			return 'paid:shipped';
		// Offline SukiPay deliver-from-store: graph edge paid:not_delivered -> paid:delivered.
		case OrderFlow.POS_OFFLINE_SUKIPAY_DELIVER_FROM_STORE_V1:
			return 'paid:delivered';
		// Offline SukiPay pickup: "ส่งมอบ" = hand goods to customer (pickup complete).
		// The two pickup flows use DIFFERENT terminal strings — instant pickups at the
		// counter (paid:not_pickedup -> paid:pickedup_at_store) vs. later pickup
		// (paid:not_pickedup -> paid:pickedup). Do not collapse these two cases.
		case OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_INSTANT_V1:
			return 'paid:pickedup_at_store';
		case OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_LATER_V1:
			return 'paid:pickedup';
		default:
			return '';
	}
}

/**
 * Online create: use SukiPay ONLY when the company runs in SukiPay mode AND the
 * chosen payment method is bank transfer. Any other method (COD / unspecified /
 * marketplace) falls back to the legacy POS_ONLINE flow with no payment modal.
 */
export function shouldUseSukipayOnline(
	paymentMode: string | undefined,
	paymentType: string | undefined
): boolean {
	return paymentMode === PaymentMode.Sukipay && paymentType === PaymentType.BankTransfer;
}

export function findPaymentLabelBySaleOrigin(saleOrigin?: string): string {
	if (!saleOrigin) return '-';
	const found = paymentMethods.find((p) => p.value === saleOrigin);
	if (!found) return '-';
	return found.label.replace(/<br\s*\/?>/gi, ' ');
}
