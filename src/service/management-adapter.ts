import {
	SaleChannelType,
	type Attributes,
	type CashierInfo,
	type Delivery,
	ShippingType,
	type Flow,
	type Item,
	type Order,
	type PartyInfo,
	type Pricing,
	type PricingDetail,
	type PricingInfo,
	type SaleChannel,
	type Task,
	type TotalCount
} from '$lib/entities/order/order';
import type { Address, Country, GeoNames } from '$lib/entities/address/address';
import type { Company } from '$lib/entities/company/company';
import type { Profile } from '$lib/entities/identity/profile';
import type { Store } from '$lib/entities/store/store';
import type { PaymentChannel, BankTransfer } from '$lib/entities/payment/payment';
import { PaymentType, toPaymentType } from '$lib/entities/payment/payment';
import type { components } from './management-gen';
type definitions = components['schemas'];

export const toAddress = (a: definitions['addressData']): Address => {
	return {
		administrativeAreaLevel1: a.administrative_area_level_1 ?? '',
		administrativeAreaLevel2: a.administrative_area_level_2 ?? '',
		administrativeAreaLevel3: a.administrative_area_level_3 ?? '',
		localityAreaLevel1: a.locality_area_level_1 ?? '',
		localityAreaLevel2: a.locality_area_level_2 ?? '',
		localityAreaLevel3: a.locality_area_level_3 ?? '',
		postalCode: a.postal_code ?? '',
		street: a.street ?? '',
		country: {
			iso: a.country?.iso_alpha_3 ?? '',
			name: a.country.name,
			addressMapper: {
				administrativeAreaLevel1:
					a.country.administrative_division_name.administrative_area_level_1 ?? '',
				administrativeAreaLevel2:
					a.country.administrative_division_name.administrative_area_level_2 ?? '',
				administrativeAreaLevel3:
					a.country.administrative_division_name.administrative_area_level_3 ?? '',
				localityAreaLevel1: a.country.administrative_division_name.locality_area_level_1 ?? '',
				localityAreaLevel2: a.country.administrative_division_name.locality_area_level_2 ?? '',
				localityAreaLevel3: a.country.administrative_division_name.locality_area_level_3 ?? ''
			}
		},
		coordinates: {
			latitude: a.coordinates.latitude ?? 0,
			longitude: a.coordinates.longitude ?? 0
		}
	};
};

export const toCompany = (c: definitions['companyData']): Company => {
	return {
		id: c.id,
		providerCode: c.provider_code ?? '',
		name: c.name ?? '',
		code: c.code ?? '',
		logo: c.logo ?? '',
		tosId: c.tos_id,
		phone: c.phone ?? '',
		phone2: c.phone2 ?? '',
		address: toAddress(c.address),
		taxInformation: {
			...toAddress(c.tax_information),
			taxNumber: c.tax_information?.tax_id ?? '',
			fullName: c.tax_information?.full_name ?? ''
		},
		stores: c.stores?.map((s) => toStore(s)) ?? [],
		email: c.email ?? ''
	};
};

export const toStore = (s: definitions['storeData']): Store => {
	return {
		id: s.id,
		providerCode: s.provider_code ?? '',
		companyId: s.company_id,
		name: s.name ?? '',
		code: s.code ?? '',
		isSystemCode: s.is_system_code,
		phone: s.phone ?? '',
		phone2: s.phone2 ?? '',
		address: toAddress(s.address),
		taxInformation: {
			...toAddress(s.tax_information),
			taxNumber: s.tax_information?.tax_id ?? '',
			fullName: s.tax_information?.full_name ?? ''
		}
	};
};

export const toProfile = (p: definitions['profile']): Profile => {
	return {
		id: p.id ?? '',
		firstName: p.first_name ?? '',
		lastName: p.last_name ?? '',
		email: p.email ?? '',
		phone: p.phone ?? '',
		avatar: p.avatar ?? '',
		gender: p.gender ?? '',
		verified: p.verified ?? false
	};
};

export const toAddressRequest = (a: Address): definitions['addressData'] => {
	return {
		coordinates: {
			latitude: a.coordinates?.latitude ?? 0,
			longitude: a.coordinates?.longitude ?? 0
		},
		administrative_area_level_1: a.administrativeAreaLevel1,
		administrative_area_level_2: a.administrativeAreaLevel2 ?? '',
		administrative_area_level_3: a.administrativeAreaLevel3 ?? '',
		locality_area_level_1: a.localityAreaLevel1 ?? '',
		locality_area_level_2: a.localityAreaLevel2 ?? '',
		locality_area_level_3: a.localityAreaLevel3 ?? '',
		postal_code: a.postalCode,
		street: a.street,
		// @ts-ignore
		country: {
			iso_alpha_3: a.country?.iso ?? ''
		}
	};
};

export const toCompanyRequest = (c: Company): definitions['companyData'] => {
	return {
		id: c.id ?? '',
		provider_code: c.providerCode,
		name: c.name,
		code: c.code,
		logo: c.logo,
		address: toAddressRequest(c.address),
		tax_information: {
			...toAddressRequest(c.address),
			tax_id: c.taxInformation.taxNumber ?? '',
			full_name: c.taxInformation.fullName
		},
		tos_id: c.tosId ?? '',
		phone: c.phone,
		phone2: c.phone2 ?? '',
		stores: [],
		email: c.email ?? ''
	};
};

export const toStoreRequest = (s: Store): definitions['storeData'] => {
	return {
		id: s.id ?? '',
		provider_code: s.providerCode,
		company_id: s.companyId,
		name: s.name,
		code: s.code,
		is_system_code: s.isSystemCode,
		address: toAddressRequest(s.address),
		tax_information: {
			...toAddressRequest(s.taxInformation ?? {}),
			tax_id: s.taxInformation?.taxNumber,
			full_name: s.taxInformation?.fullName
		},
		phone: s.phone,
		phone2: s.phone2 ?? ''
	};
};

export const toOrderUpdateState = (state: string): definitions['orderDataStateRequest'] => {
	return {
		state: state
	};
};

export const toOrderUpdatePaymentAmount = (
	order: Order
): definitions['orderDataPaymentAmountRequest'] => {
	return {
		buyer_received: order.buyerStatement.receivedAmount ?? 0,
		seller_received: order.sellerStatement?.receivedAmount ?? 0
	};
};

export const toOrderUpdateTaskInfo = (
	taskId: string,
	attributes: string,
	status: string
): definitions['orderDataUpdateTaskInfo'] => {
	return {
		task_id: Number(taskId),
		status: status,
		attributes: attributes
	};
};

export const toOrderRequest = (o: Order) => {
	return {
		provider_code: o.providerCode!,
		refs: o.refs ?? [],
		items: o.items.map((item) => toItemRequest(item)) ?? [],
		flow_type: o.flow.type,
		buyer: toPartyInfoRequest(o.buyer),
		seller: toPartyInfoRequest(o.seller),
		sale_channel: toSaleChannelRequest(o.saleChannel),
		buyer_statement: o.buyerStatement.details?.map((bd) => toPricingDetailRequest(bd)) ?? [],
		seller_statement: o.sellerStatement?.details?.map((bd) => toPricingDetailRequest(bd)) ?? [],
		cashier_info: toCashierInfoRequest(o.cashierInfo),
		deliveries: o.deliveries?.map((d) => toDelivery(d)) ?? []
	};
};

const toDelivery = (d: Delivery | undefined): definitions['Delivery'] => {
	return {
		type: d?.type ?? '',
		courier: d?.courier ?? '',
		method: d?.method ?? '',
		shipping_fee: d?.shippingFee ?? 0,
		remark: d?.remark ?? ''
	};
};

const toCashierInfoRequest = (c: CashierInfo | undefined): definitions['CashierInfo'] => {
	return {
		id: c?.id ?? '',
		kind: c?.kind ?? '',
		name: c?.name ?? '',
		email: c?.email ?? '',
		store_name: c?.storeName ?? ''
	};
};

const toSaleChannelRequest = (s: SaleChannel | undefined): definitions['SaleChannel'] => {
	return {
		sale_origin: s?.saleOrigin ?? '',
		type: s?.type ?? ''
	};
};

const toPartyInfoRequest = (p: PartyInfo | undefined): definitions['PartyInfo'] => {
	return {
		name: p?.name ?? '',
		ref_id: p?.refId ?? '',
		tax_id: p?.taxId ?? '',
		email: p?.email ?? '',
		phone: p?.phone ?? '',
		address: p?.address ?? '',
		country_code: p?.countryCode ?? '',
		postcode: p?.postcode ?? ''
	};
};

const toPricingDetailRequest = (pd: PricingDetail | undefined): definitions['PricingDetail'] => {
	return {
		kind: pd?.kind ?? '',
		description: pd?.description ?? '',
		amount: pd?.amount ?? 0,
		pricing: toPricingRequest(pd?.pricing),
		metadata: pd?.metadata ?? ''
	};
};

const toPricingRequest = (p: Pricing | undefined): definitions['Pricing'] => {
	return {
		type: p?.type ?? '',
		value: p?.value ?? 0
	};
};

const toItemRequest = (i: Item): definitions['Item'] => {
	return {
		product_id: i.productId,
		product_name: i.productName,
		sku: i.sku ?? '',
		original_price: i.originalPrice ?? 0,
		sale_price: i.salePrice,
		qty: i.qty,
		image: i.image ?? '',
		variants: i.variants ?? {}
	};
};

export const toOrder = (o: definitions['orderResponse']): Order => {
	return {
		orderId: o.order_id ? String(o.order_id) : undefined,
		orderSerial: o.order_serial ?? undefined,
		orderDocRef: o.order_doc_ref ?? undefined,
		providerCode: o.provider_code,
		refs: o.refs ?? [],
		flow: toFlow(o.flow),
		cashierInfo: toCashierInfo(o.cashier_info),
		state: o.state ?? undefined,
		status: o.status ?? undefined,
		saleChannel: toSaleChannel(o.sale_channel),
		buyer: toPartyInfo(o.buyer),
		seller: toPartyInfo(o.seller),
		tasks: o.tasks.map((task) => toTask(task)) ?? [],
		items: o.items.map((item) => toItem(item)) ?? [],
		buyerStatement: toPricingInfo(o.buyer_statement),
		sellerStatement: toPricingInfo(o.seller_statement),
		paymentType: o.payment_type ?? undefined,
		createdAt: o.created_at ?? undefined,
		deliveries: o.deliveries?.map((d) => toDeliveryFromResponse(d)) ?? []
	};
};

const toDeliveryFromResponse = (d: definitions['Delivery']): Delivery => {
	const type = d.type;
	let shippingType: ShippingType | undefined;

	if (type === ShippingType.Standard || type === ShippingType.SameDay) {
		shippingType = type as ShippingType;
	}

	return {
		courier: d.courier ?? '',
		method: d.method ?? '',
		remark: d.remark ?? '',
		shippingFee: d.shipping_fee ?? 0,
		type: shippingType
	};
};

export const toTotalCount = (t: definitions['totalCountResponse']): TotalCount => {
	return {
		total: t.total ?? 0,
		totalCanceled: t.total_canceled ?? 0,
		totalCompleted: t.total_completed ?? 0,
		totalPartialCompleted: t.total_partial_completed ?? 0,
		totalPending: t.total_pending ?? 0,
		totalProcessing: t.total_processing ?? 0
	};
};

export const toOrderUpdateDelivery = (
	delivery: Delivery
): definitions['orderDataDeliveryRequest'] => {
	return {
		courier_method: delivery.method ?? '',
		courier_type: delivery.type ?? '',
		shipping_fee: delivery.shippingFee ?? 0
	};
};

export const toOrderUpdateDeliveryRemark = (
	deliveryRemark: string
): definitions['orderDataDeliveryRemarkRequest'] => {
	return {
		delivery_remark: deliveryRemark
	};
};

export const toOrderUpdatePaymentType = (
	paymentType: string
): definitions['orderDataPaymentTypeRequest'] => {
	return {
		payment_type: paymentType
	};
};

export const toOrderUpdateSalesChannel = (
	saleChannel: SaleChannel
): definitions['orderDataSalesChannelRequest'] => {
	return {
		sale_type: saleChannel.type ?? '',
		sale_origin: saleChannel.saleOrigin ?? ''
	};
};

export const toPaymentStoreChannelUpdate = (
	companyId: string,
	storeId: string,
	paymentId: number,
	status: boolean
): definitions['updatePaymentStoreChannelRequest'] => {
	return {
		company_id: companyId,
		store_id: storeId,
		payment_id: paymentId,
		status
	};
};

export const toPaymentChannel = (
	paymentStoreChannel: definitions['paymentStoreChannelData']
): PaymentChannel => {
	const paymentType = toPaymentType(paymentStoreChannel.payment.type);

	let metadata;

	if (paymentType === PaymentType.BANK_TRANSFER && paymentStoreChannel.payment.metadata) {
		const rawMetadata = paymentStoreChannel.payment.metadata as any;

		let bankData: BankTransfer = {
			bankCode: rawMetadata?.provider_bank_code ?? '',
			bankImage: rawMetadata?.provider_bank_logo ?? '',
			accountNumber: rawMetadata?.account_number ?? '',
			accountName: rawMetadata?.name ?? ''
		};
		metadata = bankData;
	}

	return {
		id: String(paymentStoreChannel.id),
		status: paymentStoreChannel.status,
		data: {
			paymentId: String(paymentStoreChannel.payment.id),
			name: paymentStoreChannel.payment.name,
			description: paymentStoreChannel.payment.description ?? '',
			type: paymentType,
			metadata
		}
	};
};

const toPricingInfo = (p?: definitions['PricingInfo']): PricingInfo => {
	return {
		totalPrice: p?.total_Price ?? undefined,
		netPrice: p?.net_price ?? undefined,
		receivedAmount: p?.received_amount ?? undefined,
		details: p?.details?.map((detail) => toPricingDetail(detail)) ?? []
	};
};

const toPricingDetail = (d: definitions['PricingDetail']): PricingDetail => {
	return {
		kind: d.kind,
		description: d.description ?? undefined,
		amount: d.amount ?? undefined,
		pricing: d.pricing ? toPricing(d.pricing) : undefined,
		metadata: d.metadata ?? undefined
	};
};

const toPricing = (p: definitions['Pricing']): Pricing => {
	return {
		type: p.type,
		value: p.value
	};
};

const toItem = (i: definitions['Item']): Item => {
	return {
		productId: i.product_id ?? '',
		productName: i.product_name ?? '',
		sku: i.sku ?? undefined,
		originalPrice: i.original_price ?? undefined,
		salePrice: i.sale_price ?? 0,
		qty: i.qty ?? 0,
		image: i.image ?? undefined,
		variants: i.variants
	};
};

const toTask = (t: definitions['Task']): Task => {
	return {
		taskId: t.task_id ? String(t.task_id) : undefined,
		name: t.name ?? undefined,
		state: t.state ?? undefined,
		status: t.status ?? undefined,
		attributes: t.attributes ? (JSON.parse(t.attributes) as Attributes) : {},
		subtask: Array.isArray(t.subtask) ? t.subtask.map((sub) => toTask(sub)) : [],
		completedAt: t.completed_at ?? undefined,
		canceledAt: t.canceled_at ?? undefined,
		remark: t.remark ?? undefined
	};
};

const toPartyInfo = (p?: definitions['PartyInfo']): PartyInfo => {
	return {
		address: p?.address ?? undefined,
		countryCode: p?.country_code ?? undefined,
		email: p?.email ?? undefined,
		name: p?.name ?? '',
		phone: p?.phone ?? undefined,
		postcode: p?.postcode ?? undefined,
		refId: p?.ref_id ?? undefined,
		taxId: p?.tax_id ?? undefined
	};
};

const toSaleChannel = (s?: definitions['SaleChannel']): SaleChannel => {
	const type = s?.type;
	let saleChannelType: SaleChannelType | undefined;

	if (type === SaleChannelType.Online || type === SaleChannelType.Offline) {
		saleChannelType = type as SaleChannelType;
	}

	return {
		saleOrigin: s?.sale_origin ?? undefined,
		type: saleChannelType
	};
};

const toCashierInfo = (c?: definitions['CashierInfo']): CashierInfo => {
	return {
		id: c?.id ?? undefined,
		kind: c?.kind ?? undefined,
		name: c?.name ?? undefined,
		email: c?.email ?? undefined,
		storeName: c?.store_name ?? undefined
	};
};

const toFlow = (f?: definitions['Flow']): Flow => {
	return { revision: f?.revision ?? 1, type: f?.type ?? '' };
};

export const toAddressCountry = (country?: definitions['addressCountry']): Country => {
	return {
		iso: country?.iso_alpha_3 ?? '',
		name: country?.name ?? '',
		phoneCode: `${country?.phone_code}`,
		addressMapper: {
			administrativeAreaLevel1:
				country?.administrative_division_name?.administrative_area_level_1 ?? '',
			administrativeAreaLevel2:
				country?.administrative_division_name?.administrative_area_level_2 ?? '',
			administrativeAreaLevel3:
				country?.administrative_division_name?.administrative_area_level_3 ?? '',
			localityAreaLevel1: country?.administrative_division_name?.locality_area_level_1 ?? '',
			localityAreaLevel2: country?.administrative_division_name?.locality_area_level_2 ?? '',
			localityAreaLevel3: country?.administrative_division_name?.locality_area_level_3 ?? ''
		},
		settings: {
			phoneFormat: country?.settings?.phone_format,
			postalCodeFormat: country?.settings?.postal_code_format,
			taxIdFormat: country?.settings?.tax_id_format,
			storeCodeFormat: country?.settings?.store_code_format
		}
	};
};

export const toAddressGeoNames = (geo_names?: definitions['postalCode']): GeoNames => {
	return {
		iso: geo_names?.iso_alpha_3 ?? '',
		postalCode: geo_names?.postal_code ?? '',
		addressMapper: {
			administrative_name_level_1:
				geo_names?.administrative_division?.administrative_name_level_1 ?? {},
			administrative_name_level_2:
				geo_names?.administrative_division?.administrative_name_level_2 ?? {},
			administrative_name_level_3:
				geo_names?.administrative_division?.administrative_name_level_3 ?? {},
			locality_name_level_1: geo_names?.administrative_division?.locality_name_level_1 ?? {},
			locality_name_level_2: geo_names?.administrative_division?.locality_name_level_2 ?? {},
			locality_name_level_3: geo_names?.administrative_division?.locality_name_level_3 ?? {}
		}
	};
};
