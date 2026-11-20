// Mock source for the OMS 2.0 order list — bypasses the real API until PAT-2617 lands.
// Filtering/pagination/tab counts are done client-side so the page behaves as if a
// server answered. Swap `listOms2Orders` for a real adapter later; keep the signature.
import {
	ChannelGroup,
	FulfillmentType,
	Oms2OrderStatus,
	Oms2PaymentStatus,
	Oms2RowAction,
	Oms2Tab,
	StockState,
	TAB_STATUSES,
	statusInTab,
	type Oms2Channel,
	type Oms2ListQuery,
	type Oms2ListResult,
	type Oms2OrderRow
} from '$lib/entities/order/oms2-order-list';

// Every channel the sale page can produce: POS (per branch), ออนไลน์ × each sub-channel
// in `salesChannels` (order.ts — same labels + logos), and ลิงก์ (Link Bill).
const LOGO = '/images/sales-channel';
const online = (source: string, name: string, logo?: string): Oms2Channel => ({
	id: `ch-${source}`,
	name,
	group: ChannelGroup.Online,
	source,
	logo: logo ? `${LOGO}/${logo}` : undefined
});
const CH: Record<string, Oms2Channel> = {
	pos: { id: 'ch-pos-siam', name: 'POS สาขาสยาม', group: ChannelGroup.Store },
	posAri: { id: 'ch-pos-ari', name: 'POS สาขาอารีย์', group: ChannelGroup.Store },
	line: online('line', 'LINE', 'Line.svg'),
	web: online('facebook', 'Facebook', 'Facebook.svg'),
	instagram: online('instagram', 'Instagram', 'Instagram.svg'),
	shopee: online('shopee', 'Shopee', 'Shopee.svg'),
	lazada: online('lazada', 'Lazada', 'Lazada.svg'),
	tiktok: online('tiktok', 'TikTok Shop', 'TiktokShop.svg'),
	lineShopping: online('lineShopping', 'LINE SHOPPING', 'LineShopping.svg'),
	openApi: online('openApi', 'Open-API', 'Api.svg'),
	onlineUnknown: online('unknown', 'ออนไลน์ (ไม่ระบุ)'),
	link: { id: 'ch-link', name: 'ลิงก์', group: ChannelGroup.Link }
};

const F = FulfillmentType;
const P = Oms2PaymentStatus;
const S = Oms2OrderStatus;
const K = StockState;
const A = Oms2RowAction;

const day = (n: number) => new Date(Date.UTC(2026, 10, 20 - n, 3, 15)).toISOString();
const pay = (id: string, amount: number, method: string, status: Oms2PaymentStatus, d: number) => ({
	id,
	amount,
	method,
	status,
	paidAt: day(d)
});

type Seed = Omit<Oms2OrderRow, 'createdAt'> & { daysAgo: number };

const SEEDS: Seed[] = [
	{
		id: 'o1',
		serial: 'SO-2611-0001',
		customerName: 'สมชาย ใจดี',
		channel: CH.pos,
		total: 1290,
		paymentStatus: Oms2PaymentStatus.Paid,
		status: Oms2OrderStatus.Completed,
		fulfillment: { types: [FulfillmentType.PickupNow], shippingGroups: 0 },
		stock: StockState.Deducted,
		actions: [Oms2RowAction.View],
		payments: [pay('p1', 1290, 'cash', Oms2PaymentStatus.Paid, 0)],
		daysAgo: 0
	},
	{
		id: 'o2',
		serial: 'SO-2611-0002',
		customerName: 'Nok Shop',
		channel: CH.shopee,
		total: 4580,
		paymentStatus: Oms2PaymentStatus.CodPending,
		status: Oms2OrderStatus.Delivering,
		fulfillment: { types: [FulfillmentType.Shipping], shippingGroups: 1 },
		stock: StockState.Deducted,
		actions: [Oms2RowAction.RecordCod],
		payments: [],
		daysAgo: 1
	},
	{
		id: 'o3',
		serial: 'SO-2611-0003',
		customerName: 'วิภา รักษ์ดี',
		channel: CH.line,
		total: 2350,
		paymentStatus: Oms2PaymentStatus.PendingReview,
		status: Oms2OrderStatus.Confirmed,
		fulfillment: { types: [FulfillmentType.Shipping], shippingGroups: 3 },
		stock: StockState.Reserved,
		actions: [Oms2RowAction.ReviewSlip],
		payments: [pay('p3', 2350, 'transfer', Oms2PaymentStatus.PendingReview, 1)],
		daysAgo: 1
	},
	{
		id: 'o4',
		serial: 'SO-2611-0004',
		customerName: 'ธนา มั่งมี',
		channel: CH.pos,
		total: 8900,
		paymentStatus: Oms2PaymentStatus.PartiallyPaid,
		status: Oms2OrderStatus.Preparing,
		fulfillment: {
			types: [FulfillmentType.PickupLater, FulfillmentType.Shipping, FulfillmentType.Digital],
			shippingGroups: 1
		},
		stock: StockState.Partial,
		actions: [Oms2RowAction.RecordPayment],
		payments: [pay('p4', 3000, 'cash', Oms2PaymentStatus.Paid, 2)],
		daysAgo: 2
	},
	{
		id: 'o5',
		serial: 'SO-2611-0005',
		customerName: 'มาลี ศรีสุข',
		channel: CH.lazada,
		total: 990,
		paymentStatus: Oms2PaymentStatus.Refunded,
		status: Oms2OrderStatus.Refunded,
		fulfillment: { types: [FulfillmentType.Shipping], shippingGroups: 1 },
		stock: StockState.None,
		actions: [Oms2RowAction.View],
		payments: [
			pay('p5a', 990, 'card', Oms2PaymentStatus.Paid, 5),
			pay('p5b', -990, 'card', Oms2PaymentStatus.Refunded, 3)
		],
		daysAgo: 5
	},
	{
		id: 'o6',
		serial: 'SO-2611-0006',
		customerName: 'ปกรณ์ ทองคำ',
		channel: CH.web,
		total: 1500,
		paymentStatus: Oms2PaymentStatus.Voided,
		status: Oms2OrderStatus.Cancelled,
		fulfillment: { types: [FulfillmentType.Digital], shippingGroups: 0 },
		stock: StockState.None,
		actions: [Oms2RowAction.View],
		payments: [],
		daysAgo: 6
	},
	{
		id: 'o7',
		serial: 'SO-2611-0007',
		customerName: 'ลูกค้าทั่วไป',
		channel: CH.pos,
		total: 350,
		paymentStatus: Oms2PaymentStatus.Unpaid,
		status: Oms2OrderStatus.Unknown,
		fulfillment: { types: [FulfillmentType.Service], shippingGroups: 0 },
		stock: StockState.None,
		actions: [Oms2RowAction.View],
		payments: [],
		daysAgo: 3
	},
	{
		id: 'o8',
		serial: 'SO-2611-0008',
		customerName: 'ชไมพร ใจงาม',
		channel: CH.shopee,
		total: 2190,
		paymentStatus: Oms2PaymentStatus.Refunding,
		status: Oms2OrderStatus.Reversed,
		fulfillment: { types: [FulfillmentType.Shipping], shippingGroups: 1 },
		stock: StockState.Reserved,
		actions: [Oms2RowAction.View],
		payments: [pay('p8', 2190, 'transfer', Oms2PaymentStatus.Paid, 4)],
		daysAgo: 4
	},
	{
		id: 'o9',
		serial: 'SO-2611-0009',
		customerName: 'อนันต์ สุขใจ',
		channel: CH.line,
		total: 640,
		paymentStatus: Oms2PaymentStatus.Unpaid,
		status: Oms2OrderStatus.Created,
		fulfillment: { types: [FulfillmentType.PickupLater], shippingGroups: 0 },
		stock: StockState.Reserved,
		actions: [Oms2RowAction.RecordPayment],
		payments: [],
		daysAgo: 0
	},
	{
		id: 'o10',
		serial: 'SO-2611-0010',
		customerName: 'Kanda Store',
		channel: CH.web,
		total: 5120,
		paymentStatus: Oms2PaymentStatus.Overpaid,
		status: Oms2OrderStatus.ReadyToDeliver,
		fulfillment: { types: [FulfillmentType.Shipping], shippingGroups: 2 },
		stock: StockState.Deducted,
		actions: [Oms2RowAction.View],
		payments: [pay('p10', 5200, 'transfer', Oms2PaymentStatus.Paid, 2)],
		daysAgo: 2
	},
	{
		id: 'o11',
		serial: 'SO-2611-0011',
		customerName: 'ประยุทธ เดินดี',
		channel: CH.lazada,
		total: 780,
		paymentStatus: Oms2PaymentStatus.Paid,
		status: Oms2OrderStatus.Delivered,
		fulfillment: { types: [FulfillmentType.Shipping], shippingGroups: 1 },
		stock: StockState.Deducted,
		actions: [Oms2RowAction.View],
		payments: [pay('p11', 780, 'card', Oms2PaymentStatus.Paid, 7)],
		daysAgo: 7
	}
];

// Coverage set for PO review: every channel × every fulfilment combination the sale
// page allows (POS: all 5 + partial receive; ออนไลน์: ship/digital/service mixes;
// ลิงก์: ship/digital/pickup-later). Kept to statuses that don't disturb the
// targeted cases above (one unknown, one COD-pending, refund tab = o5 + o8).
type Extra = [
	n: number,
	customer: string,
	channel: Oms2Channel,
	types: FulfillmentType[],
	groups: number,
	total: number,
	payment: Oms2PaymentStatus,
	status: Oms2OrderStatus,
	stock: StockState,
	action: Oms2RowAction,
	daysAgo: number
];
const EXTRAS: Extra[] = [
	// POS — single methods
	[
		12,
		'ศิริพร แก้วใส',
		CH.posAri,
		[F.PickupLater],
		0,
		1590,
		P.Unpaid,
		S.Created,
		K.Reserved,
		A.RecordPayment,
		0
	],
	[
		13,
		'วีระ ทองดี',
		CH.pos,
		[F.Shipping],
		1,
		2890,
		P.Paid,
		S.ReadyToDeliver,
		K.Deducted,
		A.View,
		1
	],
	[14, 'ร้านกาแฟบ้านสวน', CH.posAri, [F.Service], 0, 3500, P.Paid, S.Confirmed, K.None, A.View, 1],
	[15, 'ณัฐวุฒิ ใจกว้าง', CH.pos, [F.Digital], 0, 499, P.Paid, S.Completed, K.None, A.View, 2],
	[
		16,
		'บริษัท สยามเทค จำกัด',
		CH.pos,
		[F.Shipping],
		4,
		18900,
		P.PartiallyPaid,
		S.Preparing,
		K.Partial,
		A.RecordPayment,
		2
	],
	// POS — mixes (partial receive / digital split / service)
	[
		17,
		'ปิยะนุช รุ่งเรือง',
		CH.pos,
		[F.PickupNow, F.Digital],
		0,
		2190,
		P.Paid,
		S.Completed,
		K.Deducted,
		A.View,
		3
	],
	[
		18,
		'อรุณ สว่างจิต',
		CH.posAri,
		[F.PickupNow, F.Service],
		0,
		5400,
		P.PartiallyPaid,
		S.Preparing,
		K.Deducted,
		A.RecordPayment,
		3
	],
	[
		19,
		'กมล ศรีงาม',
		CH.pos,
		[F.PickupNow, F.Shipping],
		1,
		3250,
		P.Paid,
		S.Delivering,
		K.Deducted,
		A.View,
		4
	],
	[
		20,
		'สุภาวดี มีสุข',
		CH.posAri,
		[F.PickupNow, F.PickupLater],
		0,
		1780,
		P.Paid,
		S.ReadyToDeliver,
		K.Reserved,
		A.View,
		4
	],
	[
		21,
		'ร้านวัสดุเจริญ',
		CH.pos,
		[F.PickupNow, F.PickupLater, F.Shipping, F.Digital, F.Service],
		2,
		24750,
		P.PartiallyPaid,
		S.Preparing,
		K.Partial,
		A.RecordPayment,
		5
	],
	// ออนไลน์ — every sub-channel
	[
		22,
		'May Studio',
		CH.instagram,
		[F.Shipping, F.Digital],
		1,
		1650,
		P.Paid,
		S.Delivering,
		K.Deducted,
		A.View,
		1
	],
	[23, 'ธีรพงษ์ ขยัน', CH.tiktok, [F.Shipping], 1, 890, P.Paid, S.Delivered, K.Deducted, A.View, 2],
	[
		24,
		'ชลธิชา บุญมา',
		CH.lineShopping,
		[F.Shipping, F.Digital],
		2,
		3120,
		P.PendingReview,
		S.Confirmed,
		K.Reserved,
		A.ReviewSlip,
		2
	],
	[25, 'Partner API #12', CH.openApi, [F.Digital], 0, 299, P.Paid, S.Completed, K.None, A.View, 3],
	[
		26,
		'คุณเอ (ไม่ระบุช่องทาง)',
		CH.onlineUnknown,
		[F.Shipping, F.Service],
		1,
		4200,
		P.Unpaid,
		S.Created,
		K.Reserved,
		A.RecordPayment,
		3
	],
	[
		27,
		'จิราพร วงศ์ใหญ่',
		CH.web,
		[F.Shipping],
		3,
		6780,
		P.Paid,
		S.Preparing,
		K.Reserved,
		A.View,
		4
	],
	[28, 'ภาณุ แสงทอง', CH.line, [F.Service], 0, 2500, P.Paid, S.Confirmed, K.None, A.View, 5],
	// ลิงก์ (Link Bill)
	[
		29,
		'ลูกค้าลิงก์ 0812',
		CH.link,
		[F.Shipping],
		1,
		1350,
		P.Unpaid,
		S.Created,
		K.Reserved,
		A.RecordPayment,
		0
	],
	[30, 'สมหญิง ดีใจ', CH.link, [F.Digital], 0, 199, P.Paid, S.Completed, K.None, A.View, 1],
	[
		31,
		'ครัวคุณแม่',
		CH.link,
		[F.Shipping, F.PickupLater],
		1,
		2760,
		P.Paid,
		S.ReadyToDeliver,
		K.Reserved,
		A.View,
		2
	]
];

const extraSeed = ([
	n,
	customer,
	channel,
	types,
	groups,
	total,
	payment,
	status,
	stock,
	action,
	daysAgo
]: Extra): Seed => {
	const paid = payment === P.Paid ? total : payment === P.PartiallyPaid ? Math.round(total / 2) : 0;
	return {
		id: `o${n}`,
		serial: `SO-2611-${String(n).padStart(4, '0')}`,
		customerName: customer,
		channel,
		total,
		paymentStatus: payment,
		status,
		fulfillment: { types, shippingGroups: groups },
		stock,
		actions: [action],
		payments:
			payment === P.PendingReview
				? [pay(`p${n}`, total, 'transfer', P.PendingReview, daysAgo)]
				: paid
					? [pay(`p${n}`, paid, n % 2 ? 'transfer' : 'cash', P.Paid, daysAgo)]
					: [],
		daysAgo
	};
};

SEEDS.push(...EXTRAS.map(extraSeed));

export const MOCK_OMS2_ORDERS: Oms2OrderRow[] = SEEDS.map(({ daysAgo, ...r }) => ({
	...r,
	createdAt: day(daysAgo)
}));

const anyOf = <T>(want: T[] | undefined, have: T[]) =>
	!want?.length || want.some((w) => have.includes(w));

// Everything except the tab — tab counts must respect the other filters.
const matchesFilters = (o: Oms2OrderRow, q: Oms2ListQuery): boolean => {
	const s = q.search?.trim().toLowerCase();
	if (s && !o.serial.toLowerCase().includes(s) && !o.customerName.toLowerCase().includes(s))
		return false;
	// Picker sends ISO timestamps at local midnight; end date is inclusive of the whole day.
	const t = Date.parse(o.createdAt);
	if (q.startDate && t < Date.parse(q.startDate)) return false;
	if (q.endDate && t >= Date.parse(q.endDate) + 86_400_000) return false;
	return (
		anyOf(q.channels, [o.channel.id]) &&
		anyOf(q.paymentStatuses, [o.paymentStatus]) &&
		anyOf(q.fulfillments, o.fulfillment.types) &&
		anyOf(q.statuses, [o.status]) &&
		anyOf(q.stocks, [o.stock])
	);
};

export function queryOms2Orders(
	q: Oms2ListQuery,
	source: Oms2OrderRow[] = MOCK_OMS2_ORDERS
): Oms2ListResult {
	const filtered = source.filter((o) => matchesFilters(o, q));
	const tabCounts = Object.fromEntries(
		(Object.keys(TAB_STATUSES) as Oms2Tab[]).map((t) => [
			t,
			filtered.filter((o) => statusInTab(o.status, t)).length
		])
	) as Record<Oms2Tab, number>;
	const inTab = filtered
		.filter((o) => statusInTab(o.status, q.tab))
		.sort((a, b) =>
			q.sort === 'asc'
				? a.createdAt.localeCompare(b.createdAt)
				: b.createdAt.localeCompare(a.createdAt)
		);
	const start = (Math.max(q.page, 1) - 1) * q.rows;
	return {
		rows: inTab.slice(start, start + q.rows),
		total: inTab.length,
		tabCounts,
		unknownCount: filtered.filter((o) => o.status === Oms2OrderStatus.Unknown).length
	};
}

// Async seam the page calls; small delay so skeleton states are exercisable.
// Demo switch: add `?mock=error` or `?mock=empty` to the URL to see those states.
// Read once at module load: the list page rewrites the query string on mount, which
// would otherwise drop `mock` before the first fetch.
const MOCK_MODE: string =
	typeof window === 'undefined'
		? ''
		: new URLSearchParams(window.location.search).get('mock') ?? '';

export async function listOms2Orders(q: Oms2ListQuery, delayMs = 600): Promise<Oms2ListResult> {
	await new Promise((r) => setTimeout(r, delayMs));
	const mode = MOCK_MODE;
	if (mode === 'error') throw new Error('mock: order list unavailable');
	return queryOms2Orders(q, mode === 'empty' ? [] : MOCK_OMS2_ORDERS);
}

// Distinct channels present in data — feeds the channel filter instead of a hardcoded list.
export const mockOms2Channels = (): Oms2Channel[] => [
	...new Map(MOCK_OMS2_ORDERS.map((o) => [o.channel.id, o.channel])).values()
];
