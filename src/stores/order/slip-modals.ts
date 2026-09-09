import { writable } from 'svelte/store';
import type { Order } from '$lib/entities/order/order';
import type { PaymentItem } from '$lib/entities/payment/payment-transaction';

export enum SlipModalType {
	SlipReview = 'slip-review',
	RejectPayment = 'reject-payment',
	ApprovePaymentConfirm = 'approve-payment-confirm',
	EditPayment = 'edit-payment'
}

export enum SlipModalMode {
	Review = 'review',
	View = 'view'
}

export interface SlipModalState {
	active: SlipModalType | null;
	order: Order | null;
	payment: PaymentItem | null;
	mode: SlipModalMode;
}

const initial: SlipModalState = {
	active: null,
	order: null,
	payment: null,
	mode: SlipModalMode.Review
};

export const slipModalStore = writable<SlipModalState>(initial);

export function openSlipModal(
	type: SlipModalType,
	ctx: { order: Order; payment?: PaymentItem | null; mode?: SlipModalMode }
) {
	slipModalStore.set({
		active: type,
		order: ctx.order,
		payment: ctx.payment ?? null,
		mode: ctx.mode ?? SlipModalMode.Review
	});
}

export function closeSlipModal() {
	slipModalStore.set(initial);
}
