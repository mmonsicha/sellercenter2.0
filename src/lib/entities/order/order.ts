const env = import.meta.env;
const providerCode = env.VITE_PROVIDER_CODE;

export enum OrderFlow {
	POS_OFFLINE = 'POS-OFFLINE',
	POS_OFFLINE_DELIVERY_LATER = 'POS-OFFLINE-DELIVERY-LATER',
	POS_ONLINE = 'POS-ONLINE',
	POS_OFFLINE_SUKIPAY_DELIVER_FROM_STORE_V1 = 'POS-OFFLINE-SUKIPAY-DELIVER-FROM-STORE-V1',
	POS_OFFLINE_SUKIPAY_PICKUP_INSTANT_V1 = 'POS-OFFLINE-SUKIPAY-PICKUP-INSTANT-V1',
	POS_OFFLINE_SUKIPAY_PICKUP_LATER_V1 = 'POS-OFFLINE-SUKIPAY-PICKUP-LATER-V1',
	POS_ONLINE_SUKIPAY_V1 = 'POS-ONLINE-SUKIPAY-V1'
}

// True when an order was created under a SukiPay flow. Such an order has a SukiPay
// payment transaction, so it cancels through the OMS cancel saga (POST .../cancel) and
// owns the void/refund + compensation-reason data. A legacy flow (POS-OFFLINE,
// POS-OFFLINE-DELIVERY-LATER, POS-ONLINE) has no transaction — it cancels via a direct
// state change (PUT .../state) and has no refund concept.
//
// Keyed on the flow-name convention — every SukiPay flow is named "...-SUKIPAY-..."
// (POS-ONLINE-SUKIPAY-V1, POS-OFFLINE-SUKIPAY-PICKUP-INSTANT-V1, ...) — rather than a
// hardcoded enum list, so a future SukiPay flow (a -V2, a new fulfilment variant) is
// covered automatically with no edit here. It's the order's OWN flow that decides this,
// not the company payment mode: a SukiPay-mode company still falls back to a legacy flow
// whenever the chosen method isn't bank transfer, and those orders must cancel legacy.
export const isSukipayFlow = (flowType: string | undefined): boolean =>
	!!flowType && flowType.includes('SUKIPAY');

export enum PaymentType {
	Cash = 'cash',
	BankTransfer = 'bankTransfer',
	CreditCard = 'creditCard',
	DebitCard = 'debitCard',
	Cod = 'cod',
	Other = 'other',
	SukiPay = 'sukipay',
	Unknown = 'unknown'
}

export enum FullfilmentType {
	PickupImmediate = 'pickupImmediate',
	PickupLater = 'pickupLater',
	ShopDelivery = 'shopDelivery',
	// New sale-level fulfilment kinds (ให้บริการที่สถานที่ลูกค้า / จัดส่งเข้าระบบดิจิทัล) —
	// no backend OrderFlow routing exists for either yet, see order-flow.ts.
	OnSite = 'onSite',
	DigitalDelivery = 'digitalDelivery'
}

export enum Status {
	Pending = 'pending',
	Processing = 'processing',
	PartialCompleted = 'partial_completed',
	Completed = 'completed',
	Canceled = 'canceled',
	// Refund family — OMS statuses driven by PAT-2038.
	// `refunding` is set after InitiateCompensation while a paid order is being reversed
	// and precedes the terminal `canceled`; `refunded`/`voided` are terminal reversal
	// outcomes. The list row action treats all three as non-actionable.
	Refunding = 'refunding',
	Refunded = 'refunded',
	Voided = 'voided'
}

export enum PaymentState {
	Waitingforpayment = 'waiting_for_payment',
	Refunded = 'refunded',
	Paid = 'paid',
	Canceled = 'canceled'
}

/**
 * Sale channel as the cart presents it (OMS 2.0 "Universal checkout": POS / ONLINE /
 * LINK_BILL). The order payload still carries the two-value SaleChannelType below,
 * because the backend has no link-bill channel yet — so LINK_BILL maps to `online`
 * and its CTA stays disabled until the link-bill endpoint exists. Keep the two types
 * apart: this one drives the UI, SaleChannelType is what ships in sale_channel.type.
 */
export enum SaleChannelUI {
	Pos = 'POS',
	Online = 'ONLINE',
	LinkBill = 'LINK_BILL'
}

export enum SaleChannelType {
	Online = 'online',
	Offline = 'offline'
}

// Well-known `order.tasks[].name
export const saleChannelToPayload = (channel: SaleChannelUI): SaleChannelType =>
	channel === SaleChannelUI.Pos ? SaleChannelType.Offline : SaleChannelType.Online;

export enum OrderTaskName {
	Payments = 'payments'
}

export enum ShippingType {
	Standard = 'standard',
	SameDay = 'sameday'
}

export interface PartyInfo {
	name: string;
	refId?: string;
	taxId?: string;
	email?: string;
	phone?: string;
	address?: string;
	countryCode?: string;
	postcode?: string;
}

export interface Delivery {
	type?: ShippingType;
	courier?: string;
	method?: string;
	shippingFee?: number;
	remark?: string;
}

export interface SaleChannel {
	saleOrigin?: string;
	type?: SaleChannelType;
}

export interface PricingInfo {
	totalPrice?: number;
	netPrice?: number;
	receivedAmount?: number;
	details?: PricingDetail[];
}

export interface PricingDetail {
	kind: string;
	description?: string;
	amount?: number;
	pricing?: Pricing;
	metadata?: string;
}

export interface Pricing {
	type: string;
	value: number;
}

export interface Flow {
	revision?: number;
	type: string;
}

export interface CashierInfo {
	id?: string;
	kind?: string;
	name?: string;
	email?: string;
	storeName?: string;
}

export interface Variant {
	key: string;
	value: string;
}

export interface Item {
	productId: string;
	productName: string;
	sku?: string;
	originalPrice?: number;
	salePrice: number;
	qty: number;
	image?: string;
	variants?: Record<string, string>;
}

export interface Attributes {
	[key: string]: any;
}

export interface Task {
	taskId?: string;
	name?: string;
	state?: string;
	status?: string;
	attributes?: Attributes;
	subtask?: Task[];
	completedAt?: string;
	canceledAt?: string;
	/** free-text task note; on a cancelled order OMS stores the cancel-reason code here */
	remark?: string;
}

export interface Order {
	orderId?: string;
	orderSerial?: string;
	orderDocRef?: string;
	providerCode?: string;
	refs?: string[];
	flow: Flow;
	cashierInfo?: CashierInfo;
	state?: string;
	status?: string;
	saleChannel?: SaleChannel;
	buyer: PartyInfo;
	seller?: PartyInfo;
	tasks?: Task[];
	items: Item[];
	buyerStatement: PricingInfo;
	sellerStatement?: PricingInfo;
	createdAt?: string;
	paymentType?: string;
	deliveries?: Delivery[];
}

export interface TotalCount {
	total: number;
	totalPending: number;
	totalProcessing: number;
	totalPartialCompleted: number;
	totalCompleted: number;
	totalCanceled: number;
}

export const newOrder = (): Order => ({
	buyer: newPartyInfo(),
	seller: newPartyInfo(),
	buyerStatement: newPricingInfo(),
	flow: newFlow(),
	items: [newItem()],
	providerCode: providerCode,
	saleChannel: {
		saleOrigin: FullfilmentType.PickupImmediate,
		type: SaleChannelType.Offline
	},
	cashierInfo: {
		id: '',
		kind: '',
		name: '',
		email: ''
	}
});

export const newPartyInfo = (): PartyInfo => ({
	name: ''
});

export const newPricingInfo = (): PricingInfo => ({
	totalPrice: 0,
	netPrice: 0,
	receivedAmount: 0
});

export const newPricingDetail = (): PricingDetail => ({
	kind: ''
});

export const newPricing = (): Pricing => ({
	type: '',
	value: 0
});

export const newFlow = (): Flow => ({
	type: ''
});

export const newItem = (): Item => ({
	salePrice: 0,
	productId: '',
	productName: '',
	qty: 0
});

export enum Mode {
	Online = 'online',
	CustomerSelect = 'customer-select',
	CustomerCreate = 'customer-create',
	AddressCreate = 'address-create',
	AddressEdit = 'address-edit'
}

export type Option = {
	label: string;
	value: string;
	icon?: string;
};

export type DeliveryOption = Option & {
	type?: ShippingType;
};

export const salesChannels: Option[] = [
	{ label: 'ไม่ระบุ', value: 'unknown', icon: '' },
	{ label: 'LINE', value: 'line', icon: '/images/sales-channel/Line.svg' },
	{ label: 'Facebook', value: 'facebook', icon: '/images/sales-channel/Facebook.svg' },
	{ label: 'Instagram', value: 'instagram', icon: '/images/sales-channel/Instagram.svg' },
	{ label: 'Shopee', value: 'shopee', icon: '/images/sales-channel/Shopee.svg' },
	{ label: 'Lazada', value: 'lazada', icon: '/images/sales-channel/Lazada.svg' },
	{ label: 'TikTok Shop', value: 'tiktok', icon: '/images/sales-channel/TiktokShop.svg' },
	{ label: 'LINE SHOPPING', value: 'lineShopping', icon: '/images/sales-channel/LineShopping.svg' },
	{ label: 'Open-API', value: 'openApi', icon: '/images/sales-channel/Api.svg' }
];

export const paymentMethods: Option[] = [
	{ label: 'ไม่ระบุ', value: 'unknown' },
	{ label: 'โอนผ่านธนาคาร', value: 'bankTransfer' },
	{ label: 'COD', value: 'cod' },
	{ label: 'ชำระเงินผ่าน Shopee', value: 'shopee' },
	{ label: 'ชำระเงินผ่าน Lazada', value: 'lazada' },
	{ label: 'ชำระเงินผ่าน<br>TikTok Shop', value: 'tiktok' },
	{ label: 'ชำระเงินผ่าน<br>LINE SHOPPING', value: 'lineShopping' }
];

export const standardDeliveries: DeliveryOption[] = [
	{ label: 'ไม่ระบุ', value: 'unknown' },
	{ label: 'KEX Express', value: 'kex', icon: '/images/delivery/Kex.svg' },
	{ label: 'Flash Express', value: 'flash', icon: '/images/delivery/Flash.svg' },
	{ label: 'Thailand Post', value: 'thailandPost', icon: '/images/delivery/Thai.svg' },
	{ label: 'J&T', value: 'jnt', icon: '/images/delivery/J&T.svg' },
	{ label: 'จัดส่งโดย Shopee', value: 'shopee' },
	{ label: 'จัดส่งโดย Lazada', value: 'lazada' },
	{ label: 'จัดส่งโดย<br>TikTok Shop', value: 'tiktok' },
	{ label: 'จัดส่งโดย<br>LINE SHOPPING', value: 'lineShopping' }
];

export const sameDayDeliveries: DeliveryOption[] = [
	{ label: 'ไม่ระบุ', value: 'unknown' },
	{ label: 'Messenger', value: 'messenger', icon: '/images/delivery/Messenger.svg' },
	{ label: 'LINE MAN', value: 'lineMan', icon: '/images/delivery/LineMan.svg' },
	{ label: 'Grab', value: 'grab', icon: '/images/delivery/Grab.svg' },
	{ label: 'Lalamove', value: 'lalamove', icon: '/images/delivery/Lalamove.svg' },
	{ label: 'Deliveree', value: 'deliveree', icon: '/images/delivery/Deliveree.svg' },
	{ label: 'MakeSend', value: 'makesend', icon: '/images/delivery/MakeSend.svg' },
	{ label: 'Skootar', value: 'skootar', icon: '/images/delivery/Skootar.svg' }
];

// Same Day only — which vehicle the courier dispatches. No matching backend field exists
// yet (DeliveryGroup.vehicleType is frontend-only, see its own comment), so this stays a
// cashier-facing detail until an API field lands for it.
export const vehicleTypes: Option[] = [
	{ label: 'ไม่ระบุ', value: 'unknown' },
	{ label: 'มอเตอร์ไซค์', value: 'motorcycle' },
	{ label: 'รถยนต์', value: 'car' },
	{ label: 'รถกระบะ', value: 'pickup' },
	{ label: 'รถบรรทุกเล็ก', value: 'smallTruck' }
];
