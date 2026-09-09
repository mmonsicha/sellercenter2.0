import type { Address } from '$lib/entities/address/address';
import { newStore, type Store } from '$lib/entities/store/store';
import { writable } from 'svelte/store';
import { companyCreateStore } from '../../service/management-rest';
import type { IStoreForm } from '$utils/form-validation/store-form';

export type storeState = {
	loading: boolean;
	data: Store[] | undefined;
};

export const isPrefillStoreData = writable<boolean>(false);
export const storeData = writable<Store>(newStore());
export const storeList = writable<storeState>({
	loading: false,
	data: undefined
});

export const setPrefillStoreData = (flag: boolean) => {
	isPrefillStoreData.set(flag);
};

export const createStore = async (cId: string, s: Store): Promise<string> => {
	s.companyId = cId;
	const storeId = await companyCreateStore(s);
	return storeId;
};

export const makeStoreLogo = (v: string) => {
	storeData.update((c) => ({
		...c,
		logo: v
	}));
};

export const makeStoreDetail = (v: IStoreForm) => {
	storeData.update((c) => ({
		...c,
		name: v.name,
		code: v.code,
		isSystemCode: v.isSystemCode,
		phone: v.phone,
		phone2: v.phone2
	}));
};

export const makeStoreAddress = (v: Address) => {
	storeData.update((c) => ({
		...c,
		address: { ...c.address, ...v }
	}));
};
