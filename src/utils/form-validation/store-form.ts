import type { Settings } from '$lib/entities/address/address';
import type { Store } from '$lib/entities/store/store';
import * as yup from 'yup';

const invalidPhone = 'patona-sellercenter-helper-text-error-invalidphone';
const invalidFormat = 'patona-sellercenter-helper-text-error-invalidformat';
const min2CharInvalid = 'patona-sellercenter-helper-text-error-minimum2';
const requiredBranchName = 'patona-sellercenter-helper-text-error-blankbranchcode';
const requiredStoreName = 'patona-sellercenter-helper-text-error-blankstore';
const requiredPrimaryPhone = 'patona-sellercenter-helper-text-error-blankprimaryphone';

export interface IStoreForm {
	name: string;
	code: string;
	isSystemCode: boolean;
	phone: string;
	phone2: string;
}

export const initStoreForm = (s: Store): IStoreForm => ({
	name: s.name || '',
	code: s.code || '',
	isSystemCode: s.isSystemCode || false,
	phone: s.phone || '',
	phone2: s.phone2 || ''
});

export const storeFormSchema = (st: Settings = {}) =>
	yup.object().shape({
		name: yup
			.string()
			.transform((value) => (value === '' ? undefined : value))
			.required(requiredStoreName)
			.matches(/^(?!.*฿)[A-Za-zก-๙0-9._\-+\s]+$/, invalidFormat)
			.min(2, min2CharInvalid),
		// if isSystemCode is true then code is not need to be validated
		code: yup.string().when('isSystemCode', ([isSystemCode], schema) => {
			return isSystemCode === false
				? schema
						.required(requiredBranchName)
						.matches(new RegExp(st.storeCodeFormat ?? ''), invalidFormat)
						.min(2, min2CharInvalid)
				: schema.notRequired();
		}),
		phone: yup
			.string()
			.required(requiredPrimaryPhone)
			.test('number', invalidFormat, (value) => {
				const regex = new RegExp(/^[0-9]+$/);
				if (value) {
					return regex.test(value);
				}
				return false;
			})
			.test('format-phone', invalidPhone, (value) => {
				if (value) {
					const regex = new RegExp(st.phoneFormat ?? '');
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
					const regex = new RegExp(st.phoneFormat ?? '');
					return regex.test(value);
				}

				return true;
			})
	});
