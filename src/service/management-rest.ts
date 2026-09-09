import { newAxiosClient } from '$lib/axios-client-v2';
import type { Company } from '$lib/entities/company/company';
import type { Profile } from '$lib/entities/identity/profile';
import type { Order, SaleChannelType, ShippingType } from '$lib/entities/order/order';
import type { Store } from '$lib/entities/store/store';
import type { PaymentChannel } from '$lib/entities/payment/payment';
import type { paths, components } from './management-gen';

export type CreatePaymentTransactionRequest =
	components['schemas']['createOrderPaymentTransactionRequest'];
export type PaymentTransactionData = components['schemas']['paymentTransactionData'];
export type CancelPaymentTransactionRequest =
	components['schemas']['cancelOrderPaymentTransactionRequest'];
export type CancelPaymentTransactionResponse =
	components['schemas']['cancelOrderPaymentTransactionResponse'];
export type SubmitPaymentRequest = components['schemas']['submitOrderPaymentRequest'];
export type SubmitPaymentResponse = components['schemas']['submitOrderPaymentResponse'];
export type SubmitAndApprovePaymentResponse =
	components['schemas']['submitAndApproveOrderPaymentResponse'];
import {
	toAddressCountry,
	toAddressGeoNames,
	toCompany,
	toCompanyRequest,
	toOrder,
	toOrderRequest,
	toOrderUpdateDelivery,
	toOrderUpdateDeliveryRemark,
	toOrderUpdatePaymentAmount,
	toOrderUpdatePaymentType,
	toOrderUpdateSalesChannel,
	toOrderUpdateState,
	toOrderUpdateTaskInfo,
	toProfile,
	toPaymentChannel,
	toPaymentStoreChannelUpdate,
	toStore,
	toStoreRequest,
	toTotalCount
} from './management-adapter';
import {
	toApprovePaymentRequest,
	toApprovePaymentResult,
	toEditPaymentRequest,
	toEditPaymentResult,
	toRejectPaymentRequest,
	toRejectPaymentResult,
	type ApprovePaymentResult,
	type EditPaymentInput,
	type EditPaymentResult,
	type RejectPaymentResult
} from './payment-adapter';

const env = import.meta.env;

const providerCode = env.VITE_PROVIDER_CODE;
const base = env.VITE_MANAGEMENT_URL;

const managementClient = newAxiosClient(base, undefined, true);

export type UploadPrivateFileResult = {
	fileAccessURL: string;
	fileRecordID: string;
};

export const getUserProfile = async (): Promise<Profile | undefined> => {
	try {
		const resp =
			await managementClient.get<
				paths['/user/profile']['get']['responses'][200]['content']['application/json']
			>('/user/profile');
		if (!resp) {
			return undefined;
		}

		return toProfile(resp.data);
	} catch (error: any) {
		return undefined;
	}
};

export const getCompanyById = async (id: string): Promise<Company> => {
	const resp = await managementClient.get<
		paths['/company/{company_id}']['get']['responses'][200]['content']['application/json']
	>(`/company/${id}`);
	return toCompany(resp.data);
};

export const getStoreById = async (id: string): Promise<Store> => {
	const resp = await managementClient.get<
		paths['/store/{store_id}']['get']['responses'][200]['content']['application/json']
	>(`/store/${id}`);
	return toStore(resp.data);
};

export const listUserCompany = async (): Promise<Company[]> => {
	const resp = await managementClient.get<
		paths['/user/company']['get']['responses'][200]['content']['application/json']
	>('/user/company', {
		params: { provider_code: providerCode }
	});
	return resp.data?.map(toCompany);
};

export const getUserCompanyById = async (id: string): Promise<Company> => {
	const resp = await managementClient.get<
		paths['/user/company/{company_id}']['get']['responses'][200]['content']['application/json']
	>(`/user/company/${id}`, {
		params: { provider_code: providerCode }
	});
	return toCompany(resp.data);
};

export const getTosConsent = async (): Promise<string> => {
	return (
		await managementClient.get<
			paths['/public/consent/company/tos']['get']['responses'][200]['content']['text/plain']
		>('/public/consent/company/tos')
	).data;
};

export const acceptTosConsent = async (companyId: string): Promise<void> => {
	await managementClient.post<
		paths['/company/{company_id}/accept_tos_consent']['post']['responses'][200]['content']['application/json']
	>(`/company/${companyId}/accept_tos_consent`);
};

export const userCreateCompany = async (c: Company): Promise<string> => {
	return (
		await managementClient.post<
			paths['/user/company']['post']['responses'][200]['content']['application/json']
		>('/user/company', toCompanyRequest({ ...c, providerCode: providerCode }))
	).data;
};

export const companyCreateStore = async (store: Store): Promise<string> => {
	return (
		await managementClient.post<
			paths['/company/{company_id}/store']['post']['responses'][200]['content']['application/json']
		>(`/company/${store.companyId}/store`, toStoreRequest({ ...store, providerCode: providerCode }))
	).data;
};

export const updateCompany = async (c: Company): Promise<void> => {
	await managementClient.put<
		paths['/company/{company_id}']['put']['responses'][200]['content']['application/json']
	>(`/company/${c.id}`, toCompanyRequest(c));
};

export const updateStore = async (s: Store): Promise<void> => {
	await managementClient.put<
		paths['/store/{store_id}']['put']['responses'][200]['content']['application/json']
	>(`/store/${s.id}`, toStoreRequest(s));
};

export const deleteStore = async (sId: string): Promise<void> => {
	await managementClient.delete<
		paths['/store/{store_id}']['delete']['responses'][200]['content']['application/json']
	>(`/store/${sId}`);
};

export const storeCreateOrder = async (order: Order, sId: string): Promise<string> => {
	const oq = toOrderRequest({ ...order, providerCode: providerCode });

	return (
		await managementClient.post<
			paths['/store/{store_id}/order']['post']['responses'][200]['content']['application/json']
		>(`/store/${sId}/order`, oq)
	).data;
};

export const storeGetOrder = async (sId: string, oId: string): Promise<Order> => {
	const resp = await managementClient.get<
		paths['/store/{store_id}/order/{order_id}']['get']['responses'][200]['content']['application/json']
	>(`/store/${sId}/order/${oId}`);
	return toOrder(resp.data);
};

export const storeUpdateOrderState = async (
	sId: string,
	oId: string,
	state: string
): Promise<string> => {
	return (
		await managementClient.put<
			paths['/store/{store_id}/order/{order_id}/state']['put']['responses'][200]['content']['application/json']
		>(`/store/${sId}/order/${oId}/state`, toOrderUpdateState(state))
	).data;
};

//taskInfo
export const storeUpdateTaskInfo = async (
	sId: string,
	oId: string,
	tId: string,
	attributes: string,
	status: string
): Promise<string> => {
	return (
		await managementClient.put<
			paths['/store/{store_id}/order/{order_id}/task']['put']['responses'][200]['content']['application/json']
		>(`/store/${sId}/order/${oId}/task`, toOrderUpdateTaskInfo(tId, attributes, status))
	).data;
};

export const storeUpdatePaymentAmount = async (
	sId: string,
	oId: string,
	order: Order
): Promise<string> => {
	return (
		await managementClient.put<
			paths['/store/{store_id}/order/{order_id}/payment']['put']['responses'][200]['content']['application/json']
		>(`/store/${sId}/order/${oId}/payment`, toOrderUpdatePaymentAmount(order))
	).data;
};

export const storeListOrder = async (
	sId: string,
	offset: number = 0,
	limit: number = 10,
	sort: string = 'desc',
	search: string = '',
	status: string[] = [],
	start: string = '',
	end: string = '',
	tState: string[] = [],
	tStatus: string[] = [],
	pType: string[] = [],
	buyerRef: string = '',
	sellerRef: string = '',
	requestNamespace?: string,
	salesChannels: string[] = [],
	couriers: string[] = []
) => {
	const resp = await managementClient.get<
		paths['/store/{store_id}/orders']['get']['responses'][200]['content']['application/json']
	>(`store/${sId}/orders`, {
		params: {
			offset,
			limit,
			sort,
			order_status: status.join(','),
			order_serial: search,
			buyer_name: search,
			task_state: tState.join(','),
			task_status: tStatus.join(','),
			payment_type: pType.join(','),
			start_date: start,
			end_date: end,
			buyer_ref: buyerRef,
			seller_ref: sellerRef,
			sale_channel: salesChannels.length ? salesChannels.join(',') : undefined,
			couriers: couriers.length ? couriers.join(',') : undefined
		}
	});

	return { data: resp.data?.data?.map(toOrder), total: toTotalCount(resp.data.total_count) };
};

export const storeUpdateOrderDeliveryChannel = async (
	sId: string,
	oId: string,
	method: string,
	type: ShippingType,
	shippingFee: number
): Promise<string> => {
	return (
		await managementClient.put<
			paths['/store/{store_id}/order/{order_id}/delivery-channel']['put']['responses'][200]['content']['application/json']
		>(
			`/store/${sId}/order/${oId}/delivery-channel`,
			toOrderUpdateDelivery({ method, type, shippingFee })
		)
	).data;
};

export const storeUpdateOrderDeliveryRemark = async (
	sId: string,
	oId: string,
	deliveryRemark: string
): Promise<string> => {
	return (
		await managementClient.put<
			paths['/store/{store_id}/order/{order_id}/delivery-remark']['put']['responses'][200]['content']['application/json']
		>(`/store/${sId}/order/${oId}/delivery-remark`, toOrderUpdateDeliveryRemark(deliveryRemark))
	).data;
};

export const storeUpdateOrderPaymentType = async (
	sId: string,
	oId: string,
	paymentType: string
): Promise<string> => {
	return (
		await managementClient.put<
			paths['/store/{store_id}/order/{order_id}/payment-type']['put']['responses'][200]['content']['application/json']
		>(`/store/${sId}/order/${oId}/payment-type`, toOrderUpdatePaymentType(paymentType))
	).data;
};

export const storeUpdateOrderSalesChannel = async (
	sId: string,
	oId: string,
	scT: SaleChannelType,
	scO: string
): Promise<string> => {
	return (
		await managementClient.put<
			paths['/store/{store_id}/order/{order_id}/sales-channel']['put']['responses'][200]['content']['application/json']
		>(
			`/store/${sId}/order/${oId}/sales-channel`,
			toOrderUpdateSalesChannel({ type: scT, saleOrigin: scO })
		)
	).data;
};

export const listCountries = async () => {
	const { data } =
		await managementClient.get<
			paths['/public/countries']['get']['responses'][200]['content']['application/json']
		>('/public/countries');

	return data.data?.map(toAddressCountry) ?? [];
};

export const listGeoNames = async (code: string, offset: number = 0, limit: number = 1) => {
	const { data } = await managementClient.get<
		paths['/public/postal-codes/{code}']['get']['responses'][200]['content']['application/json']
	>(`/public/postal-codes/${code}`, { params: { limit, offset } });

	return {
		data: data?.data?.map(toAddressGeoNames) ?? [],
		total: data?.total ?? 0
	};
};

export const listPaymentChannels = async (
	companyId: string,
	storeId: string
): Promise<{ data: PaymentChannel[]; total: number }> => {
	try {
		const resp = await managementClient.get<
			paths['/payment']['get']['responses'][200]['content']['application/json']
		>('/payment', {
			params: {
				company: companyId,
				store: storeId
			}
		});

		return {
			data: resp.data?.data?.map(toPaymentChannel) ?? [],
			total: resp.data?.total ?? 0
		};
	} catch (error) {
		throw error;
	}
};

export interface ProviderBankOption {
	code: string;
	name: string;
}

// Provider banks (reference data: bank code → display name) for resolving a slip's
// bank name from its bank_code.
export const listProviderBanks = async (): Promise<ProviderBankOption[]> => {
	const resp =
		await managementClient.get<
			paths['/provider-banks']['get']['responses'][200]['content']['application/json']
		>('/provider-banks');
	return (resp.data?.data ?? []).map((b) => ({ code: b.code, name: b.name }));
};

export const updatePaymentStoreChannel = async (
	id: number,
	companyId: string,
	storeId: string,
	paymentId: number,
	status: boolean
): Promise<paths['/payment/{id}']['put']['responses'][200]['content']['application/json']> => {
	const resp = await managementClient.put<
		paths['/payment/{id}']['put']['responses'][200]['content']['application/json']
	>(`/payment/${id}`, toPaymentStoreChannelUpdate(companyId, storeId, paymentId, status));

	return resp.data;
};

export const managementCheckPermissionsEach = async (
	kind: string,
	id: string,
	permissions: string[]
) => {
	try {
		const resp = await managementClient.get<
			paths['/checkpermission/each']['get']['responses'][200]['content']['application/json']
		>('/checkpermission/each', {
			params: {
				kind,
				id,
				permissions: Array.isArray(permissions) ? permissions.join(',') : []
			}
		});
		return resp.data.status;
	} catch (error: any) {
		throw error;
	}
};

export const createOrderPaymentTransaction = async (
	sId: string,
	oId: string,
	req: CreatePaymentTransactionRequest
): Promise<PaymentTransactionData> => {
	const resp = await managementClient.post<
		paths['/store/{store_id}/order/{order_id}/payment-transaction']['post']['responses'][200]['content']['application/json']
	>(`/store/${sId}/order/${oId}/payment-transaction`, req);
	return resp.data;
};

export const cancelOrderPaymentTransaction = async (
	sId: string,
	oId: string,
	req: CancelPaymentTransactionRequest
): Promise<CancelPaymentTransactionResponse> => {
	const resp = await managementClient.post<
		paths['/store/{store_id}/order/{order_id}/payment-transaction/cancel']['post']['responses'][200]['content']['application/json']
	>(`/store/${sId}/order/${oId}/payment-transaction/cancel`, req);
	return resp.data;
};

// Generated from the BFF /cancel endpoint (management-gen.ts).
export type CancelReason = NonNullable<components['schemas']['cancelOrderRequest']['cancel_reason']>;
export type CancelOrderResponse = components['schemas']['cancelOrderResponse'];

export const storeCancelOrder = async (
	sId: string,
	oId: string,
	reason?: CancelReason,
	note?: string
): Promise<CancelOrderResponse> => {
	// cancel_reason is optional (unpaid cancels send none; backend accepts an empty body).
	const body: components['schemas']['cancelOrderRequest'] = {};
	if (reason) body.cancel_reason = reason;
	if (note && note.trim()) body.cancel_note = note.trim();
	const resp = await managementClient.post<
		paths['/store/{store_id}/order/{order_id}/cancel']['post']['responses'][200]['content']['application/json']
	>(`/store/${sId}/order/${oId}/cancel`, body);
	return resp.data;
};

export const submitOrderPayment = async (
	sId: string,
	oId: string,
	req: SubmitPaymentRequest
): Promise<SubmitPaymentResponse> => {
	const resp = await managementClient.post<
		paths['/store/{store_id}/order/{order_id}/submit-payment']['post']['responses'][200]['content']['application/json']
	>(`/store/${sId}/order/${oId}/submit-payment`, req);
	return resp.data;
};

export const submitAndApproveOrderPayment = async (
	sId: string,
	oId: string,
	req: SubmitPaymentRequest
): Promise<SubmitAndApprovePaymentResponse> => {
	const resp = await managementClient.post<
		paths['/store/{store_id}/order/{order_id}/submit-and-approve']['post']['responses'][200]['content']['application/json']
	>(`/store/${sId}/order/${oId}/submit-and-approve`, req);
	return resp.data;
};

export const uploadPrivateFile = async (
	file: File,
	refId: string,
	accessMode = 'ACCESS_URL'
): Promise<UploadPrivateFileResult> => {
	const formData = new FormData();
	formData.append('file', file);
	const resp = await managementClient.post<
		paths['/file/private']['post']['responses'][200]['content']['application/json']
	>('/file/private', formData, { params: { ref_id: refId, access_mode: accessMode } });
	return {
		fileAccessURL: resp.data.fileAccessURL ?? '',
		fileRecordID: resp.data.fileRecordID ?? ''
	};
};

export const deletePrivateFile = async (fileRecordID: string, refId: string): Promise<void> => {
	await managementClient.delete(`/file/${fileRecordID}`, { params: { ref_id: refId } });
};

// --- payment slip review (approve / reject / edit) ---

export const approvePaymentSlip = async (
	storeId: string,
	orderId: string,
	paymentId: string
): Promise<ApprovePaymentResult> => {
	const resp = await managementClient.post<
		paths['/payment/{payment_id}/approve']['post']['responses'][200]['content']['application/json']
	>(`/payment/${paymentId}/approve`, toApprovePaymentRequest(), {
		params: { store: storeId, order: orderId }
	});
	return toApprovePaymentResult(resp.data);
};

export const rejectPaymentSlip = async (
	storeId: string,
	orderId: string,
	paymentId: string,
	reason: string,
	note?: string
): Promise<RejectPaymentResult> => {
	const resp = await managementClient.post<
		paths['/payment/{payment_id}/reject']['post']['responses'][200]['content']['application/json']
	>(`/payment/${paymentId}/reject`, toRejectPaymentRequest(reason, note), {
		params: { store: storeId, order: orderId }
	});
	return toRejectPaymentResult(resp.data);
};

export const editPaymentDetail = async (
	storeId: string,
	orderId: string,
	paymentId: string,
	input: EditPaymentInput
): Promise<EditPaymentResult> => {
	const resp = await managementClient.post<
		paths['/payment/{payment_id}/edit']['post']['responses'][200]['content']['application/json']
	>(`/payment/${paymentId}/edit`, toEditPaymentRequest(input), {
		params: { store: storeId, order: orderId }
	});
	return toEditPaymentResult(resp.data);
};
