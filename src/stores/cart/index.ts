export type discountType = 'percentage' | 'fixed';
export type TCartListInfo = {
	data: TCartItem[];
	totalPrice: number;
	summaryPrice: number;
	discount: {
		type: discountType;
		value: number;
		/**
		 * The discount code the amount came from, when one was used. Carried so the order
		 * records WHY it was discounted, not just by how much — it rides to the backend in
		 * the discount PricingDetail's description/metadata (see makeOrder). Undefined for
		 * an amount the cashier typed or tapped in by hand.
		 */
		code?: string;
		/**
		 * Why a MANUALLY typed/tapped discount was given (ตำหนิสินค้า, ของขวัญสะสมแต้ม, ...) —
		 * the amount's own free-text reason, picked from a short preset list rather than
		 * typed, so it is consistent enough to read back later. Mutually exclusive with
		 * `code` in practice (a code already names itself as the reason — see makeOrder's
		 * description precedence) but kept as its own field rather than overloading `code`,
		 * since a reason was never verified against anything the way a code is.
		 */
		reason?: string;
	};
};

export type TCartOptions = {
	key: string;
	value: string;
};

export type TCartItem = {
	// Line identity, distinct from product_id — lets the SAME product exist as
	// independent lines (own qty, own delivery group) in the same cart, e.g. socks split
	// 2/10 across two parcels. Optional only so values constructed before this field
	// existed (a fresh cartItemInfo default, an old localStorage cart) still typecheck;
	// GetExistingCart backfills a stable one onto every line the moment it's read, and
	// AddCartItem stamps one onto any line it pushes. product_id stays the SKU identity
	// everywhere that means "same product" (merge-by-default, order submission); lineId
	// is identity for "same cart row" (qty edits, removal, delivery-group membership).
	lineId?: string;
	product_id: string;
	product_name: string;
	code: string;
	price: number;
	qty: number;
	image?: string;
	input?: TCartOptions[];
	options?: TCartOptions[];
	// E0 (multi-destination foundation) — carried from SaleProduct.type / PIS product,
	// added optionally so carts already sitting in localStorage still parse. Consumed
	// by itemFulfilmentOf() to decide auto hard-splits (see stores/order/delivery-group.ts).
	fulfilmentType?: string;
	originId?: string;
	originName?: string;
	// "รับบางส่วน" — whether this line is handed to the customer at the counter now or
	// shipped. Optional so carts already sitting in localStorage still parse; an absent
	// value means Ship (see receiveModeOf). Only ever consulted on a POS จัดส่งให้ลูกค้า
	// sale — see `allowPartialReceive` in syncDeliveryGroups. Kept for backward
	// compatibility: basic mode (see delivery-group.ts resolveLineKind) still honours
	// receiveMode === 'now' as PickupInStore for a line nobody has re-picked via
	// lineFulfilment yet.
	receiveMode?: string;
	// Basic mode's own per-line override — a DeliveryGroupKind value the cashier picked
	// for THIS line specifically (e.g. flipped a machine from "รับทันที" to "จัดส่ง").
	// undefined = follow whatever the rest of the sale/line defaults to; see
	// resolveLineKind in $lib/entities/order/delivery-group.ts.
	lineFulfilment?: string;
};
