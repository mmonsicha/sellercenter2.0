import * as yup from 'yup';
import type { Country } from '../address/address';
import type { Address, Customer, TaxInformation } from './customer';
import type { Address as AddressEntity } from '../address/address';

const invalidPhone = 'patona-sellercenter-helper-text-error-invalidphone';
const min2CharInvalid = 'patona-sellercenter-helper-text-error-minimum2';
const min4CharInvalid = 'patona-sellercenter-helper-text-error-minimum4';
const invalidFormat = 'patona-sellercenter-helper-text-error-invalidformat';
const requiredFullName = 'patona-sellercenter-helper-text-error-blankfullname';
const requiredName = 'patona-sellercenter-helper-text-error-blankname';
const requiredLastName = 'patona-sellercenter-helper-text-error-blanklastname';
const requiredPhone = 'patona-sellercenter-helper-text-error-blankphone';
const requiredPostalCode = 'patona-sellercenter-helper-text-error-selectedpostalcode';
const requiredCountryCode = 'patona-sellercenter-helper-text-error-blankcountrycode';
const requiredCountry = 'patona-sellercenter-helper-text-error-blankcountry';
const requiredOwner = 'patona-sellercenter-helper-text-error-blankowner';
const requiredAddress = 'patona-sellercenter-helper-text-error-blankaddress';
const requiredBranchName = 'patona-sellercenter-helper-text-error-blankbranchcode';
const requiredTaxNumber = 'patona-sellercenter-helper-text-error-blanktaxid';
const requiredCompanyName = 'patona-sellercenter-helper-text-error-blankcompanyname';

export const customerSchema = (country?: Country) =>
	yup.object<Customer>().shape({
		firstName: yup
			.string()
			.trim()
			.required(requiredName)
			.min(2, min2CharInvalid)
			.max(50, invalidFormat),
		lastName: yup
			.string()
			.trim()
			.required(requiredLastName)
			.min(2, min2CharInvalid)
			.max(50, invalidFormat),
		phone: yup
			.string()
			.trim()
			.required(requiredPhone)
			.test('country', requiredCountry, (value) => {
				return !!country;
			})
			.test('number', invalidFormat, (value) => {
				const regex = new RegExp(/^[0-9]+$/);
				if (value) {
					return regex.test(value);
				}
				return false;
			})
			.test('format-phone', invalidPhone, (value) => {
				if (country?.settings?.phoneFormat) {
					const regex = new RegExp(country.settings.phoneFormat);
					return regex.test(value);
				}

				return false;
			}),
		email: yup
			.string()
			.trim()
			.nullable()
			.notRequired()
			.max(254, invalidFormat)
			.test('strict-email', invalidFormat, (value) => {
				if (!value) return true;

				const strictEmailRegex =
					/^[a-zA-Z0-9](?!.*\.\.)[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

				return strictEmailRegex.test(value);
			}),

		countryCode: yup.string().required(requiredCountryCode),
		owner: yup.string().required(requiredOwner)
	});

export const customerAddressEntitySchema = (country?: Country) =>
	yup.object<AddressEntity>().shape({
		contactName: yup
			.string()
			.required(requiredFullName)
			.transform((value) => {
				return value?.trimStart();
			})
			.test('space', invalidFormat, (value) => {
				return !/^\s+|\s+$/.test(value ?? '');
			})
			.required(min4CharInvalid)
			.min(4, min4CharInvalid)
			.max(100, invalidFormat),
		phone: yup
			.string()
			.trim()
			.required(requiredPhone)
			.test('country', requiredCountry, (value) => {
				return !!country;
			})
			.test('number', invalidFormat, (value) => {
				const regex = new RegExp(/^[0-9]+$/);
				return regex.test(value);
			})
			.test('format-phone', invalidPhone, (value) => {
				if (country?.settings?.phoneFormat) {
					const regex = new RegExp(country.settings.phoneFormat);
					return regex.test(value);
				}

				return false;
			})
	});

export const customerAddressSchema = (country?: Country) =>
	customerAddressEntitySchema(country).concat(
		yup.object<Address>().shape({
			isDefault: yup.boolean()
		})
	);

export const customerTaxSchema = (country?: Country) =>
	customerAddressEntitySchema(country).concat(
		yup.object<TaxInformation>().shape({
			contactName: yup.string().notRequired(),
			fullName: yup.string().when(['kind'], ([kind], schema) => {
				return kind === 'individual'
					? schema
							.required(requiredFullName)
							.transform((value) => {
								return value?.trimStart();
							})
							.test('space', invalidFormat, (value) => {
								return !/^\s+|\s+$/.test(value ?? '');
							})
							.min(4, min4CharInvalid)
							.max(100, invalidFormat)
					: schema
							.required(requiredCompanyName)
							.transform((value) => {
								return value?.trimStart();
							})
							.min(2, min2CharInvalid)
							.max(100, invalidFormat)
							.matches(/^[A-Za-z0-9\u0E00-\u0E7F&\-./'‘’+_:,\[\]\(\)\s]+$/, invalidFormat);
			}),
			branchName: yup.string().when(['kind'], ([kind], schema) => {
				return kind === 'juristic'
					? schema
							.required(requiredBranchName)
							.test('space', invalidFormat, (value) => {
								return !/^\s+|\s+$/.test(value ?? '');
							})
							.min(2, min2CharInvalid)
							.max(100, invalidFormat)
					: schema.notRequired();
			}),
			phone: yup
				.string()
				.trim()
				.required(requiredPhone)
				.test('country', requiredCountry, (value) => {
					return !!country;
				})
				.test('number', invalidFormat, (value) => {
					const regex = new RegExp(/^[0-9]+$/);
					return regex.test(value);
				})
				.test('format-phone', invalidPhone, (value) => {
					if (country?.settings?.phoneFormat) {
						const regex = new RegExp(country.settings.phoneFormat);
						return regex.test(value);
					}

					return false;
				}),
			taxNumber: yup
				.string()
				.required(requiredTaxNumber)
				.test('country', requiredCountry, (value) => {
					return !!country;
				})
				.test('format', invalidFormat, (value) => {
					if (country!.settings?.taxIdFormat) {
						const regex = new RegExp(country!.settings.taxIdFormat);
						return regex.test(value);
					}
					return false;
				}),
			email: yup
				.string()
				.trim()
				.nullable()
				.notRequired()
				.max(254, invalidFormat)
				.test('strict-email', invalidFormat, (value) => {
					if (!value) return true;

					const strictEmailRegex =
						/^[a-zA-Z0-9](?!.*\.\.)[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

					return strictEmailRegex.test(value);
				})
		})
	);
