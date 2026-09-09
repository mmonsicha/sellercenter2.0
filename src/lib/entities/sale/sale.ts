export type SaleProduct = {
	type?: string;
	product_id: string;
	code: string;
	label: string;
	price: SalePrice;
	image: string;
	variant?: SaleVariant[];
	customerInput?: SaleCustomerInput[];
};

export type SalePrice = {
	min: number;
	max?: number;
};

export type SaleCustomerInput = {
	required: boolean;
	isLimit: boolean;
	limit: number;
	type: string;
	label: string;
};

export type SaleVariant = {
	image?: string;
	id: string;
	name: string;
	sku: string;
	price: number;
	variant_combination?: VariantCombination[];
};

export type VariantCombination = {
	key?: string;
	value?: string;
};

export type Payment = {
	type: string;
	total: number;
	received?: number;
	change: number;
	ref?: string;
	note?: string;
};
