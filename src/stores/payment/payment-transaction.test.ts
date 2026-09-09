import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('../../service/management-rest', () => ({
	submitAndApproveOrderPayment: vi.fn(),
	storeGetOrder: vi.fn(),
	createOrderPaymentTransaction: vi.fn(),
	submitOrderPayment: vi.fn(),
	cancelOrderPaymentTransaction: vi.fn(),
	listPaymentChannels: vi.fn()
}));
vi.mock('$utils/slip-upload', () => ({ cleanupUploadedSlipFiles: vi.fn() }));

import { submitAndApproveOrderPayment, storeGetOrder } from '../../service/management-rest';
import { cleanupUploadedSlipFiles } from '$utils/slip-upload';
import {
	classifySubmitApproveSettlement,
	PaymentModalStatus,
	paymentModal,
	submitAndApprovePayment
} from './payment-transaction';
import { SlipPaymentState, type PaymentTransaction } from '$lib/entities/payment/payment-transaction';

const txn = (
	paymentId: string,
	state: SlipPaymentState,
	paid: number,
	amount: number
): PaymentTransaction => ({
	amount,
	paidAmount: paid,
	payments: [{ paymentId, paymentState: state, amount }]
});

describe('classifySubmitApproveSettlement', () => {
	it('keeps polling (undefined) when the payment has not landed on the order yet', () => {
		expect(
			classifySubmitApproveSettlement({
				txn: { amount: 100, paidAmount: 0, payments: [] },
				paymentId: 'p1',
				expectedApproved: true
			})
		).toBeUndefined();
	});

	it('COMPLETED + fully paid -> Success', () => {
		expect(
			classifySubmitApproveSettlement({ txn: txn('p1', SlipPaymentState.COMPLETED, 100, 100), paymentId: 'p1', expectedApproved: true })
		).toBe(PaymentModalStatus.Success);
	});

	it('COMPLETED + underpaid -> Partial', () => {
		expect(
			classifySubmitApproveSettlement({ txn: txn('p1', SlipPaymentState.COMPLETED, 50, 100), paymentId: 'p1', expectedApproved: true })
		).toBe(PaymentModalStatus.Partial);
	});

	it('UNDER_REVIEW while approve expected to succeed -> keep polling (Kafka lag)', () => {
		expect(
			classifySubmitApproveSettlement({ txn: txn('p1', SlipPaymentState.UNDER_REVIEW, 0, 100), paymentId: 'p1', expectedApproved: true })
		).toBeUndefined();
	});

	it('UNDER_REVIEW when approve failed (approved:false) -> Pending', () => {
		expect(
			classifySubmitApproveSettlement({ txn: txn('p1', SlipPaymentState.UNDER_REVIEW, 0, 100), paymentId: 'p1', expectedApproved: false })
		).toBe(PaymentModalStatus.Pending);
	});

	it('REJECTED -> Failed', () => {
		expect(
			classifySubmitApproveSettlement({ txn: txn('p1', SlipPaymentState.REJECTED, 0, 100), paymentId: 'p1', expectedApproved: true })
		).toBe(PaymentModalStatus.Failed);
	});
});

const baseReq = {
	payment_method: 'bankTransfer',
	payment_provider: 'sukipay',
	payment_amount: 100,
	currency: 'THB'
} as any;

describe('submitAndApprovePayment (synchronous branches)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		paymentModal.update((s) => ({ ...s, status: PaymentModalStatus.Idle, show: true }));
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('approve fails upstream (approved:false) -> Pending, no polling', async () => {
		(submitAndApproveOrderPayment as any).mockResolvedValue({
			approved: false,
			payment_id: 'p1',
			payment_state: 'UNDER_REVIEW'
		});
		await submitAndApprovePayment({ storeId: 's', orderId: 'o', submitRequest: baseReq });
		expect(get(paymentModal).status).toBe(PaymentModalStatus.Pending);
		expect(storeGetOrder).not.toHaveBeenCalled();
	});

	it('submit throws -> Failed and uploaded slip is cleaned up', async () => {
		(submitAndApproveOrderPayment as any).mockRejectedValue(new Error('boom'));
		const slip = { fullImageUrl: 'a', thumbnailUrl: 'b' } as any;
		await submitAndApprovePayment({ storeId: 's', orderId: 'o', submitRequest: baseReq, slipCleanup: slip });
		expect(get(paymentModal).status).toBe(PaymentModalStatus.Failed);
		expect(cleanupUploadedSlipFiles).toHaveBeenCalledWith(slip);
	});
});
