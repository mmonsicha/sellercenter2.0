export type Address = {
	addressId?: string;
	contactName?: string;
	country?: Country;
	coordinates?: AddressCoordinatesEntity;
	administrativeAreaLevel1: string;
	administrativeAreaLevel2?: string;
	administrativeAreaLevel3?: string;
	localityAreaLevel1?: string;
	localityAreaLevel2?: string;
	localityAreaLevel3?: string;
	postalCode: string;
	street: string;
	phone?: string;
	notes?: string;
};

export interface AddressCoordinatesEntity {
	latitude: number;
	longitude: number;
}

export type Settings = {
	phoneFormat?: string;
	taxIdFormat?: string;
	storeCodeFormat?: string;
	postalCodeFormat?: string;
};

export type Country = {
	iso: string;
	name?: string;
	addressMapper?: {
		administrativeAreaLevel1: string;
		administrativeAreaLevel2: string;
		administrativeAreaLevel3: string;
		localityAreaLevel1: string;
		localityAreaLevel2: string;
		localityAreaLevel3: string;
	};
	settings?: Settings;
	phoneCode?: string;
};

export type GeoNames = {
	iso?: string;
	postalCode?: string;
	addressMapper?: GeoNamesAddressMapper;
};

export type GeoNamesAddressMapper = {
	administrative_name_level_1?: { [key: string]: string };
	administrative_name_level_2?: { [key: string]: string };
	administrative_name_level_3?: { [key: string]: string };
	locality_name_level_1?: { [key: string]: string };
	locality_name_level_2?: { [key: string]: string };
	locality_name_level_3?: { [key: string]: string };
};

export const newAddress = (): Address => ({
	administrativeAreaLevel1: '',
	postalCode: '',
	street: '',
	notes: ''
});

export const addressToString = (address: Address): string => {
	const countryName = address.country?.name;
	const addressMapper = address.country?.addressMapper;

	let addressString = '';
	if (address.street) {
		addressString += address.street;
	}
	if (addressMapper?.localityAreaLevel3 && address.localityAreaLevel3) {
		addressString += `, ${address.localityAreaLevel3}`;
	}

	if (addressMapper?.localityAreaLevel2 && address.localityAreaLevel2) {
		addressString += `, ${address.localityAreaLevel2}`;
	}

	if (addressMapper?.localityAreaLevel1 && address.localityAreaLevel1) {
		addressString += `, ${address.localityAreaLevel1}`;
	}

	if (addressMapper?.administrativeAreaLevel3 && address.administrativeAreaLevel3) {
		addressString += `, ${address.administrativeAreaLevel3}`;
	}

	if (addressMapper?.administrativeAreaLevel2 && address.administrativeAreaLevel2) {
		addressString += `, ${address.administrativeAreaLevel2}`;
	}

	if (addressMapper?.administrativeAreaLevel1 && address.administrativeAreaLevel1) {
		addressString += `, ${address.administrativeAreaLevel1}`;
	}

	if (countryName && address.country?.name) {
		addressString += `, ${address.country.name}`;
	}
	return addressString;
};

export const prefillAddress = (address: Address): any => {
	return {
		postalCode: address.postalCode,
		administrativeAreaLevel1: address.administrativeAreaLevel1,
		administrativeAreaLevel2: address.administrativeAreaLevel2 || '',
		administrativeAreaLevel3: address.administrativeAreaLevel3 || '',
		localityAreaLevel1: address.localityAreaLevel1 || '',
		localityAreaLevel2: address.localityAreaLevel2 || '',
		localityAreaLevel3: address.localityAreaLevel3 || '',
		notes: address.notes || '',
		street: address.street || '',
		country: {
			iso: address.country?.iso || '',
			name: address.country?.name || ''
		}
	};
};

export const prefillAddressErrors = () => {
	return {
		addressId: '',
		postalCode: '',
		administrativeAreaLevel1: '',
		administrativeAreaLevel2: '',
		administrativeAreaLevel3: '',
		localityAreaLevel1: '',
		localityAreaLevel2: '',
		localityAreaLevel3: '',
		notes: '',
		street: '',
		country: ''
	};
};
