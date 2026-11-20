// OMS 2.0 order-list view-model (DES-2235 / PAT-2306).
// FE-owned shape: no API contract exists yet (PAT-2617), so the list page reads this
// type and a mock source fills it. When the BE lands, only an adapter mapping the
// response into Oms2OrderRow is needed — the page should not change.

export enum Oms2OrderStatus {
	Created = 'created',
	Confirmed = 'confirmed',
	Preparing = 'preparing',
	ReadyToDeliver = 'ready_to_deliver',
	Delivering = 'delivering',
	Delivered = 'delivered',
	Completed = 'completed',
	Cancelled = 'cancelled',
	Reversed = 'reversed',
	Refunded = 'refunded',
	Unknown = 'unknown'
}

export enum Oms2PaymentStatus {
	Unpaid = 'unpaid',
	PendingReview = 'pending_review',
	PartiallyPaid = 'partially_paid',
	Paid = 'paid',
	CodPending = 'cod_pending', // รอเก็บเงินปลายทาง
	Overpaid = 'overpaid',
	Refunding = 'refunding',
	Refunded = 'refunded',
	Voided = 'voided'
}

export enum Oms2Tab {
	All = 'all',
	InProgress = 'in_progress',
	Completed = 'completed',
	Refund = 'refund',
	Cancelled = 'cancelled'
}

// Badge colour group only — the channel NAME always comes from data, never hardcoded.
export enum ChannelGroup {
	Store = 'store', // POS / หน้าร้าน
	Online = 'online', // marketplace, social, web
	Link = 'link' // link bill / chat commerce
}

export enum FulfillmentType {
	PickupNow = 'pickup_now',
	PickupLater = 'pickup_later',
	Shipping = 'shipping',
	Digital = 'digital',
	Service = 'service'
}

export enum StockState {
	Reserved = 'reserved', // จองครบ
	Partial = 'partial', // ยังไม่ครบ
	Deducted = 'deducted', // ตัดสต็อกแล้ว
	None = 'none' // "—"
}

// Row actions are decided by the BE; FE only renders them. No Deliver action in 2.0.
export enum Oms2RowAction {
	View = 'view',
	RecordPayment = 'record_payment',
	RecordCod = 'record_cod',
	ReviewSlip = 'review_slip'
}

export interface Oms2Channel {
	id: string;
	name: string;
	group: ChannelGroup;
}

export interface Oms2Fulfillment {
	types: FulfillmentType[]; // distinct types; length > 1 → "หลายวิธี (N)"
	shippingGroups: number; // > 1 → "จัดส่งตามที่อยู่ (N กลุ่ม)"
}

export interface Oms2Payment {
	id: string;
	amount: number;
	method: string;
	status: Oms2PaymentStatus;
	paidAt: string;
}

export interface Oms2OrderRow {
	id: string;
	serial: string;
	customerName: string;
	channel: Oms2Channel;
	total: number;
	paymentStatus: Oms2PaymentStatus;
	status: Oms2OrderStatus;
	fulfillment: Oms2Fulfillment;
	stock: StockState;
	actions: Oms2RowAction[];
	payments: Oms2Payment[];
	createdAt: string;
}

export const TAB_STATUSES: Record<Oms2Tab, Oms2OrderStatus[] | null> = {
	[Oms2Tab.All]: null,
	[Oms2Tab.InProgress]: [
		Oms2OrderStatus.Created,
		Oms2OrderStatus.Confirmed,
		Oms2OrderStatus.Preparing,
		Oms2OrderStatus.ReadyToDeliver,
		Oms2OrderStatus.Delivering,
		Oms2OrderStatus.Delivered
	],
	[Oms2Tab.Completed]: [Oms2OrderStatus.Completed],
	[Oms2Tab.Refund]: [Oms2OrderStatus.Reversed, Oms2OrderStatus.Refunded],
	[Oms2Tab.Cancelled]: [Oms2OrderStatus.Cancelled]
};

// Unknown statuses fall into "All" only; the page shows a banner for them.
export const statusInTab = (status: Oms2OrderStatus, tab: Oms2Tab): boolean => {
	const allowed = TAB_STATUSES[tab];
	return allowed === null || allowed.includes(status);
};

export const toOrderStatus = (raw?: string): Oms2OrderStatus =>
	(Object.values(Oms2OrderStatus) as string[]).includes(raw ?? '')
		? (raw as Oms2OrderStatus)
		: Oms2OrderStatus.Unknown;

export type FulfillmentLabel =
	| { kind: 'single'; type: FulfillmentType }
	| { kind: 'multi'; count: number }
	| { kind: 'groups'; count: number }
	| { kind: 'none' };

export const fulfillmentLabel = (f: Oms2Fulfillment): FulfillmentLabel => {
	if (f.types.length > 1) return { kind: 'multi', count: f.types.length };
	if (f.types.length === 0) return { kind: 'none' };
	if (f.types[0] === FulfillmentType.Shipping && f.shippingGroups > 1)
		return { kind: 'groups', count: f.shippingGroups };
	return { kind: 'single', type: f.types[0] };
};

export interface Oms2ListQuery {
	tab: Oms2Tab;
	page: number;
	rows: number;
	sort: 'asc' | 'desc';
	search?: string;
	startDate?: string;
	endDate?: string;
	channels?: string[];
	paymentStatuses?: Oms2PaymentStatus[];
	fulfillments?: FulfillmentType[];
	statuses?: Oms2OrderStatus[];
	stocks?: StockState[];
}

export interface Oms2ListResult {
	rows: Oms2OrderRow[];
	total: number;
	tabCounts: Record<Oms2Tab, number>;
	unknownCount: number;
}
