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

// Mirrors the sale page's 3 channels (SaleChannelUI: POS / ONLINE / LINK_BILL).
// Drives badge colour + icon only — the channel NAME always comes from data.
export enum ChannelGroup {
	Store = 'store', // POS (หน้าร้าน) — one channel per branch; shown as just "POS" (list is branch-scoped)
	Online = 'online', // ออนไลน์ — sub-channel: LINE, Facebook, Shopee, TikTok Shop ...
	Link = 'link' // ลิงก์ (Link Bill)
}

// Mirrors the sale page's fulfilment kinds (FullfilmentType / DeliveryGroupKind):
// PickupNow=PickupImmediate|PickupInStore, PickupLater, Shipping=ShopDelivery,
// Digital=DigitalDelivery, Service=OnSite.
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

// Row actions are decided by the BE; FE only renders them. PO (DES-2235 Q13): the list
// only carries money actions — every task step is advanced on the order detail page.
export enum Oms2RowAction {
	View = 'view',
	RecordPayment = 'record_payment',
	RecordCod = 'record_cod'
}

// Per-group task step, from the FigJam fulfilment task templates (one vocabulary for all
// 5 types; each type only uses its own subset). Shown when a row is expanded (PO Q10).
export enum FulfillmentStep {
	Queued = 'queued',
	PickupAtStore = 'pickup_at_store', // รับทันที: ยื่นของให้ลูกค้า
	Preparing = 'preparing',
	ReadyForPickup = 'ready_for_pickup',
	PickedUpAtStore = 'pickedup_at_store',
	Packed = 'packed',
	Shipped = 'shipped',
	Delivered = 'delivered',
	Issuing = 'issuing', // ดิจิทัล: ออก license
	Revoked = 'revoked',
	Scheduled = 'scheduled', // บริการ: นัดแล้ว
	InProgress = 'in_progress',
	Done = 'done',
	NoShow = 'no_show',
	ServiceInterrupted = 'service_interrupted',
	Returning = 'returning',
	Returned = 'returned',
	Reversed = 'reversed',
	Cancelled = 'cancelled'
}

// Steps the list highlights in a warning colour (PO Q4) — the order status alone
// ("พร้อมส่งมอบ" / "กำลังจัดส่ง") doesn't reveal that something went wrong.
export const WARN_STEPS: FulfillmentStep[] = [
	FulfillmentStep.NoShow,
	FulfillmentStep.ServiceInterrupted
];

// "งานที่ต้องทำต่อ" filter (PO Q16), replaces the proposed queue chips.
export enum NextAction {
	AwaitingPayment = 'awaiting_payment', // รอชำระเงิน
	AwaitingDelivery = 'awaiting_delivery', // รอส่งมอบ
	AwaitingCod = 'awaiting_cod', // รอรับเงิน COD
	AwaitingStock = 'awaiting_stock', // รอสต็อก
	NeedsAttention = 'needs_attention' // ต้องตรวจดู
}

export interface Oms2Channel {
	id: string;
	name: string;
	group: ChannelGroup;
	// Online sub-channel key — same values as the sale page's `salesChannels` (order.ts):
	// line, facebook, instagram, shopee, lazada, tiktok, lineShopping, openApi, unknown.
	source?: string;
	// Online sub-channel logo, same assets the sale page uses (salesChannels in order.ts,
	// /images/sales-channel/*.svg). POS / ลิงก์ use the group icon instead.
	logo?: string;
}

export interface Oms2Fulfillment {
	types: FulfillmentType[]; // distinct types; length > 1 → "หลายวิธี (N)"
	shippingGroups: number; // detail page only — the list shows method count, not address groups
	// Current task step per type (the slowest group of that type). Optional so a row
	// without step data still renders.
	steps?: Partial<Record<FulfillmentType, FulfillmentStep>>;
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

// Tab membership for a row. The refund tab also holds orders whose refund is in flight
// (PO U4): payment "refunding" keeps the order status unchanged, so status alone misses them.
export const orderInTab = (
	o: { status: Oms2OrderStatus; paymentStatus: Oms2PaymentStatus },
	tab: Oms2Tab
): boolean =>
	statusInTab(o.status, tab) ||
	(tab === Oms2Tab.Refund && o.paymentStatus === Oms2PaymentStatus.Refunding);

const PRE_DELIVERY: Oms2OrderStatus[] = [
	Oms2OrderStatus.Confirmed,
	Oms2OrderStatus.Preparing,
	Oms2OrderStatus.ReadyToDeliver
];
const CLOSED: Oms2OrderStatus[] = [
	Oms2OrderStatus.Completed,
	Oms2OrderStatus.Cancelled,
	Oms2OrderStatus.Reversed,
	Oms2OrderStatus.Refunded
];

export const hasWarnStep = (f: Oms2Fulfillment): boolean =>
	Object.values(f.steps ?? {}).some((s) => s && WARN_STEPS.includes(s));

// Which "งานที่ต้องทำต่อ" buckets a row falls in (a row can be in several).
export const nextActionsOf = (o: Oms2OrderRow): NextAction[] => {
	const out: NextAction[] = [];
	const open = !CLOSED.includes(o.status);
	if (
		open &&
		[
			Oms2PaymentStatus.Unpaid,
			Oms2PaymentStatus.PendingReview,
			Oms2PaymentStatus.PartiallyPaid
		].includes(o.paymentStatus)
	)
		out.push(NextAction.AwaitingPayment);
	if (PRE_DELIVERY.includes(o.status)) out.push(NextAction.AwaitingDelivery);
	if (o.paymentStatus === Oms2PaymentStatus.CodPending) out.push(NextAction.AwaitingCod);
	if (open && o.stock === StockState.Partial) out.push(NextAction.AwaitingStock);
	// Assumption (to confirm with PO): "ต้องตรวจดู" = unknown status, slip waiting for
	// review, or a service group stuck on no-show / interruption.
	if (
		o.status === Oms2OrderStatus.Unknown ||
		o.paymentStatus === Oms2PaymentStatus.PendingReview ||
		hasWarnStep(o.fulfillment)
	)
		out.push(NextAction.NeedsAttention);
	return out;
};

export const toOrderStatus = (raw?: string): Oms2OrderStatus =>
	(Object.values(Oms2OrderStatus) as string[]).includes(raw ?? '')
		? (raw as Oms2OrderStatus)
		: Oms2OrderStatus.Unknown;

export type FulfillmentLabel =
	| { kind: 'single'; type: FulfillmentType }
	| { kind: 'multi'; count: number }
	| { kind: 'none' };

export const fulfillmentLabel = (f: Oms2Fulfillment): FulfillmentLabel => {
	if (f.types.length > 1) return { kind: 'multi', count: f.types.length };
	if (f.types.length === 0) return { kind: 'none' };
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
	nextActions?: NextAction[];
}

export interface Oms2ListResult {
	rows: Oms2OrderRow[];
	total: number;
	tabCounts: Record<Oms2Tab, number>;
	unknownCount: number;
}
