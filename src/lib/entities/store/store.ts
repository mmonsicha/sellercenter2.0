import { newAddress, type Address } from '../address/address';

export interface Store {
	code: string;
	isSystemCode: boolean;
	companyId: string;
	id?: string;
	name: string;
	providerCode: string;
	phone: string;
	phone2?: string;
	address: Address;
	taxInformation: {
		fullName: string;
		taxNumber: string;
	} & Address;
}

export const newStore = (): Store => ({
	code: '',
	isSystemCode: false,
	companyId: '',
	name: '',
	providerCode: '',
	phone: '',
	address: newAddress(),
	taxInformation: {
		fullName: '',
		taxNumber: '',
		...newAddress()
	}
});
