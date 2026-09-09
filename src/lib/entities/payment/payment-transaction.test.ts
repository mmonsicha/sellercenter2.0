import { describe, it, expect } from 'vitest';
import {
	SlipPaymentState,
	isForwardPayment,
	isRefundPayment,
	type PaymentItem
} from './payment-transaction';
import { PaymentMethod } from './payment-method';

const p = (state: SlipPaymentState, method = PaymentMethod.CASH): PaymentItem => ({
	paymentId: 'x',
	paymentState: state,
	method,
	amount: 100
});

// The Evidence vs Cancellation & Refund split is mutually exclusive and driven purely by
// payment_state: isForwardPayment → Payment Evidence, isRefundPayment → refund section.
describe('payment classification predicates', () => {
	it('isForwardPayment: true for received/under-review/rejected (belongs in Payment Evidence)', () => {
		expect(isForwardPayment(p(SlipPaymentState.COMPLETED))).toBe(true);
		expect(isForwardPayment(p(SlipPaymentState.UNDER_REVIEW))).toBe(true);
		expect(isForwardPayment(p(SlipPaymentState.REJECTED))).toBe(true);
	});

	it('isRefundPayment: true for the void/refund states (drives the Cancellation & Refund section)', () => {
		expect(isRefundPayment(p(SlipPaymentState.VOIDED))).toBe(true);
		expect(isRefundPayment(p(SlipPaymentState.REFUND_PENDING))).toBe(true);
		expect(isRefundPayment(p(SlipPaymentState.REFUNDED))).toBe(true);
		expect(isRefundPayment(p(SlipPaymentState.REFUND_REJECTED))).toBe(true);
		expect(isRefundPayment(p(SlipPaymentState.COMPLETED))).toBe(false);
	});

	it('PAT-2038 (PO decision): once cash is VOIDED it leaves Payment Evidence and shows only in refund', () => {
		const voidedCash = p(SlipPaymentState.VOIDED, PaymentMethod.CASH);
		expect(isForwardPayment(voidedCash)).toBe(false); // NOT in Payment Evidence
		expect(isRefundPayment(voidedCash)).toBe(true); // only in Cancellation & Refund
	});
});
