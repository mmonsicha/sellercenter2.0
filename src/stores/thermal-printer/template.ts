import orderReciept58mm from '$lib/paper-template/order-receipt-58mm.json';
import orderReciept80mm from '$lib/paper-template/order-receipt-80mm.json';
import orderTaxInvoice58mm from '$lib/paper-template/order-tax-invoice-58mm.json';
import orderTaxInvoice80mm from '$lib/paper-template/order-tax-invoice-80mm.json';
import type { PAPER_WIDTHS, Template } from 'sellsuki-paper-template-renderer';

export type TemplateMap = {
	[template: string]: {
		[pageSize in keyof typeof PAPER_WIDTHS]?: Template;
	};
};

export const templateMap: TemplateMap = {
	order_reciept: {
		'58mm': orderReciept58mm as Template,
		'80mm': orderReciept80mm as Template
	},
	order_tax_invoice: {
		'58mm': orderTaxInvoice58mm as Template,
		'80mm': orderTaxInvoice80mm as Template
	}
};
