import { SlipPaymentState } from '$lib/entities/payment/payment-transaction';
import {
	FullfilmentType,
	PaymentState,
	PaymentType,
	SaleChannelType,
	Status
} from '$lib/entities/order/order';

const UNSPECIFIED_KEY = 'patona-sellercenter-myorder-table-body-unspecified';

// --------------------------------- payment --------------------------------

export const paymentMethodI18nKey = (method?: string): string => {
	switch (method) {
		case 'bankTransfer':
		case 'bankTransferOffline':
			return 'order.payment.type.bank_transfer';
		case 'cash':
			return 'order.payment.type.cash';
		case 'cod':
			return 'order.payment.type.cod';
		case 'creditCard':
			return 'order.payment.type.credit_card';
		case 'debitCard':
			return 'order.payment.type.debit_card';
		case 'sukipay':
			return 'order.payment.type.sukipay';
		default:
			return UNSPECIFIED_KEY;
	}
};

export const bankNameI18nKey = (bankCode?: string): string | null => {
	switch (bankCode) {
		case 'BBL':
			return 'payment.bank.name.bbl';
		case 'KBANK':
			return 'payment.bank.name.kbank';
		case 'SCB':
			return 'payment.bank.name.scb';
		case 'KTB':
			return 'payment.bank.name.ktb';
		case 'BAY':
			return 'payment.bank.name.bay';
		case 'TTB':
			return 'payment.bank.name.ttb';
		case 'GSB':
			return 'payment.bank.name.gsb';
		default:
			return null;
	}
};

export const slipStatusI18nKey = (state?: SlipPaymentState): string | null => {
	switch (state) {
		case SlipPaymentState.UNDER_REVIEW:
			return 'payment.status.under_review';
		case SlipPaymentState.COMPLETED:
			return 'payment.status.paid';
		case SlipPaymentState.REJECTED:
			return 'payment.status.rejected';
		// Compensation (order-cancel) payment states.
		case SlipPaymentState.VOIDED:
			return 'payment.status.voided';
		case SlipPaymentState.REFUND_PENDING:
			return 'payment.status.refund_pending';
		case SlipPaymentState.REFUNDED:
			return 'payment.status.refunded';
		case SlipPaymentState.REFUND_REJECTED:
			return 'payment.status.refund_rejected';
		default:
			return null;
	}
};

// `PaymentType` → key, "my orders" table wording (myorder-table-body family)
export const paymentTypeTableI18nKey = (t?: string): string => {
	switch (t) {
		case PaymentType.Cash:
			return 'patona-sellercenter-myorder-table-body-cash';
		case PaymentType.BankTransfer:
			return 'patona-sellercenter-myorder-table-body-bank';
		case PaymentType.CreditCard:
			return 'patona-sellercenter-myorder-table-body-credit';
		case PaymentType.DebitCard:
			return 'patona-sellercenter-myorder-table-body-debit';
		case PaymentType.Other:
			return 'patona-sellercenter-myorder-table-body-other';
		case PaymentType.Cod:
			return 'order.payment.type.cod';
		case PaymentType.SukiPay:
			return 'order.payment.type.multi_channel';
		case PaymentType.Unknown:
		default:
			return UNSPECIFIED_KEY;
	}
};

// `PaymentType` → key, order-detail wording (orderdetail-subtitle family)
export const paymentTypeDetailI18nKey = (t?: string): string => {
	switch (t) {
		case PaymentType.Cash:
			return 'patona-sellercenter-orderdetail-subtitle-cash';
		case PaymentType.BankTransfer:
			return 'patona-sellercenter-orderdetail-subtitle-bank';
		case PaymentType.CreditCard:
			return 'patona-sellercenter-orderdetail-subtitle-credit';
		case PaymentType.DebitCard:
			return 'patona-sellercenter-orderdetail-subtitle-debit';
		case PaymentType.Cod:
			return 'order.payment.type.cod';
		case PaymentType.SukiPay:
			return 'order.payment.type.multi_channel';
		case PaymentType.Other:
			return 'patona-sellercenter-orderdetail-subtitle-other';
		default:
			return UNSPECIFIED_KEY;
	}
};

export const paymentTaskStatusI18nKey = (status?: string, state?: string): string => {
	switch (status) {
		case Status.Completed:
			return 'patona-sellercenter-badge-paymentstatus-paid';
		case Status.Canceled:
			// Terminal cancel: money already returned → refunded; otherwise the payment
			// was voided (canceled before it was ever collected) — NOT "waiting for payment".
			return state === PaymentState.Refunded
				? 'patona-sellercenter-badge-paymentstatus-refunded'
				: 'payment.status.voided';
		case Status.PartialCompleted:
			return 'payment.status.partially_paid';
		case Status.Pending:
			return 'patona-sellercenter-badge-paymentstatus-waitingforpayment';
		case Status.Processing:
			return 'payment.status.under_review';
		case Status.Refunding:
			return 'patona-sellercenter-badge-orderstatus-refunding';
		default:
			return UNSPECIFIED_KEY;
	}
};

// ---------------------------------- order ---------------------------------

export function orderStatusI18nKey(oStatus?: string): string {
	switch (oStatus) {
		case Status.Pending:
		case Status.Processing:
			return 'patona-sellercenter-badge-orderstatus-inprogress';
		// refunded/voided are terminal reversal outcomes (main's flows) — shown as the
		// canceled order badge (guaranteed-seeded key); the refund/void detail lives in
		// the CancellationRefund section, not the order-status badge.
		case Status.Canceled:
		case Status.Refunded:
		case Status.Voided:
			return 'patona-sellercenter-badge-orderstatus-canceled';
		case Status.Completed:
			return 'patona-sellercenter-badge-orderstatus-complete';
		case Status.PartialCompleted:
			return 'payment.status.partially_paid';
		case Status.Refunding:
			return 'patona-sellercenter-badge-orderstatus-refunding';
		default:
			return UNSPECIFIED_KEY;
	}
}

export const orderTaskNameI18nKey = (taskName?: string): string => {
	switch (taskName) {
		case 'payments':
			return 'patona-sellercenter-orderdetail-title-payment';
		case 'delivery':
			return 'patona-sellercenter-orderdetail-title-delivery';
		case 'refund':
			return 'patona-sellercenter-orderdetail-title-refund';
		default:
			return 'order.task.sale_order';
	}
};

export const orderChannelI18nKey = (channel?: string): string => {
	switch (channel) {
		case 'offline':
			return 'order.channel.offline_store';
		default:
			return 'order.channel.others';
	}
};

const fullfilmentTypeI18nKeys: Record<FullfilmentType, string> = {
	[FullfilmentType.PickupImmediate]: 'order.delivery.pickup_immediate',
	[FullfilmentType.PickupLater]: 'order.delivery.pickup_later',
	[FullfilmentType.ShopDelivery]: 'order.delivery.shop_delivery'
};

export const orderDeliveryI18nKey = (dType?: string): string | null => {
	return fullfilmentTypeI18nKeys[dType as FullfilmentType] ?? null;
};

export const orderSaleTypeI18nKey = (type?: string): string => {
	switch (type) {
		case SaleChannelType.Offline:
			return 'order.sale_type.offline';
		case SaleChannelType.Online:
			return 'order.sale_type.online';
		default:
			return UNSPECIFIED_KEY;
	}
};

export const deliveryTaskStatusI18nKey = (status?: string): string => {
	switch (status) {
		case Status.Completed:
			return 'patona-sellercenter-orderdetail-badge-deliverystatus-pickedup';
		case Status.Canceled:
			return 'patona-sellercenter-orderdetail-badge-deliverystatus-canceled';
		default:
			return 'patona-sellercenter-orderdetail-badge-deliverystatus-waitingforpickup';
	}
};
