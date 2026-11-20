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

const CH: Record<string, Oms2Channel> = {
	pos: { id: 'ch-pos', name: 'หน้าร้าน สาขาสยาม', group: ChannelGroup.Store },
	shopee: { id: 'ch-shopee', name: 'Shopee', group: ChannelGroup.Online },
	lazada: { id: 'ch-lazada', name: 'Lazada', group: ChannelGroup.Online },
	line: { id: 'ch-line', name: 'LINE OA', group: ChannelGroup.Link },
	web: { id: 'ch-web', name: 'เว็บไซต์', group: ChannelGroup.Online }
};

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
