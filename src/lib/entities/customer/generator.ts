import type { Address, Customer, TaxInformation } from './customer';
import { type Address as AddressEntity } from '$lib/entities/address/address';

export const generateEmptyCustomer = (): Customer => ({
	addresses: [],
	taxInformation: [],
	countryCode: 'THA',
	owner: ''
});

export const generateEmptyTax = (): TaxInformation => ({
	fullName: '',
	kind: 'individual',
	taxNumber: '',
	...generateEmptyAddressEntity()
});

export const generateEmptyAddress = (): Address => ({
	isDefault: false,
	...generateEmptyAddressEntity()
});

export const generateEmptyAddressEntity = (): AddressEntity => ({
	administrativeAreaLevel1: '',
	administrativeAreaLevel2: '',
	administrativeAreaLevel3: '',
	contactName: '',
	coordinates: {
		latitude: 0,
		longitude: 0
	},
	country: {
		iso: 'THA'
	},
	localityAreaLevel1: '',
	localityAreaLevel2: '',
	localityAreaLevel3: '',
	notes: '',
	phone: '',
	postalCode: '',
	street: ''
});
