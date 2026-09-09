import { get, writable } from 'svelte/store';

export const DEFAULT_SLOT_name = 'default';

export const unsavedChanges = writable<Record<string, boolean>>({});

export const unsavedAction = writable<Record<string, (() => void) | null>>({});
export const cancelAction = writable<Record<string, (() => void) | null>>({});

export function setUnsavedChanges(value: boolean, slot: string = DEFAULT_SLOT_name) {
	unsavedChanges.set({ ...get(unsavedChanges), [slot]: value });
}

export function setAction(action: () => void, slot: string = DEFAULT_SLOT_name) {
	if (!get(unsavedChanges)[slot]) {
		try {
			action();
		} catch (error) {
			console.error(error);
		}
	} else {
		unsavedAction.set({ ...get(unsavedAction), [slot]: action });
	}
}

export function setCancelAction(cAction: () => void, slot: string = DEFAULT_SLOT_name) {
	if (!get(unsavedChanges)[slot]) {
		try {
			cAction();
		} catch (error) {
			console.error(error);
		}
	} else {
		cancelAction.set({ ...get(cancelAction), [slot]: cAction });
	}
}

export function runUnsavedAction(slot: string = DEFAULT_SLOT_name) {
	try {
		get(unsavedAction)?.[slot]?.();
	} catch (error) {
		console.error(error);
	} finally {
		unsavedAction.set(deleteKeyFromObject(get(unsavedAction), slot));
		unsavedChanges.set(deleteKeyFromObject(get(unsavedChanges), slot));

		// NOTE: after running the unsaved action, also clear the cancel action
		cancelAction.set(deleteKeyFromObject(get(cancelAction), slot));
	}
}

export function runCancelUnsavedAction(slot: string = DEFAULT_SLOT_name) {
	try {
		get(cancelAction)?.[slot]?.();
	} catch (error) {
		console.error(error);
	} finally {
		cancelAction.set(deleteKeyFromObject(get(cancelAction), slot));
		unsavedChanges.set(deleteKeyFromObject(get(unsavedChanges), slot));
	}
}

export function clearAction(slot: string = DEFAULT_SLOT_name) {
	unsavedAction.set(deleteKeyFromObject(get(unsavedAction), slot));
}

function deleteKeyFromObject<T>(obj: Record<string, T>, key: string): Record<string, T> {
	return Object.fromEntries(Object.entries(obj).filter((el) => el[0] !== key));
}
