import type { Address } from '$lib/entities/address/address';
import * as yup from 'yup';

const min2CharInvalid = 'patona-sellercenter-helper-text-error-minimum2';
const invalidFormat = 'patona-sellercenter-helper-text-error-invalidformat';
const requiredCountry = 'patona-sellercenter-helper-text-error-selectedcountry';
const requiredPostalCode = 'patona-sellercenter-helper-text-error-selectedpostalcode';
const requiredAddress = 'patona-sellercenter-helper-text-error-blankaddress';

export interface IAddressForm {
	postalCode: string;
	administrativeAreaLevel1: string;
	administrativeAreaLevel2: string;
	administrativeAreaLevel3: string;
	localityAreaLevel1: string;
	localityAreaLevel2: string;
	localityAreaLevel3: string;
	street: string;
	country: {
		iso: string;
		name: string;
	};
}

export const initAddressForm = (a: Address): IAddressForm => ({
	postalCode: a.postalCode || '',
	administrativeAreaLevel1: a.administrativeAreaLevel1 || '',
	administrativeAreaLevel2: a.administrativeAreaLevel2 || '',
	administrativeAreaLevel3: a.administrativeAreaLevel3 || '',
	localityAreaLevel1: a.localityAreaLevel1 || '',
	localityAreaLevel2: a.localityAreaLevel2 || '',
	localityAreaLevel3: a.localityAreaLevel3 || '',
	street: a.street || '',
	country: {
		iso: a.country?.iso || '',
		name: a.country?.name || ''
	}
});

export const addressFormSchema = (postalcodeFormat: RegExp) =>
	yup.object().shape({
		country: yup.object({
			iso: yup.string().required(requiredCountry)
		}),
		postalCode: yup.string().required(requiredPostalCode).matches(postalcodeFormat, invalidFormat),
		street: yup.string().required(requiredAddress).min(2, min2CharInvalid),
		administrativeAreaLevel1: yup.string(),
		administrativeAreaLevel2: yup.string(),
		administrativeAreaLevel3: yup.string(),
		localityAreaLevel1: yup.string(),
		localityAreaLevel2: yup.string(),
		localityAreaLevel3: yup.string()
	});

export const validationSchema = async (data: any, postalcodeFormat: RegExp): Promise<boolean> => {
	try {
		await addressFormSchema(postalcodeFormat).validate(data, { strict: true });
		return true;
	} catch (error) {
		return false;
	}
};
