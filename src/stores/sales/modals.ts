import { get, writable } from 'svelte/store';

type ModalType =
	| 'payment-success'
	| 'settings-printer'
	| 'simplified-payment-success'
	| 'simplified-payment-success-with-printer-detail'
	| null;

export const activeModal = writable<ModalType>(null);

export const openModal = (modalName: ModalType) => {
	activeModal.set(modalName);
};

export const closeModal = () => {
	activeModal.set(null);
};

export const toggleActiveModal = (modalName: ModalType) => {
	const currentModal = get(activeModal);

	if (currentModal === modalName) {
		closeModal();
	} else {
		openModal(modalName);
	}
};
