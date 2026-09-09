/**
 * Sukipay payment methods — the method used WITHIN a Sukipay transaction.
 *
 * This is DISTINCT from the legacy `PaymentType` (cash/bankTransfer) in `payment.ts`,
 * which is the order's `payment_type` field. In Sukipay mode the order's
 * `payment_type` is `"sukipay"` (the provider), and the actual method is one of these.
 *
 * Canonical values mirror OMS backend `sukipay_event.go`:
 *   PaymentMethodCash / BankTransfer / BankTransferOffline / CreditCard / QRCode
 * (proto: "cash" | "bankTransfer" | "bankTransferOffline" | "creditCard" | "qrCode")
 */
export enum PaymentMethod {
	CASH = 'cash',
	BANK_TRANSFER = 'bankTransfer',
	BANK_TRANSFER_OFFLINE = 'bankTransferOffline',
	CREDIT_CARD = 'creditCard',
	QR_CODE = 'qrCode'
}

/**
 * Payment provider — the gateway/processor that handles the transaction
 * (the order's `payment_provider` field). Offline POS uses `Sukipay`.
 */
export enum PaymentProvider {
	SUKIPAY = 'sukipay',
	UNKNOWN = 'unknown'
}

/** i18n keyword per method — single source for tab labels (resolved via i18n store). */
export const PAYMENT_METHOD_LABEL_KEYS: Record<PaymentMethod, string> = {
	[PaymentMethod.CASH]: 'payment.method.cash',
	[PaymentMethod.BANK_TRANSFER]: 'payment.method.bank_transfer',
	[PaymentMethod.BANK_TRANSFER_OFFLINE]: 'payment.method.bank_transfer',
	[PaymentMethod.CREDIT_CARD]: 'patona-sellercenter-modal-payment-tab-card-radio-credit',
	[PaymentMethod.QR_CODE]: 'patona-sellercenter-modal-payment-tab-other'
};

/**
 * Available payment methods per sale context.
 * Online vs offline can offer different sets — the caller picks the right list
 * when opening the payment modal. Adjust as the supported set evolves.
 */
export const OFFLINE_PAYMENT_METHODS: PaymentMethod[] = [
	PaymentMethod.CASH,
	PaymentMethod.BANK_TRANSFER_OFFLINE
];

export const ONLINE_PAYMENT_METHODS: PaymentMethod[] = [PaymentMethod.BANK_TRANSFER];
