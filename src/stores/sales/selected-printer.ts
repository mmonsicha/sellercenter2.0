import { get, writable } from 'svelte/store';
import { getDefaultOnlinePrinter, type PairedPrinter } from '$stores/thermal-printer';

export const selectedPrinter = writable<PairedPrinter | undefined>(undefined);

export const getSelectedPrinter = () => {
	return get(selectedPrinter) || getDefaultOnlinePrinter();
};

export const setSelectedPrinter = (printer: PairedPrinter | undefined) => {
	selectedPrinter.set(printer);
};
