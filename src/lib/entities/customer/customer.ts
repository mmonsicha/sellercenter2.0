import { type Address as AddressEntity } from '$lib/entities/address/address';

export interface Address extends AddressEntity {
	id?: number;
	isDefault: boolean;
	tags?: string[];
}

export interface Customer {
	addresses?: Address[];
	countryCode: string;
	email?: string;
	firstName?: string;
	id?: number;
	lastName?: string;
	latestOrder?: Date;
	createAt?: Date;
	orderList?: string[];
	owner: string;
	phone?: string;
	taxInformation?: TaxInformation[];
}

export interface ErrorResponse {
	error: string;
	errorCode: string;
	issueId: string;
}

export interface TaxInformation extends AddressEntity {
	branchName?: string;
	fullName: string;
	id?: number;
	kind: 'individual' | 'juristic';
	taxNumber: string;
	email?: string;
}

export const customerAddressToString = (a: AddressEntity, countryName: string): string => {
	return [
		a.street,
		a.localityAreaLevel1,
		a.localityAreaLevel2,
		a.localityAreaLevel3,
		a.administrativeAreaLevel3,
		a.administrativeAreaLevel2,
		a.administrativeAreaLevel1,
		a.postalCode,
		countryName
	]
		.filter(Boolean)
		.join(' ');
};

export const translateTaxKind = (kind: 'individual' | 'juristic'): string => {
	const translations = {
		individual: 'บุคคลธรรมดา',
		juristic: 'นิติบุคคล'
	};
	return translations[kind] || '';
};
