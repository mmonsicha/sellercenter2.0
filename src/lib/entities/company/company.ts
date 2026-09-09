import { newAddress, type Address } from '../address/address';
import type { Store } from '../store/store';
const env = import.meta.env;

const providerCode = env.VITE_PROVIDER_CODE;
export interface Company {
	id?: string;
	providerCode: string;
	name: string;
	code: string;
	logo: string;
	phone: string;
	phone2?: string;
	address: Address;
	taxInformation: {
		fullName: string;
		taxNumber?: string;
	} & Address;
	tosId?: string;
	stores: Store[];
	email?: string;
}

export const newCompany = (): Company => ({
	providerCode: providerCode,
	name: '',
	code: '',
	logo: '',
	phone: '',
	address: newAddress(),
	taxInformation: {
		fullName: '',
		...newAddress()
	},
	stores: []
});
