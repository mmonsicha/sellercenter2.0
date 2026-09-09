import type { Payment } from '$lib/entities/sale/sale';
import * as yup from 'yup';

const textReceivedInvalid = 'patona-sellercenter-modal-payment-tab-cash-error';
const textFormatInvalid = 'patona-sellercenter-modal-payment-error';

export const initPaymentForm = (p: Payment) => ({
	type: p.type || 'cash',
	received: p.received,
	ref: p.ref || '',
	note: p.note || '',
	total: p.total || 0
});

export const paymentFormSchema = yup
	.object({
		type: yup.string().required(),
		total: yup.number().required(),
		received: yup
			.number()
			.typeError(textReceivedInvalid)
			.when('type', {
				is: (value: string) => value === 'cash',
				then: (schema) =>
					schema
						.required(textReceivedInvalid)
						.min(0, textReceivedInvalid)
						.max(99999999.99, textReceivedInvalid),
				otherwise: (schema) => {
					return schema.notRequired();
				}
			}),
		ref: yup
			.string()
			.matches(/^[A-Za-z0-9]*$/, textFormatInvalid)
			.max(100, textFormatInvalid),
		note: yup.string().max(255, textFormatInvalid)
	})
	.test('received-not-less-than-total', textReceivedInvalid, function (values) {
		const { received, total, type } = values;
		if (type === 'cash') {
			return received !== undefined && total !== undefined ? received >= total : true;
		}
		return true;
	});

export const validationSchema = async (data: any): Promise<boolean> => {
	try {
		await paymentFormSchema.validate(data, { strict: true });
		return true;
	} catch (error) {
		return false;
	}
};
