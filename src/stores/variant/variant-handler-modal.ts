import { writable } from 'svelte/store';

// modal variant handler
export const showAddVariantModal = writable<boolean>(false);
export const showEditVariantModal = writable<boolean>(false);
export const isUpdate = writable<boolean>(false);

export function setIsUpdate(v: boolean) {
	isUpdate.set(v);
}

export function toggleAddVariantModal(s: boolean) {
	showAddVariantModal.set(!s);
}
export function toggleEditVariantModal(s: boolean) {
	showEditVariantModal.set(!s);
}
