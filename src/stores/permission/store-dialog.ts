import { get, writable } from 'svelte/store';

type DialogPermissionState = {
	status: 'idle' | 'pending' | 'done';
	companyId?: string;
};

const dialogPermissionState = writable<DialogPermissionState>({ status: 'idle' });

const setDialogPermissionPending = (companyId?: string) =>
	dialogPermissionState.set({ status: 'pending', companyId });

const setDialogPermissionDone = (companyId?: string) =>
	dialogPermissionState.set({ status: 'done', companyId });

const setDialogPermissionIdle = () => dialogPermissionState.set({ status: 'idle' });

const waitForDialogPermissionReady = (companyId?: string) =>
	new Promise<void>((resolve) => {
		const current = get(dialogPermissionState);
		if (current.status !== 'pending') {
			resolve();
			return;
		}
		const unsubscribe = dialogPermissionState.subscribe((state) => {
			if (state.status !== 'pending' || (companyId && state.companyId !== companyId)) {
				unsubscribe();
				resolve();
			}
		});
	});

export {
	dialogPermissionState,
	setDialogPermissionDone,
	setDialogPermissionIdle,
	setDialogPermissionPending,
	waitForDialogPermissionReady
};
