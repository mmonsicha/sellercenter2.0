import type { Company } from '$lib/entities/company/company';
import * as yup from 'yup';

const min2CharInvalid = 'patona-sellercenter-helper-text-error-minimum2';
const invalidPhone = 'patona-sellercenter-helper-text-error-invalidphone';
const invalidFormat = 'patona-sellercenter-helper-text-error-invalidformat';
const taxIdInvalid = 'patona-sellercenter-company-create-input-error-taxid';
const requiredPhone = 'patona-sellercenter-helper-text-error-blankphone';
const requiredCompanyName = 'patona-sellercenter-helper-text-error-blankcompanyname';

export interface ICompanyForm {
	name: string;
	phone: string;
	phone2: string;
	taxNumber: string;
	email: string;
}

export const initCompanyForm = (c: Company): ICompanyForm => ({
	name: c.name || '',
	phone: c.phone || '',
	phone2: c.phone2 || '',
	taxNumber: c.taxInformation?.taxNumber || '',
	email: c.email || ''
});

export const companyFormSchema = (phoneFormat: RegExp, taxIdFormat: RegExp) =>
	yup.object().shape({
		name: yup
			.string()
			.transform((value) => (value === '' ? undefined : value))
			.required(requiredCompanyName)
			.matches(/^(?!.*฿)[A-Za-zก-๙0-9._\-+\s]+$/, invalidFormat)
			.min(2, min2CharInvalid),
		phone: yup
			.string()
			.required(requiredPhone)
			.test('number', invalidFormat, (value) => {
				const regex = new RegExp(/^[0-9]+$/);
				if (value) {
					return regex.test(value);
				}
				return false;
			})
			.test('format-phone', invalidPhone, (value) => {
				if (value) {
					const regex = new RegExp(phoneFormat);
					return regex.test(value);
				}

				return false;
			}),
		phone2: yup
			.string()
			.notRequired()
			.test('number', invalidFormat, (value) => {
				const regex = new RegExp(/^[0-9]+$/);
				if (value) {
					return regex.test(value);
				}
				return true;
			})
			.test('format-phone2', invalidPhone, (value) => {
				if (value) {
					const regex = new RegExp(phoneFormat);
					return regex.test(value);
				}

				return true;
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
		taxNumber: yup
			.string()
			.notRequired()
			.test({
				name: 'empty-check',
				message: '${errorMessage}',
				test(value, context) {
					if (!!value) {
						const taxSchema = yup
							.string()
							.min(10, taxIdInvalid)
							.matches(taxIdFormat, invalidFormat);
						try {
							taxSchema.validateSync(value);
							return true;
						} catch (err) {
							return context.createError({ message: (err as yup.ValidationError).errors[0] });
						}
					}
					return true;
				}
			})
	});
