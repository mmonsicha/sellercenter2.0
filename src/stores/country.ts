import type { Country } from '$lib/entities/address/address';
import { writable } from 'svelte/store';
import { listCountries } from '../service/management-rest';

export type CountryState = {
	loading: boolean;
	data: Country[] | undefined;
};

export const countriesList = writable<CountryState>({
	loading: false,
	data: undefined
});

export async function loadCountries() {
	countriesList.update((c) => {
		return { ...c, loading: true };
	});

	const resp = await listCountries();

	if (!resp) {
		countriesList.update((c) => {
			return { ...c, loading: false };
		});
		return;
	}

	countriesList.set({ loading: false, data: resp });
}
