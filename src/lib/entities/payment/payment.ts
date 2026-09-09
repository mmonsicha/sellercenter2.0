export interface PaymentChannel {
	id: string;
	status: boolean;
	data: PaymentChannelDetail;
}

export interface PaymentChannelDetail {
	paymentId: string;
	name: string;
	description: string;
	type?: PaymentType;
	logo?: string;
	metadata?: BankTransfer;
}

export interface BankTransfer {
	bankImage: string;
	bankCode: string;
	accountNumber: string;
	accountName: string;
}

export const enum PaymentType {
	CASH = 'cash',
	BANK_TRANSFER = 'bankTransfer'
}

export const toPaymentType = (type?: string): PaymentType | undefined => {
	let paymentType: PaymentType | undefined;

	if (type === PaymentType.CASH || type === PaymentType.BANK_TRANSFER) {
		paymentType = type as PaymentType;
	}

	return paymentType;
};

export const translatePaymentType = (paymentType: string): string => {
	switch (paymentType) {
		case PaymentType.CASH:
			return 'เงินสด';
		case PaymentType.BANK_TRANSFER:
			return 'บัญชีธนาคาร';
		default:
			return '';
	}
};
