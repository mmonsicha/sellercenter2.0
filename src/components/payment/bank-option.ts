import { PaymentType, type PaymentChannel } from '$lib/entities/payment/payment';

export interface BankOption {
	id: string; // PaymentChannel row id (used for selection UI only)
	code: string;
	account: string;
	accountName: string;
	logo: string;
	paymentId: number; // ch.data.paymentId — sent to the API (NOT id)
}

export function toBankOptions(channels: PaymentChannel[]): BankOption[] {
	return channels
		.filter(
			(ch) =>
				ch.status === true && ch.data?.type === PaymentType.BANK_TRANSFER && !!ch.data?.metadata
		)
		.map(
			(ch): BankOption => ({
				id: ch.id,
				code: ch.data.metadata!.bankCode,
				account: ch.data.metadata!.accountNumber,
				accountName: ch.data.metadata!.accountName,
				logo: ch.data.metadata!.bankImage,
				paymentId: Number(ch.data.paymentId)
			})
		);
}
