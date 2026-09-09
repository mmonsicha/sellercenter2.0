import type { Company } from '$lib/entities/company/company';
import { configurationStore, updateUserConfiguration } from '$stores/configuration';
import { companyList, getCompanyDetailById, loadCompany } from './company';
import { writable, get, derived } from 'svelte/store';

export const currentCompany = writable<Company>();

export async function setCurrentCompany(cId?: string) {
	let currCm: Company | undefined;
	if (cId) {
		try {
			currCm = getCompanyDetailById(cId);
			if (currCm) {
				currentCompany.set(currCm);
				return;
			}
		} catch {}
	}

	await loadCompany();
	setDefaultCompany();
}

function setDefaultCompany() {
	const c = get(companyList);

	let currCm: Company;

	if (c.data && c.data.length > 0) {
		currCm = c.data[c.data.length - 1];

		if (currCm.stores && currCm.stores.length > 0) {
			updateUserConfiguration({
				selectedCompanyId: currCm.id,
				selectedStoreId: currCm.stores[currCm.stores.length - 1].id
			});
		} else {
			updateUserConfiguration({
				selectedCompanyId: currCm.id
			});
		}
	}
}

companyList.subscribe((c) => {
	const currCompany = c?.data?.find((company) => {
		if (company.id === get(currentCompany)?.id) {
			return c;
		}
	});

	if (currCompany) {
		currentCompany.set(currCompany);
	}
});

const selectedCompanyId = derived(configurationStore, ($configurationStore) => {
	if ($configurationStore.data?.user?.selectedCompanyId !== get(currentCompany)?.id) {
		return $configurationStore.data?.user?.selectedCompanyId;
	}
});

selectedCompanyId.subscribe((selectedCompanyId) => {
	if (selectedCompanyId) {
		setCurrentCompany(selectedCompanyId);
	}
});
