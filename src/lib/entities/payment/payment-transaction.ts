export enum PaymentTxnState {
	PENDING = 'PENDING',
	CLOSED = 'CLOSED',
	CANCELLED = 'CANCELLED',
	EXPIRED = 'EXPIRED',
	COMPENSATING = 'COMPENSATING',
	COMPENSATED = 'COMPENSATED'
}

export enum SlipPaymentState {
	UNDER_REVIEW = 'UNDER_REVIEW',
	COMPLETED = 'COMPLETED',
	REJECTED = 'REJECTED',
	// Compensation (order-cancel) payment states
	VOIDED = 'VOIDED',
	REFUND_PENDING = 'REFUND_PENDING',
	REFUNDED = 'REFUNDED',
	REFUND_REJECTED = 'REFUND_REJECTED'
}

export enum RejectReason {
	WRONG_AMOUNT = 'WRONG_AMOUNT',
	WRONG_ACCOUNT = 'WRONG_ACCOUNT',
	DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
	SLIP_UNREADABLE = 'SLIP_UNREADABLE',
	SLIP_FRAUDULENT = 'SLIP_FRAUDULENT',
	OTHER = 'OTHER'
}

export interface PaymentOperator {
	id?: string;
	name?: string;
	roles?: string[];
	type?: string;
}

export interface ReceivingAccount {
	accountName?: string;
	accountNumber?: string;
}

export interface PaymentItem {
	paymentId?: string;
	paymentState?: SlipPaymentState;
	amount?: number;
	method?: string;
	bankCode?: string;
	slipId?: string;
	fullImageUrl?: string;
	thumbnailUrl?: string;
	transferAt?: string;
	paymentChannelId?: number;
	receivingAccount?: ReceivingAccount;
	eventType?: string;
	createdAt?: string;
	paymentStateChangedAt?: string;
	operator?: PaymentOperator;
	rejectReason?: RejectReason;
	rejectNote?: string;
	/** optimistic-lock counter from sukipay; round-tripped on edit */
	version?: number;
}

export interface PaymentTransaction {
	transactionId?: string;
	transactionState?: PaymentTxnState;
	amount?: number;
	paidAmount?: number;
	createdAt?: string;
	payments: PaymentItem[];
	// Transaction-level state-change context (who changed the state & why + free-text note),
	// stamped by OMS at the payments-task top level. Replaces the old per-row compensation_*
	// fields (renamed: compensation_reason→reason, compensated_by(_name)→state_changed_by(_name)).
	reason?: string;
	note?: string;
	stateChangedBy?: string;
	stateChangedByName?: string;
}

/** payment_state values that represent a refund/void leg (the post-cancel compensation history) */
export const REFUND_PAYMENT_STATES: SlipPaymentState[] = [
	SlipPaymentState.VOIDED,
	SlipPaymentState.REFUND_PENDING,
	SlipPaymentState.REFUNDED,
	SlipPaymentState.REFUND_REJECTED
];
/** true for a void/refund row (belongs in the Cancellation & Refund section) */
export const isRefundPayment = (p: PaymentItem): boolean =>
	!!p.paymentState && REFUND_PAYMENT_STATES.includes(p.paymentState);
/** true for a normal forward payment (belongs in Payment Evidence) */
export const isForwardPayment = (p: PaymentItem): boolean => !isRefundPayment(p);
