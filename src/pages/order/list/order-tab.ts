// OMS 2.0 order-list tabs + status/payment badge presentation (DES-2235).
// Tab → status mapping itself lives with the entity (TAB_STATUSES) so the mock and
// a future adapter share it; this file is purely the page's presentation config.
import {
	ChannelGroup,
	FulfillmentStep,
	FulfillmentType,
	WARN_STEPS,
	StockState,
	fulfillmentLabel,
	type Oms2Channel,
	type Oms2Fulfillment,
	Oms2OrderStatus,
	Oms2PaymentStatus,
	Oms2RowAction,
	Oms2Tab
} from '$lib/entities/order/oms2-order-list';

export type OrderTabConfig = {
	tab: Oms2Tab;
	i18nKey: string;
	testIdHeader: string;
	testIdCounter: string;
	badgeColor: string;
	showCounter?: boolean;
};

export const ORDER_TABS: OrderTabConfig[] = [
	{
		tab: Oms2Tab.All,
		i18nKey: 'patona-sellercenter-myorder-tab-all',
		testIdHeader: 'orders.tab.total',
		testIdCounter: 'orders.total.text.counter',
		badgeColor: 'primary'
	},
	{
		tab: Oms2Tab.InProgress,
		i18nKey: 'patona-sellercenter-myorder-tab-inprogress',
		testIdHeader: 'orders.tab.inprogress',
		testIdCounter: 'orders.inprogress.text.counter',
		badgeColor: 'sky',
		showCounter: true
	},
	{
		tab: Oms2Tab.Completed,
		i18nKey: 'patona-sellercenter-myorder-tab-completed',
		testIdHeader: 'orders.tab.success',
		testIdCounter: 'orders.success.text.counter',
		badgeColor: 'success'
	},
	{
		tab: Oms2Tab.Refund,
		i18nKey: 'oms.order.tab.refund',
		testIdHeader: 'orders.tab.refund',
		testIdCounter: 'orders.refund.text.counter',
		badgeColor: 'warning',
		showCounter: true
	},
	{
		tab: Oms2Tab.Cancelled,
		i18nKey: 'patona-sellercenter-myorder-tab-canceled',
		testIdHeader: 'orders.tab.cancel',
		testIdCounter: 'orders.cancel.text.counter',
		badgeColor: 'gray'
	}
];

export const toOms2Tab = (raw?: string): Oms2Tab =>
	(Object.values(Oms2Tab) as string[]).includes(raw ?? '') ? (raw as Oms2Tab) : Oms2Tab.All;

export const orderStatusKey = (s: Oms2OrderStatus) => `oms.order.status.${s}`;
export const paymentStatusKey = (s: Oms2PaymentStatus) => `oms.order.payment.${s}`;
export const rowActionKey = (a: Oms2RowAction) => `oms.order.action.${a}`;

export const orderStatusTheme = (s: Oms2OrderStatus): string => {
	switch (s) {
		case Oms2OrderStatus.Completed:
			return 'success';
		case Oms2OrderStatus.Cancelled:
		case Oms2OrderStatus.Unknown:
			return 'gray';
		case Oms2OrderStatus.Reversed:
		case Oms2OrderStatus.Refunded:
			return 'warning';
		default:
			return 'sky';
	}
};

export const paymentStatusTheme = (s: Oms2PaymentStatus): string => {
	switch (s) {
		case Oms2PaymentStatus.Paid:
		case Oms2PaymentStatus.Refunded:
			return 'success';
		case Oms2PaymentStatus.Voided:
			return 'gray';
		case Oms2PaymentStatus.Overpaid:
			return 'sky';
		default:
			return 'warning';
	}
};

// Channel badge: 3 colour groups only; the label is always channel.name from data.
export const channelGroupTheme = (g: ChannelGroup): string =>
	({
		[ChannelGroup.Store]: 'primary',
		[ChannelGroup.Online]: 'sky',
		[ChannelGroup.Link]: 'success'
	})[g] ?? 'gray';

export const stockKey = (s: StockState) => `oms.order.stock.${s}`;
export const stockTheme = (s: StockState): string =>
	({
		[StockState.Reserved]: 'success',
		[StockState.Partial]: 'warning',
		[StockState.Deducted]: 'gray',
		[StockState.None]: 'gray'
	})[s];

// i18n key + optional count to append, e.g. "หลายวิธี" + " (3)".
export const fulfillmentDisplay = (f: Oms2Fulfillment): { key: string; count?: number } => {
	const l = fulfillmentLabel(f);
	switch (l.kind) {
		case 'multi':
			return { key: 'oms.order.fulfillment.multi', count: l.count };
		case 'single':
			return { key: `oms.order.fulfillment.${l.type}` };
		default:
			return { key: '' };
	}
};

// Same icon vocabulary as the sale cart (groupKindIcon in delivery-group.ts).
export const FULFILLMENT_ICON: Record<FulfillmentType, string> = {
	[FulfillmentType.PickupNow]: 'outline-shopping-bag',
	[FulfillmentType.PickupLater]: 'outline-clock',
	[FulfillmentType.Shipping]: 'outline-truck',
	[FulfillmentType.Digital]: 'outline-bolt',
	[FulfillmentType.Service]: 'outline-wrench-screwdriver'
};

export type FulfillmentBadge = {
	type: FulfillmentType;
	icon: string;
	key: string;
};

// One badge per distinct method, in data order. The cell shows the first and a "+N"
// chip; tapping expands the rest (touch-first — no hover-only disclosure).
export const fulfillmentBadges = (f: Oms2Fulfillment): FulfillmentBadge[] =>
	f.types.map((type) => ({
		type,
		icon: FULFILLMENT_ICON[type],
		key: `oms.order.fulfillment.${type}`
	}));

// Same icons as the sale page channel switcher (Cart.svelte channel options).
export const CHANNEL_GROUP_ICON: Record<ChannelGroup, string> = {
	[ChannelGroup.Store]: 'outline-building-storefront',
	[ChannelGroup.Online]: 'outline-globe-alt',
	[ChannelGroup.Link]: 'outline-link'
};

// Channel pill colour. Online sub-channels use their brand colour (third-party brand
// colours have no DS token, so they live here as data); POS / ลิงก์ / unknown use DS tokens.
const CHANNEL_BRAND_COLOR: Record<string, string> = {
	line: '#06C755',
	lineShopping: '#06C755',
	facebook: '#1877F2',
	instagram: '#E1306C',
	shopee: '#EE4D2D',
	lazada: '#0F146D',
	tiktok: '#111111',
	openApi: 'var(--ssk-colors-gray-500)',
	unknown: 'var(--ssk-colors-gray-400)'
};

export const channelColor = (c: Oms2Channel): string => {
	// PO U8: POS uses a neutral colour so it never reads like Shopee's orange.
	if (c.group === ChannelGroup.Store) return 'var(--ssk-colors-gray-700)';
	if (c.group === ChannelGroup.Link) return 'var(--ssk-colors-sky-500, #0EA5E9)';
	return CHANNEL_BRAND_COLOR[c.source ?? 'unknown'] ?? CHANNEL_BRAND_COLOR.unknown;
};

// Per-group step label (PO Q10) and warning flag (PO Q4).
export const stepKey = (s: FulfillmentStep) => `oms.order.step.${s}`;
export const isWarnStep = (s?: FulfillmentStep) => !!s && WARN_STEPS.includes(s);
