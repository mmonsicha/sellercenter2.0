import { Status } from '$lib/entities/order/order';
import type { OrderFilter } from '$stores/order/filter';
import { localStorageKey } from '$utils/local-storage';
import _ from 'lodash';

export enum OrderStatus {
	all = 'all',
	process = 'processing',
	completed = 'completed',
	cancel = 'cancel'
}

enum State {
	paid = 'patona-sellercenter-myorder-checkbox-paid',
	waitingPayment = 'patona-sellercenter-myorder-checkbox-waitingpayment'
}

enum Channel {
	unknown = 'patona-sellercenter-myorder-checkbox-unknown',
	cash = 'patona-sellercenter-myorder-checkbox-cash',
	bankTransfer = 'patona-sellercenter-myorder-checkbox-banktransfer',
	card = 'patona-sellercenter-myorder-checkbox-card',
	other = 'patona-sellercenter-myorder-checkbox-other',
	cod = 'patona-sellercenter-myorder-checkbox-cod'
}

enum SalesChannel {
	pickupImmediate = 'รับทันที',
	pickupLater = 'รับภายหลัง',
	shopDelivery = 'จัดส่งจากหน้าร้าน',
	unknown = 'ไม่ระบุ',
	line = 'LINE',
	facebook = 'Facebook',
	instagram = 'Instagram',
	shopee = 'Shopee',
	lazada = 'Lazada',
	tiktok = 'TikTok Shop',
	lineShopping = 'LINE SHOPPING',
	openApi = 'Open-API'
}

export enum Courier {
	unknownStandard = 'unknownStandard',
	unknownSameday = 'unknownSameday',
	flash = 'Flash Express',
	thailandPost = 'Thailand Post',
	jnt = 'J&T',
	kex = 'KEX Express',
	messenger = 'Messenger',
	lineMan = 'LINE MAN',
	grab = 'Grab',
	lalamove = 'Lalamove',
	deliveree = 'Deliveree',
	makesend = 'MakeSend',
	skootar = 'Skootar'
}

export const groupedChannels = {
	storefront: [SalesChannel.pickupImmediate, SalesChannel.pickupLater, SalesChannel.shopDelivery],
	online: [
		SalesChannel.unknown,
		SalesChannel.line,
		SalesChannel.facebook,
		SalesChannel.instagram,
		SalesChannel.shopee,
		SalesChannel.lazada,
		SalesChannel.tiktok,
		SalesChannel.lineShopping,
		SalesChannel.openApi
	]
};

export const groupedCouriers = {
	standard: [
		Courier.unknownStandard,
		Courier.flash,
		Courier.thailandPost,
		Courier.jnt,
		Courier.kex
	],
	sameday: [
		Courier.unknownSameday,
		Courier.messenger,
		Courier.lineMan,
		Courier.grab,
		Courier.lalamove,
		Courier.deliveree,
		Courier.makesend,
		Courier.skootar
	]
};

export type FilterOption = {
	total: number;
	createdDate: boolean;
	paymentState?: paymentState[];
	paymentChannel?: PaymentChannel[];
	salesChannels?: SalesChannelOption[];
	couriers?: CourierOption[];
};

type paymentState = {
	state: State;
	checked: boolean;
};

type PaymentChannel = {
	channel: Channel;
	checked: boolean;
};

type SalesChannelOption = {
	channel: SalesChannel;
	checked: boolean;
};

type CourierOption = {
	name: Courier;
	checked: boolean;
};

type OrderStatusMap = {
	[key in OrderStatus]: FilterOption;
};

type CreatedDate = {
	from?: Date;
	to?: Date;
};

export const mapOrderStatusToFilter: OrderStatusMap = {
	all: {
		total: 0,
		createdDate: true,
		paymentState: [
			{ state: State.paid, checked: false },
			{ state: State.waitingPayment, checked: false }
		],
		paymentChannel: Object.values(Channel).map((channel) => ({
			channel,
			checked: false
		})),
		salesChannels: Object.values(SalesChannel).map((channel) => ({
			channel,
			checked: false
		})),
		couriers: Object.values(Courier).map((name) => ({
			name,
			checked: false
		}))
	},
	processing: {
		total: 0,
		createdDate: true,
		paymentState: [
			{ state: State.paid, checked: false },
			{ state: State.waitingPayment, checked: false }
		],
		paymentChannel: Object.values(Channel).map((channel) => ({
			channel,
			checked: false
		})),
		salesChannels: Object.values(SalesChannel).map((channel) => ({
			channel,
			checked: false
		})),
		couriers: Object.values(Courier).map((name) => ({
			name,
			checked: false
		}))
	},
	completed: {
		total: 0,
		createdDate: true,
		paymentState: [{ state: State.paid, checked: false }],
		paymentChannel: Object.values(Channel).map((channel) => ({
			channel,
			checked: false
		})),
		salesChannels: Object.values(SalesChannel).map((channel) => ({
			channel,
			checked: false
		})),
		couriers: Object.values(Courier).map((name) => ({
			name,
			checked: false
		}))
	},
	cancel: {
		total: 0,
		createdDate: true
	}
};

export function toInitFilterOrder(oState: OrderStatus, oFilter: OrderFilter): FilterOption {
	const newObj = _.cloneDeep(mapOrderStatusToFilter[oState]);

	const mappedState = oFilter.payment?.status ? filterMappedStates(oFilter.payment.status) : [];
	const mappedType = oFilter.payment?.type ? filterMappedChannels(oFilter.payment.type) : [];
	const mappedSales = oFilter.salesChannels ? filterMappedSaleChannels(oFilter.salesChannels) : [];
	const mappedCourier = oFilter.couriers ? filterMappedCouriers(oFilter.couriers) : [];

	if (mappedState.length && newObj.paymentState) {
		newObj.paymentState = newObj.paymentState.map((state) => ({
			...state,
			checked: mappedState.includes(state.state)
		}));
	}

	if (mappedType.length && newObj.paymentChannel) {
		newObj.paymentChannel = newObj.paymentChannel.map((channel) => ({
			...channel,
			checked: mappedType.includes(channel.channel)
		}));
	}

	if (mappedSales.length && newObj.salesChannels) {
		newObj.salesChannels = newObj.salesChannels.map((s) => ({
			...s,
			checked: mappedSales.includes(s.channel)
		}));
	}

	if (mappedCourier.length && newObj.couriers) {
		newObj.couriers = newObj.couriers.map((c) => ({
			...c,
			checked: mappedCourier.includes(c.name)
		}));
	}

	newObj.total = oFilter.total || 0;

	return newObj;
}

export function toOrderFilter(f: FilterOption, date: CreatedDate): OrderFilter {
	const hasPaymentStateFilter = !!f.paymentState?.find((s) => s.checked);
	const hasPaymentTypeFilter = !!f.paymentChannel?.find((c) => c.checked);
	const hasSaleChannelFilter = !!f.salesChannels?.find((s) => s.checked);
	const hasCourierFilter = !!f.couriers?.find((c) => c.checked);

	let o: OrderFilter = {
		total: f.total
	};

	if (date.from && date.to) {
		o.createdDate = {
			start: date.from.toISOString(),
			end: date.to.toISOString()
		};
	}

	if (hasPaymentStateFilter || hasPaymentTypeFilter) {
		if (hasPaymentStateFilter) {
			const state = f.paymentState?.filter((s) => s.checked).map((s) => s.state);
			o.payment = {
				...o.payment,
				status: mappedStatuses(state ?? [])
			};
		}

		if (hasPaymentTypeFilter) {
			const channels = f.paymentChannel?.filter((c) => c.checked).map((s) => s.channel);
			o.payment = {
				...o.payment,
				type: mappedChannels(channels ?? [])
			};
		}
	}

	if (hasSaleChannelFilter) {
		const sales = f.salesChannels?.filter((s) => s.checked).map((s) => s.channel);
		o.salesChannels = mappedSaleChannels(sales ?? []);
	}

	if (hasCourierFilter) {
		const couriers = f.couriers?.filter((c) => c.checked).map((c) => c.name);
		o.couriers = mappedCouriers(couriers ?? []);
	}

	return o;
}

export const mappedChannels = (pChannels: string[]): string[] => {
	const c = pChannels.map((channel) => {
		switch (channel) {
			case Channel.unknown:
				return ['unknown'];
			case Channel.bankTransfer:
				return ['bankTransfer'];
			case Channel.card:
				return ['creditCard', 'debitCard'];
			case Channel.cash:
				return ['cash'];
			case Channel.other:
				return ['other'];
			case Channel.cod:
				return ['cod'];
			default:
				return [];
		}
	});

	return _.flatten(c);
};

export const mappedStatuses = (pStates: string[]): string[] => {
	const s = pStates.map((state) => {
		switch (state) {
			case State.paid:
				return [Status.Completed];
			case State.waitingPayment:
				return [Status.Pending];
			default:
				return [];
		}
	});

	return _.flatten(s);
};

export const mappedSaleChannels = (ms: string[]): string[] => {
	const s = ms.map((sc) => {
		switch (sc) {
			case SalesChannel.pickupImmediate:
				return ['pickupImmediate'];
			case SalesChannel.pickupLater:
				return ['pickupLater'];
			case SalesChannel.shopDelivery:
				return ['shopDelivery'];
			case SalesChannel.unknown:
				return ['unknown'];
			case SalesChannel.line:
				return ['line'];
			case SalesChannel.facebook:
				return ['facebook'];
			case SalesChannel.instagram:
				return ['instagram'];
			case SalesChannel.shopee:
				return ['shopee'];
			case SalesChannel.lazada:
				return ['lazada'];
			case SalesChannel.tiktok:
				return ['tiktok'];
			case SalesChannel.lineShopping:
				return ['lineShopping'];
			case SalesChannel.openApi:
				return ['openApi'];
			default:
				return [];
		}
	});
	return _.flatten(s);
};

export const mappedCouriers = (cs: string[]): string[] => {
	const result = cs.flatMap((c) => {
		switch (c) {
			case Courier.unknownStandard:
				return ['standard:unknown'];
			case Courier.unknownSameday:
				return ['sameday:unknown'];
			case Courier.flash:
				return ['standard:flash'];
			case Courier.thailandPost:
				return ['standard:thailandPost'];
			case Courier.jnt:
				return ['standard:jnt'];
			case Courier.kex:
				return ['standard:kex'];
			case Courier.messenger:
				return ['sameday:messenger'];
			case Courier.lineMan:
				return ['sameday:lineMan'];
			case Courier.grab:
				return ['sameday:grab'];
			case Courier.lalamove:
				return ['sameday:lalamove'];
			case Courier.deliveree:
				return ['sameday:deliveree'];
			case Courier.makesend:
				return ['sameday:makesend'];
			case Courier.skootar:
				return ['sameday:skootar'];
			default:
				return [];
		}
	});
	return result;
};

export const filterMappedStates = (pStates: string[]): string[] => {
	const s = pStates.map((state) => {
		switch (state) {
			case Status.Completed:
				return [State.paid];
			case Status.Pending:
				return [State.waitingPayment];
			default:
				return [];
		}
	});

	return _.flatten(s);
};

export const filterMappedChannels = (pChannels: string[]): string[] => {
	const c = pChannels.map((channel) => {
		switch (channel) {
			case 'unknown':
				return [Channel.unknown];
			case 'bankTransfer':
				return [Channel.bankTransfer];
			case 'creditCard':
			case 'debitCard':
				return [Channel.card];
			case 'cash':
				return [Channel.cash];
			case 'other':
				return [Channel.other];
			case 'cod':
				return [Channel.cod];
			default:
				return [];
		}
	});

	return _.flatten(c);
};

export const filterMappedSaleChannels = (fs: string[]): SalesChannel[] => {
	const s = fs.map((sales) => {
		switch (sales) {
			case 'pickupImmediate':
				return [SalesChannel.pickupImmediate];
			case 'pickupLater':
				return [SalesChannel.pickupLater];
			case 'shopDelivery':
				return [SalesChannel.shopDelivery];
			case 'line':
				return [SalesChannel.line];
			case 'facebook':
				return [SalesChannel.facebook];
			case 'instagram':
				return [SalesChannel.instagram];
			case 'shopee':
				return [SalesChannel.shopee];
			case 'lazada':
				return [SalesChannel.lazada];
			case 'tiktok':
				return [SalesChannel.tiktok];
			case 'lineShopping':
				return [SalesChannel.lineShopping];
			case 'openApi':
				return [SalesChannel.openApi];
			case 'unknown':
				return [SalesChannel.unknown];
			default:
				return [];
		}
	});

	return _.flatten(s);
};

export const filterMappedCouriers = (fc: string[]): Courier[] => {
	const c = fc.map((courier) => {
		switch (courier) {
			case 'standard:flash':
				return Courier.flash;
			case 'standard:thailandPost':
				return Courier.thailandPost;
			case 'standard:jnt':
				return Courier.jnt;
			case 'standard:kex':
				return Courier.kex;
			case 'standard:unknown':
				return Courier.unknownStandard;

			case 'sameday:messenger':
				return Courier.messenger;
			case 'sameday:lineMan':
				return Courier.lineMan;
			case 'sameday:grab':
				return Courier.grab;
			case 'sameday:lalamove':
				return Courier.lalamove;
			case 'sameday:deliveree':
				return Courier.deliveree;
			case 'sameday:makesend':
				return Courier.makesend;
			case 'sameday:skootar':
				return Courier.skootar;
			case 'sameday:unknown':
				return Courier.unknownSameday;

			default:
				return [];
		}
	});

	return _.flatten(c);
};
