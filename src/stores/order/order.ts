import { addressToLine } from '$utils/format-address';
import type { Address } from '$lib/entities/address/address';
import {
	FullfilmentType,
	newOrder,
	newPartyInfo,
	SaleChannelType,
	ShippingType,
	Status,
	type CashierInfo,
	type Delivery,
	type Flow,
	type Item,
	type Order,
	type PartyInfo,
	type Pricing,
	type PricingDetail,
	type SaleChannel,
	type TotalCount
} from '$lib/entities/order/order';
import { profileInfo } from '$stores/profile';
import { isRefundPayment } from '$lib/entities/payment/payment-transaction';
import { toPaymentTransaction } from '$service/payment-adapter';
import { derived, get, writable } from 'svelte/store';
import {
	getStoreById,
	getUserCompanyById,
	storeCreateOrder,
	storeGetOrder,
	storeListOrder,
	storeUpdateOrderDeliveryChannel,
	storeUpdateOrderPaymentType,
	storeUpdateOrderSalesChannel,
	storeUpdateOrderState
} from '../../service/management-rest';
import type { discountType, TCartItem, TCartListInfo, TCartOptions } from '../cart';
import type { Sort } from './filter';
import { type Customer } from '$lib/entities/customer/customer';
import { currentStore } from '$stores/store/current-store';

export const mappingTabsTitle = [
	'patona-sellercenter-myorder-tab-all',
	'patona-sellercenter-myorder-tab-inprogress',
	'patona-sellercenter-myorder-tab-completed',
	'patona-sellercenter-myorder-tab-canceled'
];

export type OrderState = {
	loading: boolean;
	data: Order[] | undefined;
	totalCount?: TotalCount | undefined;
	totalStatus?: Record<string, number>;
};

export type Tasks = {
	name: string;
	state?: string[];
	type?: string[];
	status?: string[];
};

export const orderData = writable<Order>(newOrder());
export const orderList = writable<OrderState>({
	loading: false,
	data: undefined,
	totalCount: undefined,
	totalStatus: {}
});

export const shippingFee = derived(orderData, ($orderData) => {
	return $orderData.deliveries?.[0]?.shippingFee ?? 0;
});

export const createOrder = async (o: Order, storeId: string): Promise<void> => {
	const orderId = await storeCreateOrder(o, storeId);
	orderData.update((order) => ({
		...order,
		orderId: orderId
	}));
};

export async function listOrder(
	sId: string,
	offset: number,
	limit: number,
	sort: Sort,
	statuses: string[],
	tasks: Tasks[],
	search: string,
	startDate: string,
	endDate: string,
	salesChannels: string[],
	couriers: string[]
): Promise<void> {
	const pFilter: Tasks | undefined = tasks.find((t) => (t.name = 'payment'));
	orderList.update((o) => ({ ...o, loading: true }));

	try {
		const orders = await storeListOrder(
			sId,
			offset,
			limit,
			sort,
			search,
			statuses,
			startDate,
			endDate,
			pFilter?.state,
			pFilter?.status,
			pFilter?.type,
			'',
			'',
			'cencel_this_shit',
			salesChannels,
			couriers
		);

		orderList.set({
			loading: false,
			data: orders.data,
			totalCount: orders.total
		});

		if (!search && !pFilter && !startDate && !endDate) {
			await handleInitialStatusFetch(orders.total);
		} else {
			await handleStatusFetch(statuses, orders.total);
		}
	} catch (error) {
		orderList.set({
			loading: false,
			data: undefined,
			totalCount: undefined
		});
		throw error;
	}
}

async function handleInitialStatusFetch(tCount: TotalCount): Promise<void> {
	const totals: Record<string, number> = {
		processing: 0,
		canceled: 0,
		completed: 0,
		all: 0
	};
	const processingResult = (tCount.totalProcessing ?? 0) + (tCount.totalPending ?? 0);
	const canceledResult = tCount.totalCanceled ?? 0;

	totals.processing = processingResult || 0;
	totals.canceled = canceledResult || 0;

	orderList.update((o) => ({
		...o,
		totalStatus: totals
	}));
}

async function handleStatusFetch(statuses: string[], tCount: TotalCount): Promise<void> {
	const totals: Record<string, number> = {
		processing: 0,
		canceled: 0,
		completed: 0,
		all: 0
	};

	const updateTotal = async (updateKey: string, total: number) => {
		totals[updateKey] = total || 0;
		orderList.update((o) => ({
			...o,
			totalStatus: { ...o.totalStatus, [updateKey]: totals[updateKey] }
		}));
	};

	if (statuses.includes(Status.Processing) || statuses.includes(Status.Pending)) {
		await updateTotal(Status.Processing, tCount.total);
	}
	if (statuses.includes(Status.Completed)) {
		await updateTotal(Status.Completed, tCount.total);
	}
	if (statuses.includes(Status.Canceled)) {
		await updateTotal(Status.Canceled, tCount.total);
	}
	if (statuses.length === 0) {
		await updateTotal('all', tCount.total);
	}
}

export async function getOrder(sId: string, oId: string) {
	const order = await storeGetOrder(sId, oId);
	orderData.set(order);
}

/**
 * Refetch the order after a cancel until the reversal is reflected. The void/refund
 * rows are projected onto the order by an async OMS Kafka consumer, so a single
 * refetch right after the cancel call can race ahead of them (the old behaviour that
 * needed a manual page refresh). Polls with a short backoff up to `timeoutMs`, setting
 * orderData on every attempt so the reason + status appear immediately and the refund
 * evidence fills in as soon as it lands. Runs in the background — not awaited by the
 * modal — so the page updates in place.
 */
const CANCEL_POLL_TIMEOUT_MS = 8000;
const CANCEL_POLL_INITIAL_DELAY_MS = 400;
const CANCEL_POLL_BACKOFF_FACTOR = 1.5;
const CANCEL_POLL_MAX_DELAY_MS = 1500;

export async function refreshOrderUntilCancelled(
	sId: string,
	oId: string,
	timeoutMs = CANCEL_POLL_TIMEOUT_MS
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let delay = CANCEL_POLL_INITIAL_DELAY_MS;
	for (;;) {
		const order = await storeGetOrder(sId, oId);
		orderData.set(order);

		// Stop once the reversal is visible: a void/refund row landed, or the order
		// reached its terminal canceled state. `refunding` alone is set synchronously
		// by OMS, so it is NOT a stop condition — we keep polling for the evidence.
		const hasReversalRow = (toPaymentTransaction(order)?.payments ?? []).some(isRefundPayment);
		if (order.status === Status.Canceled || hasReversalRow || Date.now() >= deadline) return;

		await new Promise((resolve) => setTimeout(resolve, delay));
		delay = Math.min(delay * CANCEL_POLL_BACKOFF_FACTOR, CANCEL_POLL_MAX_DELAY_MS);
	}
}

export async function updateState(sId: string, oId: string, state: string) {
	await storeUpdateOrderState(sId, oId, state);
}

export const makeOrder = async (
	cartInfo: TCartListInfo,
	discount: number,
	storeId: string,
	companyId: string,
	buyer: PartyInfo,
	flow: string,
	salechannel: SaleChannel,
	remark?: string,
	pickupStoreId?: string
) => {
	const sellerInfo = await setSellerInfo(companyId, storeId, pickupStoreId);
	const cashierInfo = await makeCashierInfo(storeId);
	const pricingDetail = setPricingDetail('discount', setPricing(cartInfo.discount.type, discount));

	const deliveries = get(orderData).deliveries;

	let updatedDeliveries = deliveries;

	if (deliveries && deliveries.length > 0) {
		const firstDelivery = { ...deliveries[0], remark: remark ?? '' };
		updatedDeliveries = [firstDelivery, ...deliveries.slice(1)];
	} else {
		updatedDeliveries = [{ remark: remark ?? '' }];
	}

	orderData.update((o) => ({
		...o,
		buyer: setPartyInfo(buyer),
		buyerStatement: {
			details: [pricingDetail]
		},
		seller: sellerInfo,
		flow: setFlow(flow),
		items: setItem(cartInfo.data),
		saleChannel: makeSalesChannel(salechannel),
		cashierInfo,
		deliveries: updatedDeliveries
	}));
};

export function setPaymentType(paymentType: string) {
	orderData.update((order) => ({
		...order,
		paymentType: paymentType
	}));
}

export function setSalesChannel(salesChannel: SaleChannel) {
	orderData.update((order) => ({
		...order,
		saleChannel: salesChannel
	}));
}

export function setDelivery(delivery: Delivery) {
	orderData.update((order) => ({
		...order,
		deliveries: [delivery]
	}));
}

export function getBuyerFromStore(): PartyInfo {
	const current = get(orderData).buyer;
	return current?.name ? { ...current } : newPartyInfo();
}

export function clearOrderMeta() {
	orderData.update((order) => ({
		...order,
		paymentType: '',
		deliveries: [],
		saleChannel: {
			saleOrigin: FullfilmentType.PickupImmediate,
			type: SaleChannelType.Offline
		}
	}));
}

const setPartyInfo = (buyer: PartyInfo): PartyInfo => {
	var buyerInfo: PartyInfo = {
		name: 'ลูกค้าหน้าร้าน'
	};

	if (buyer.refId) {
		buyerInfo = buyer;
	}
	return buyerInfo;
};

const setPricingDetail = (
	kind: string,
	pricing: Pricing,
	description?: string,
	metadata?: string
): PricingDetail => {
	return {
		kind: kind,
		pricing: pricing,
		description: description,
		metadata: metadata
	};
};

const setPricing = (type: discountType, value: number): Pricing => {
	return {
		type: type,
		value: -Math.abs(value ?? 0)
	};
};

const makeCashierInfo = async (sId: string): Promise<CashierInfo> => {
	const p = get(profileInfo);
	const store = await getStoreById(sId);
	const cashier: CashierInfo = {
		id: sId,
		kind: 'store',
		name: `${p.data?.firstName} ${p.data?.lastName}`,
		email: p.data?.email,
		storeName: store.name
	};

	return cashier;
};

const makeSalesChannel = (s: SaleChannel): SaleChannel => {
	return {
		saleOrigin: s.saleOrigin,
		type: s.type
	};
};

const setSellerInfo = async (
	companyId: string,
	storeId: string,
	pickupStoreId?: string
): Promise<PartyInfo> => {
	const company = await getUserCompanyById(companyId);
	const store = await getStoreById(storeId);

	// On a pick-up-later sale the customer collects the goods at a branch the cashier
	// picked, which need not be the branch ringing up the sale. The order API has no
	// pickup-branch field yet, so the collection point rides on the seller block — the
	// party the customer walks up to — while cashierInfo still names the selling
	// branch. When both are the same branch (or nothing was picked) the payload is
	// byte-for-byte what it was before.
	const pickup =
		pickupStoreId && pickupStoreId !== storeId ? await getStoreById(pickupStoreId) : undefined;

	return {
		name: company.name,
		refId: (pickup ?? store).code,
		phone: (pickup ?? store).phone,
		email: company.email,
		taxId: store.taxInformation.taxNumber ?? company.taxInformation.taxNumber,
		address: addressToLine(pickup ? pickup.address : company.address),
		countryCode: (pickup ? pickup.address.country?.iso : company.address.country?.iso) ?? 'THA',
		postcode: pickup ? pickup.address.postalCode : company.address.postalCode
	};
};

const setItem = (items: TCartItem[]): Item[] => {
	return items.map((i) => {
		const defaultProductId = i.product_id.split('-');

		const item: Item = {
			image: i.image,
			salePrice: i.price,
			productId: defaultProductId[0],
			productName: i.product_name,
			qty: i.qty,
			sku: i.code
		};

		if (i.options) {
			item.variants = toVariants(i.options);
		}

		return item;
	});
};

const setFlow = (t: string): Flow => {
	return {
		type: t
	};
};

const toVariants = (opt: TCartOptions[]): Record<string, string> => {
	const variants: Record<string, string> = {};

	for (const option of opt) {
		variants[option.key] = option.value;
	}

	return variants;
};

export const setPartyInfoToOrder = (c: Customer, address?: string): PartyInfo => {
	const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');

	return {
		name: fullName,
		refId: c.id != null ? String(c.id) : undefined,
		phone: c.phone,
		email: c.email,
		address: address
	};
};

export const setDeliveryRemarkToOrder = (remark: string): void => {
	orderData.update((order) => ({
		...order,
		deliveries: order.deliveries?.map((delivery) => ({
			...delivery,
			remark: remark
		}))
	}));
};

export const clearOrder = (): void => {
	orderData.set(newOrder());
};

export const updateOrderDeliveryChannelDetail = async (): Promise<void> => {
	await storeUpdateOrderDeliveryChannel(
		get(currentStore).id ?? '',
		get(orderData).orderId ?? '',
		get(orderData).deliveries?.[0]?.method ?? '',
		get(orderData).deliveries?.[0]?.type ?? ('' as ShippingType),
		get(orderData).deliveries?.[0]?.shippingFee ?? 0
	);
};

export const updatePaymentType = async (): Promise<void> => {
	await storeUpdateOrderPaymentType(
		get(currentStore).id ?? '',
		get(orderData).orderId ?? '',
		get(orderData).paymentType ?? ''
	);
};

export const updateSalesChannel = async (): Promise<void> => {
	await storeUpdateOrderSalesChannel(
		get(currentStore).id ?? '',
		get(orderData).orderId ?? '',
		get(orderData).saleChannel?.type ?? SaleChannelType.Offline,
		get(orderData).saleChannel?.saleOrigin ?? ''
	);
};
