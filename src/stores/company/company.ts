import { type Company, newCompany } from '$lib/entities/company/company';
import { derived, writable } from 'svelte/store';
import { userCreateCompany, listUserCompany } from '../../service/management-rest';
import type { Address } from '$lib/entities/address/address';
import type { ICompanyForm } from '$utils/form-validation/company-form';

export type CompanyState = {
	loading: boolean;
	data: Company[] | undefined;
};

// Store data
export const companyData = writable<Company>(newCompany());
export const companyList = writable<CompanyState>({
	loading: false,
	data: undefined
});

export const isFirstCompany = derived(
	companyList,
	($companyList) => {
		if ($companyList.loading) return false;
		const dataLength = $companyList.data?.length || 0;
		const hasStore =
			$companyList.data?.reduce((totalStores, company) => totalStores + company.stores.length, 0) ||
			0;
		return dataLength <= 1 && hasStore === 0;
	},
	false
);

// update store
export const createCompany = async (c: Company): Promise<string> => {
	const companyId = await userCreateCompany(c);

	return companyId;
};

export const makeCompanyLogo = (v: string) => {
	companyData.update((c) => ({
		...c,
		logo: v
	}));
};

export const makeCompanyDetail = (v: ICompanyForm) => {
	companyData.update((c) => ({
		...c,
		name: v.name,
		phone: v.phone,
		phone2: v.phone2,
		email: v.email,
		taxInformation: {
			...c.taxInformation,
			taxNumber: v.taxNumber
		}
	}));
};

export const makeCompanyAddress = (v: Address) => {
	companyData.update((c) => ({
		...c,
		address: v
	}));
};

export async function loadCompany() {
	companyList.update((c) => {
		return { ...c, loading: true };
	});

	const resp = await listUserCompany();

	if (!resp) {
		companyList.update((c) => {
			return { ...c, loading: false };
		});
		return;
	}

	companyList.set({ loading: false, data: resp });
}

export function getCompanyDetailById(cId: string) {
	let company: Company | undefined;
	companyList.subscribe((cList) => {
		if (cList.data && cList.data.length > 0) {
			const c = cList.data.find((c) => c.id === cId);
			company = c;
		}
	});

	return company;
}

export function setCompanyData(c: Company | undefined) {
	companyData.set(c || newCompany());
}
