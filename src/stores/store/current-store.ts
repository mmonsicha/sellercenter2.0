import type { Store } from '$lib/entities/store/store';
import { navigate } from 'svelte-routing';
import { writable, get, derived } from 'svelte/store';
import { currentCompany } from '$stores/company/current-company';
import { isFirstCompany } from '$stores/company/company';
import { configurationStore, updateUserConfiguration } from '$stores/configuration';

export const currentStore = writable<Store>();

export function setCurrentStoreById(sId: string) {
	const currCompany = get(currentCompany);
	const store = currCompany?.stores?.find((s) => s.id === sId);
	if (store) {
		currentStore.set(store);
	} else {
		getDefaultStore(currCompany);
	}
}

export async function setCurrentStore(sId: string) {
	isFirstCompany.subscribe(async (isFirst) => {
		if (isFirst) {
			currentCompany.subscribe(async (c) => {
				if (c) {
					if (!c.tosId) {
						return navigate(`/company/tos?company_id=${c.id}`);
					} else if (c.stores.length === 0) {
						return navigate(`/store/new?company_id=${c.id}`);
					}
				}
			});
		} else {
			if (sId) {
				setCurrentStoreById(sId);
				return;
			}

			currentCompany.subscribe((c) => {
				if (c) {
					getDefaultStore(c);
				}
			});
		}
	});
}

async function getDefaultStore(c: any) {
	const defaultStore = c.stores[c.stores.length - 1];

	updateUserConfiguration({
		selectedStoreId: defaultStore.id
	});
}

export function updateDataCurrentStore() {
	const store = get(currentCompany)?.stores?.find((s) => s.id === get(currentStore)?.id);
	if (store) {
		currentStore.set(store);
	}
}

const selectedStoreIdStoreId = derived(configurationStore, ($configurationStore) => {
	if ($configurationStore.data?.user?.selectedStoreId !== get(currentStore)?.id) {
		return $configurationStore.data?.user?.selectedStoreId;
	}
});

selectedStoreIdStoreId.subscribe((selectStroeId) => {
	if (selectStroeId) {
		setCurrentStore(selectStroeId);
	}
});
