export type discountType = 'percentage' | 'fixed';
export type TCartListInfo = {
	data: TCartItem[];
	totalPrice: number;
	summaryPrice: number;
	discount: {
		type: discountType;
		value: number;
	};
};

export type TCartOptions = {
	key: string;
	value: string;
};

export type TCartItem = {
	product_id: string;
	product_name: string;
	code: string;
	price: number;
	qty: number;
	image?: string;
	input?: TCartOptions[];
	options?: TCartOptions[];
};
