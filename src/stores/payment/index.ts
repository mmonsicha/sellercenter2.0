import type { Payment } from '$lib/entities/sale/sale';
import { writable } from 'svelte/store';
import { storeUpdatePaymentAmount, storeUpdateTaskInfo } from '../../service/management-rest';
import type { Order } from '$lib/entities/order/order';

export const mappingTabsTitle = [
	'patona-sellercenter-modal-payment-tab-cash',
	'patona-sellercenter-modal-payment-tab-bank',
	'patona-sellercenter-modal-payment-tab-card',
	'patona-sellercenter-modal-payment-tab-other'
];

export const showPaymentModal = writable<boolean>(false);
export const paymentInfo = writable<Payment>({
	type: 'cash',
	total: 0,
	received: undefined,
	change: 0,
	ref: '',
	note: ''
});

export function updatePayment(updatedPayment: Partial<Payment>) {
	paymentInfo.update((info) => {
		const newInfo = {
			...info,
			...updatedPayment
		};

		if ('received' in updatedPayment) {
			if ((newInfo.received ?? 0) < newInfo.total) {
				newInfo.change = 0;
			} else {
				newInfo.change = (newInfo.received ?? 0) - newInfo.total;
			}
		}

		return newInfo;
	});
}

export function togglePaymentModal(s: boolean) {
	showPaymentModal.set(!s);
}
export function clearPayment() {
	paymentInfo.set({
		type: '',
		total: 0,
		received: 0,
		change: 0,
		ref: '',
		note: ''
	});
}

export const makeAttributesPayment = (p: Payment): string => {
	const formattedAttributes = {
		payment_ref: p.ref || '',
		payment_note: p.note || '',
		payment_type: p.type || ''
	};
	return JSON.stringify(formattedAttributes);
};

export async function updateTaskInfoAndPaymentAmount(
	sId: string,
	oId: string,
	attributes: string,
	order: Order,
	paymentStatus?: string,
	deliveryStatus?: string
) {
	const payment = order.tasks?.find((task) => task.name === 'payments');
	const delivery = order.tasks?.find((task) => task.name === 'delivery');

	if (payment?.taskId) {
		await storeUpdateTaskInfo(sId, oId, payment.taskId, attributes, paymentStatus ?? '');
	}

	if (delivery?.taskId && deliveryStatus) {
		await storeUpdateTaskInfo(sId, oId, delivery.taskId, '', deliveryStatus);
	}
	await storeUpdatePaymentAmount(sId, oId, order);
}
