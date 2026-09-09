import { writable } from 'svelte/store';
import type { Order } from '$lib/entities/order/order';

export interface DeliverModalState {
	order: Order | null;
}

const initial: DeliverModalState = { order: null };

export const deliverModalStore = writable<DeliverModalState>(initial);

/** Open the deliver-confirmation modal for `order` (from the order table or detail page). */
export function openDeliverModal(order: Order) {
	deliverModalStore.set({ order });
}

export function closeDeliverModal() {
	deliverModalStore.set(initial);
}
