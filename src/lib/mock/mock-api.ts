/**
 * DEV-ONLY mock API adapter.
 *
 * Purpose: bypass AMS login and serve offline mock data so the app shell and
 * main pages can be visually reviewed without a reachable backend.
 *
 * Wiring: injected as the axios `adapter` in `$lib/axios-client-v2` ONLY when
 * `import.meta.env.VITE_MOCK_API` is truthy (see `.env.dev`). Because the flag
 * is statically replaced at build time, this module is tree-shaken out of
 * production builds. It has no top-level side effects.
 *
 * Every response is HTTP 200, so it never trips the auth-redirect interceptor
 * (`src/utils/auth-redirect.ts` only redirects on 401/500 with an auth body).
 *
 * All fixtures share the same COMPANY_ID / STORE_ID / USER_ID so that the
 * config-driven company/store selection resolves to the mock entities.
 */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { NameServiceConfig } from '$lib/entities/configuration/configuration';
import { KEYWORDS, LANGUAGES } from './mock-i18n';

const COMPANY_ID = 'mock-company-0001';
const STORE_ID = 'mock-store-0001';
const USER_ID = 'mock-user-0001';
const OWNER = `sellsuki.company:${COMPANY_ID}`;

/* ------------------------------------------------------------------ address */
// toAddress() dereferences country, country.administrative_division_name and
// coordinates WITHOUT null guards — these objects must be fully present.
const ADDRESS = {
	administrative_area_level_1: 'กรุงเทพมหานคร',
	administrative_area_level_2: 'เขตวัฒนา',
	administrative_area_level_3: '',
	locality_area_level_1: 'คลองเตยเหนือ',
	locality_area_level_2: '',
	locality_area_level_3: '',
	postal_code: '10110',
	street: '123 ถนนสุขุมวิท',
	coordinates: { latitude: 13.7367, longitude: 100.5602 },
	country: {
		iso_alpha_3: 'THA',
		iso_alpha_2: 'TH',
		name: 'Thailand',
		currency: 'THB',
		phone_code: '66',
		administrative_division_name: {
			administrative_area_level_1: 'จังหวัด',
			administrative_area_level_2: 'อำเภอ/เขต',
			administrative_area_level_3: '',
			locality_area_level_1: 'ตำบล/แขวง',
			locality_area_level_2: '',
			locality_area_level_3: ''
		},
		settings: {
			phone_format: '',
			postal_code_format: '',
			store_code_format: '',
			tax_id_format: ''
		}
	}
};
const TAX_INFO = { ...ADDRESS, tax_id: '0105551234567', full_name: 'บริษัท ม็อค จำกัด' };

/* ------------------------------------------------------------------ profile */
const PROFILE = {
	id: USER_ID,
	first_name: 'สมชาย',
	last_name: 'ใจดี',
	email: 'somchai@example.com',
	phone: '0891234567',
	avatar: '',
	gender: 'male',
	verified: true
};

/* --------------------------------------------------------- company & store */
const STORE = {
	id: STORE_ID,
	provider_code: 'patona',
	company_id: COMPANY_ID,
	name: 'ร้านตัวอย่าง สาขาสุขุมวิท',
	code: 'MOCK-001',
	is_system_code: false,
	phone: '021234567',
	phone2: '',
	address: ADDRESS,
	tax_information: TAX_INFO
};

// Extra branches so the pickup-later journey has real choices to pick from
// (สาขา A / B / C). Same shape as STORE, only name / code / phone / address differ.
const mkBranch = (
	id: string,
	name: string,
	code: string,
	phone: string,
	street: string,
	locality: string,
	area2: string,
	area1: string,
	postal: string
) => ({
	...STORE,
	id,
	name,
	code,
	phone,
	address: {
		...ADDRESS,
		street,
		locality_area_level_1: locality,
		administrative_area_level_2: area2,
		administrative_area_level_1: area1,
		postal_code: postal
	}
});

const BRANCHES = [
	STORE,
	mkBranch(
		'mock-store-0002',
		'ร้านตัวอย่าง สาขาลาดพร้าว',
		'MOCK-002',
		'021112222',
		'45 ถนนลาดพร้าว 71',
		'แขวงลาดพร้าว',
		'เขตลาดพร้าว',
		'กรุงเทพมหานคร',
		'10230'
	),
	mkBranch(
		'mock-store-0003',
		'ร้านตัวอย่าง สาขาเชียงใหม่',
		'MOCK-003',
		'053445566',
		'9 ถนนนิมมานเหมินท์',
		'ตำบลสุเทพ',
		'อำเภอเมือง',
		'เชียงใหม่',
		'50000'
	)
];

const COMPANY = {
	id: COMPANY_ID,
	provider_code: 'patona',
	name: 'บริษัท ม็อค จำกัด',
	code: 'MOCKCO',
	logo: '',
	tos_id: 'mock-tos-0001', // non-empty → skips the /company/tos redirect
	phone: '021234567',
	phone2: '',
	email: 'mock@example.com',
	address: ADDRESS,
	tax_information: TAX_INFO,
	stores: BRANCHES // non-empty → isFirstCompany=false, skips /store/new redirect
};

/* --------------------------------------------------------- configuration */
// Keyed by the resolved service names; version>=1 avoids the create-config call.
const CONFIG_DATA: Record<string, unknown> = {
	[NameServiceConfig.patonaSellerCenterUser]: {
		uiTheme: 'light',
		selectedStoreId: STORE_ID,
		defaultCurrency: 'THB',
		// adapter reads notifications.* unguarded — must be a present object
		notifications: { newOrderEmail: true, lowStockWarningApp: true, systemUpdatesEmail: false }
	},
	[NameServiceConfig.sellsukiGlobalUser]: {
		language: 'th',
		selectedCompanyId: COMPANY_ID
	},
	[NameServiceConfig.sellsukiGlobalCompany]: { payment_mode: 'sukipay' },
	[NameServiceConfig.patonaSellerCenterStore]: { timeout_seconds: 60 }
};

/* ------------------------------------------------------------------ orders */
type OrderOpts = {
	state: string;
	status: string;
	buyerName: string;
	buyerPhone: string;
	total: number;
	paymentType: string;
	createdAt: string;
	items: Array<Record<string, unknown>>;
};

const mkItem = (id: string, name: string, price: number, qty: number): Record<string, unknown> => ({
	product_id: id,
	product_name: name,
	sku: `SKU-${id}`,
	original_price: price,
	sale_price: price,
	qty,
	image: '',
	variants: {}
});

const mkOrder = (n: number, o: OrderOpts) => ({
	order_id: 1000 + n,
	order_serial: `POS-2026-${1000 + n}`,
	order_doc_ref: `DOC-${1000 + n}`,
	provider_code: 'patona',
	refs: [],
	flow: { revision: 1, type: 'pos' },
	cashier_info: {
		id: USER_ID,
		kind: 'sellsuki.user',
		name: 'สมชาย ใจดี',
		email: 'somchai@example.com',
		store_name: STORE.name
	},
	state: o.state,
	status: o.status,
	sale_channel: { sale_origin: 'pos', type: 'offline' },
	buyer: {
		name: o.buyerName,
		ref_id: '',
		tax_id: '',
		email: '',
		phone: o.buyerPhone,
		address: '',
		country_code: 'TH',
		postcode: ''
	},
	seller: {
		name: COMPANY.name,
		ref_id: '',
		tax_id: '0105551234567',
		email: COMPANY.email,
		phone: COMPANY.phone,
		address: '',
		country_code: 'TH',
		postcode: '10110'
	},
	tasks: [],
	items: o.items,
	buyer_statement: {
		total_Price: o.total,
		net_price: o.total,
		received_amount: o.total,
		details: []
	},
	seller_statement: {
		total_Price: o.total,
		net_price: o.total,
		received_amount: o.total,
		details: []
	},
	payment_type: o.paymentType,
	created_at: o.createdAt
});

const ORDERS_RESPONSE = {
	data: [
		mkOrder(1, {
			state: 'completed',
			status: 'completed',
			buyerName: 'สมหญิง รักดี',
			buyerPhone: '0812345678',
			total: 1290,
			paymentType: 'cash',
			createdAt: '2026-07-13T09:15:00Z',
			items: [mkItem('p1', 'เสื้อยืดคอตตอน', 390, 2), mkItem('p2', 'กางเกงยีนส์', 510, 1)]
		}),
		mkOrder(2, {
			state: 'pending',
			status: 'pending',
			buyerName: 'อนุชา พานิช',
			buyerPhone: '0898765432',
			total: 450,
			paymentType: 'promptpay',
			createdAt: '2026-07-13T11:40:00Z',
			items: [mkItem('p3', 'หมวกแก๊ป', 250, 1), mkItem('p4', 'ถุงเท้า', 100, 2)]
		}),
		mkOrder(3, {
			state: 'processing',
			status: 'processing',
			buyerName: 'วิภาดา สุขใจ',
			buyerPhone: '0851112222',
			total: 2400,
			paymentType: 'bank_transfer',
			createdAt: '2026-07-14T08:05:00Z',
			items: [mkItem('p5', 'รองเท้าผ้าใบ', 1200, 2)]
		})
	],
	total_count: {
		total: 3,
		total_canceled: 0,
		total_completed: 1,
		total_partial_completed: 0,
		total_pending: 1,
		total_processing: 1
	}
};

/* --------------------------------------------------------------- customers */
/** AddressEntity as customer-book-v2 returns it; every field the adapter reads. */
const mkAddressEntity = (o: Record<string, string>) => ({
	contact_name: o.contact_name ?? '',
	phone: o.phone ?? '',
	street: o.street ?? '',
	locality_area_level1: o.locality_area_level1 ?? '',
	locality_area_level2: o.locality_area_level2 ?? '',
	locality_area_level3: o.locality_area_level3 ?? '',
	administrative_area_level1: o.administrative_area_level1 ?? '',
	administrative_area_level2: o.administrative_area_level2 ?? '',
	administrative_area_level3: o.administrative_area_level3 ?? '',
	postal_code: o.postal_code ?? '',
	country_code: 'THA',
	notes: o.notes ?? '',
	coordinates: { latitude: 13.7217, longitude: 100.5698 }
});

const mkAddress = (id: number, isDefault: boolean, o: Record<string, string>) => ({
	id,
	is_default: isDefault,
	address: mkAddressEntity(o)
});

const mkCustomer = (
	id: number,
	first: string,
	last: string,
	phone: string,
	email: string,
	latest: string
) => ({
	id,
	owner: OWNER,
	country_code: 'TH',
	first_name: first,
	last_name: last,
	email,
	phone,
	latest_order: latest,
	create_at: '2026-01-05T10:00:00Z',
	order_list: [],
	// Two addresses (one default) so the cart's address picker has something to pick,
	// and one tax entry so the invoice flows are reviewable. Shapes match
	// customer-book-v2's Address / TaxInformation (snake_case, address nested).
	addresses: [
		mkAddress(id * 10 + 1, true, {
			contact_name: `${first} ${last}`,
			phone,
			street: '199/22 ซอยสุขุมวิท 22',
			locality_area_level1: 'แขวงคลองเตย',
			administrative_area_level3: 'เขตคลองเตย',
			administrative_area_level1: 'กรุงเทพมหานคร',
			postal_code: '10110'
		}),
		mkAddress(id * 10 + 2, false, {
			contact_name: `${first} ${last} (ที่ทำงาน)`,
			phone,
			street: '88 อาคารเอ็มไพร์ ชั้น 20',
			locality_area_level1: 'แขวงยานนาวา',
			administrative_area_level3: 'เขตสาทร',
			administrative_area_level1: 'กรุงเทพมหานคร',
			postal_code: '10120'
		})
	],
	tax_information: [
		{
			id: id * 10 + 1,
			kind: 'individual',
			full_name: `${first} ${last}`,
			tax_number: `1${String(id).padStart(12, '0')}`,
			branch_name: '',
			email,
			address: mkAddressEntity({
				contact_name: `${first} ${last}`,
				phone,
				street: '199/22 ซอยสุขุมวิท 22',
				locality_area_level1: 'แขวงคลองเตย',
				administrative_area_level3: 'เขตคลองเตย',
				administrative_area_level1: 'กรุงเทพมหานคร',
				postal_code: '10110'
			})
		}
	]
});

const CUSTOMERS_RESPONSE = {
	customers: [
		mkCustomer(1, 'สมหญิง', 'รักดี', '0812345678', 'somying@example.com', '2026-07-13T09:15:00Z'),
		mkCustomer(2, 'อนุชา', 'พานิช', '0898765432', 'anucha@example.com', '2026-07-13T11:40:00Z'),
		mkCustomer(3, 'วิภาดา', 'สุขใจ', '0851112222', 'wipada@example.com', '2026-07-14T08:05:00Z'),
		mkCustomer(4, 'ธนา', 'มั่งมี', '0863334444', 'thana@example.com', '2026-07-11T15:20:00Z')
	],
	total: 4
};

/* ---------------------------------------------------------------- countries */
const mkCountry = (iso: string, name: string, phone: number) => ({
	iso_alpha_3: iso,
	name,
	phone_code: phone,
	administrative_division_name: {
		administrative_area_level_1: 'จังหวัด',
		administrative_area_level_2: '',
		administrative_area_level_3: 'เขต/อำเภอ',
		locality_area_level_1: 'แขวง/ตำบล',
		locality_area_level_2: '',
		locality_area_level_3: ''
	}
});

const COUNTRIES_RESPONSE = {
	data: [
		mkCountry('THA', 'ไทย', 66),
		mkCountry('USA', 'สหรัฐอเมริกา', 1),
		mkCountry('JPN', 'ญี่ปุ่น', 81),
		mkCountry('SGP', 'สิงคโปร์', 65)
	],
	total: 4
};

/** One postal code resolves to one province/district/subdistrict triple. */
const postalCodeResponse = (code: string) => ({
	data: [
		{
			iso_alpha_3: 'THA',
			postal_code: code,
			administrative_division: {
				administrative_name_level_1: { th: 'กรุงเทพมหานคร', en: 'Bangkok' },
				administrative_name_level_2: {},
				administrative_name_level_3: { th: 'เขตคลองเตย', en: 'Khlong Toei' },
				locality_name_level_1: { th: 'แขวงคลองเตย', en: 'Khlong Toei' },
				locality_name_level_2: {},
				locality_name_level_3: {}
			}
		}
	],
	total: 1
});

/* ----------------------------------------------------------- pis products */
// `type` is PIS's fulfilment profile — physical | digital | service (pis-gen.ts,
// model.ProductRequest). It used to read 'simple' here, which is not one of them, so
// every mock product fell back to physical and an order could never split: the
// multi-parcel cart (badges, การจัดส่ง row, the parcel drawer) was unreachable in the
// offline shell no matter what you put in the basket. The catalogue below carries a
// digital line so that path is reviewable without a real backend.
const mkProduct = (
	id: string,
	code: string,
	name: string,
	price: number,
	type: 'physical' | 'digital' | 'service' = 'physical'
) => ({
	id,
	code,
	name,
	type,
	price,
	images: [],
	variant: [],
	customer_inputs: []
});

const PIS_PRODUCTS = [
	mkProduct('p1', 'SKU-p1', 'เสื้อยืดคอตตอน', 390),
	mkProduct('p2', 'SKU-p2', 'กางเกงยีนส์', 510),
	mkProduct('p3', 'SKU-p3', 'หมวกแก๊ป', 250),
	mkProduct('p4', 'SKU-p4', 'ถุงเท้า', 50),
	mkProduct('p5', 'SKU-p5', 'รองเท้าผ้าใบ', 1200),
	mkProduct('p6', 'SKU-p6', 'กระเป๋าผ้า', 320),
	// Digital lines — the ones that force a parcel split and need an email destination.
	// Several of them on purpose: two digital items in one cart must still collapse into
	// a SINGLE ดิจิทัล parcel, which is the rule most likely to regress unnoticed.
	mkProduct('p7', 'SKU-p7', 'E-voucher ฿500', 500, 'digital'),
	mkProduct('p8', 'SKU-p8', 'บัตรกำนัลอิเล็กทรอนิกส์ ฿1,000', 1000, 'digital'),
	mkProduct('p9', 'SKU-p9', 'โค้ดเติมเกม 500 เพชร', 199, 'digital'),
	mkProduct('p10', 'SKU-p10', 'คอร์สออนไลน์ ถ่ายภาพเบื้องต้น', 1490, 'digital'),
	mkProduct('p11', 'SKU-p11', 'e-Book สูตรอาหารไทย', 129, 'digital'),
	mkProduct('p12', 'SKU-p12', 'ตั๋วเข้างาน e-Ticket', 350, 'digital'),
	// Service lines — performed, never shipped, so they join no parcel at all.
	mkProduct('p13', 'SKU-p13', 'บริการห่อของขวัญ', 80, 'service'),
	mkProduct('p14', 'SKU-p14', 'บริการปักชื่อบนเสื้อ', 150, 'service')
];

// The sales page has ทั้งหมด / สินค้า / บริการ / ดิจิทัล tabs that pass `type` (and a
// search box that passes `keyword`) straight to PIS. The mock used to answer every one
// of them with the whole catalogue, so the tabs looked broken and a digital product was
// hard to find at all — filter the way the real endpoint does.
const pisProducts = (params?: { type?: string; keyword?: string }) => {
	const type = params?.type ?? '';
	const keyword = (params?.keyword ?? '').trim().toLowerCase();

	const results = PIS_PRODUCTS.filter(
		(p) =>
			(type === '' || p.type === type) &&
			(keyword === '' ||
				p.name.toLowerCase().includes(keyword) ||
				p.code.toLowerCase().includes(keyword))
	);

	return { results, total: results.length };
};

/* ------------------------------------------------------- payment channels */
// GET /payment answers the store's payment channels, and the cart gates checkout on
// them: resolveAvailablePaymentMethods (payment-transaction.ts) keeps only the methods
// whose channel type is ENABLED here, and offers NoPaymentChannelModal when none
// survive. The empty default this used to fall through to left every offline sale
// dead-ended at "ร้านนี้ยังไม่ได้เปิดช่องทางชำระเงิน" — so the whole flow after เก็บเงิน
// was unreachable offline.
//
// Raw shape on purpose (snake_case, numeric ids, `payment` wrapper): it goes through
// toPaymentChannel in management-adapter, and mocking the mapped shape would let an
// adapter bug pass unnoticed here. Only 'cash' and 'bankTransfer' are types the app
// maps (payment.ts) — anything else is dropped, so nothing else is invented.
const mkPaymentChannel = (
	id: number,
	paymentId: number,
	name: string,
	description: string,
	type: 'cash' | 'bankTransfer',
	status: boolean,
	metadata: Record<string, string> | null = null
) => ({
	id,
	status,
	payment: { id: paymentId, name, description, type, owner: COMPANY_ID, metadata }
});

const PAYMENT_CHANNELS = [
	mkPaymentChannel(1, 101, 'เงินสด', 'รับชำระเป็นเงินสดที่เคาน์เตอร์', 'cash', true),
	mkPaymentChannel(
		2,
		102,
		'ธนาคารกสิกรไทย',
		'โอนเข้าบัญชีร้าน แล้วแนบสลิป',
		'bankTransfer',
		true,
		{
			provider_bank_code: 'kbank',
			provider_bank_logo: '/images/default-image.png',
			account_number: '123-4-56789-0',
			name: 'บริษัท พาโตน่า จำกัด'
		}
	),
	mkPaymentChannel(
		3,
		103,
		'ธนาคารไทยพาณิชย์',
		'โอนเข้าบัญชีร้าน แล้วแนบสลิป',
		'bankTransfer',
		true,
		{
			provider_bank_code: 'scb',
			provider_bank_logo: '/images/default-image.png',
			account_number: '987-6-54321-0',
			name: 'บริษัท พาโตน่า จำกัด'
		}
	),
	// Left OFF so the settings page has something to switch on, and so the enabled-only
	// filter in resolveAvailablePaymentMethods is exercised rather than assumed.
	mkPaymentChannel(4, 104, 'ธนาคารกรุงเทพ', 'ปิดใช้งานอยู่', 'bankTransfer', false, {
		provider_bank_code: 'bbl',
		provider_bank_logo: '/images/default-image.png',
		account_number: '555-1-22222-0',
		name: 'บริษัท พาโตน่า จำกัด'
	})
];

/* -------------------------------------------------------------- the adapter */
function parseBody(data: unknown): unknown {
	if (typeof data === 'string') {
		try {
			return JSON.parse(data);
		} catch {
			return undefined;
		}
	}
	return data;
}

function ok<T>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<T> {
	return {
		data,
		status: 200,
		statusText: 'OK',
		headers: {},
		config,
		request: {}
	};
}

export function getMockAdapter(): AxiosAdapter {
	return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
		const url = config.url ?? '';
		const method = (config.method ?? 'get').toLowerCase();
		const path = url.split('?')[0];

		// Customer writes (address add / edit) — keep them in the in-memory fixture so the
		// flow can be reviewed offline: the cart re-reads the customer right after saving.
		if (method === 'put' || method === 'patch') {
			// Settings → ช่องทางชำระเงิน toggles a channel with PUT /payment/{id}. Keep the
			// switch in memory so the page reflects what was just switched, and so the cart's
			// available methods change with it for the rest of the session.
			const onePayment = path.match(/\/payment\/(\d+)$/);
			if (onePayment) {
				const body = parseBody(config.data) as { status?: boolean } | undefined;
				const channel = PAYMENT_CHANNELS.find((c) => String(c.id) === onePayment[1]);
				if (channel && typeof body?.status === 'boolean') channel.status = body.status;
				return ok(config, channel ?? {});
			}

			const one = path.match(/\/customers\/(\d+)(?:\/access)?$/);
			if (one) {
				const body = parseBody(config.data) as Record<string, unknown> | undefined;
				const idx = CUSTOMERS_RESPONSE.customers.findIndex((c) => String(c.id) === one[1]);
				if (idx >= 0 && body) {
					const merged = {
						...CUSTOMERS_RESPONSE.customers[idx],
						...body,
						id: CUSTOMERS_RESPONSE.customers[idx].id
					} as (typeof CUSTOMERS_RESPONSE.customers)[number];
					CUSTOMERS_RESPONSE.customers[idx] = merged;
					return ok(config, merged);
				}
			}
		}

		// POST /configuration/bulk — echo the requested services with mock data.
		if (method === 'post' && path.includes('/configuration/bulk')) {
			const body = parseBody(config.data);
			const list = Array.isArray(body) ? body : [];
			const resp = list.map((item: { service: string }) => ({
				service: item.service,
				data: CONFIG_DATA[item.service] ?? {},
				version: 1
			}));
			return ok(config, resp);
		}

		if (method === 'get') {
			// i18n (legacy client): real Thai labels so menus/tables are reviewable.
			if (path.includes('/public/keywords/')) return ok(config, KEYWORDS);
			if (path.includes('/public/languages')) return ok(config, LANGUAGES);
			// Permission gate (management + customer-book both expose this path).
			// Grant every requested permission so gated pages render.
			if (path.includes('/checkpermission/each')) {
				const raw = (config.params as { permissions?: unknown } | undefined)?.permissions;
				const perms = Array.isArray(raw)
					? (raw as string[])
					: typeof raw === 'string'
						? raw.split(',')
						: [];
				const status: Record<string, boolean> = {};
				for (const p of perms) if (p) status[p] = true;
				return ok(config, { status });
			}
			if (path.endsWith('/user/profile')) return ok(config, PROFILE);
			if (path.includes('/user/company')) return ok(config, [COMPANY]);
			if (path.includes('/public/countries')) return ok(config, COUNTRIES_RESPONSE);
			// Postal-code lookup behind the address form's province/district fields.
			const postal = path.match(/\/public\/postal-codes\/(\d+)$/);
			if (postal) return ok(config, postalCodeResponse(postal[1]));
			if (/store\/[^/]+\/orders/.test(path)) return ok(config, ORDERS_RESPONSE);
			// Single store: the order flow resolves the selling / pickup branch through
			// GET /store/{id}. Must stay below the /orders route above.
			const oneStore = path.match(/\/store\/([^/]+)$/);
			if (oneStore) {
				const branch = BRANCHES.find((b) => b.id === oneStore[1]);
				if (branch) return ok(config, branch);
			}
			// Single order detail: GET /store/{id}/order/{orderId} → one order object.
			if (/\/store\/[^/]+\/order\/[^/]+$/.test(path)) return ok(config, ORDERS_RESPONSE.data[0]);
			// Single customer must come BEFORE the list route: the sales cart picks a
			// customer through GET /customers/{id}/access, and answering that with the
			// whole list left the adapter with no first_name — which the cart reads as
			// "not a real customer" and silently ignores, so selection did nothing.
			const oneCustomer = path.match(/\/customers\/(\d+)(?:\/access)?$/);
			if (oneCustomer) {
				const found = CUSTOMERS_RESPONSE.customers.find((c) => String(c.id) === oneCustomer[1]);
				if (found) return ok(config, found);
			}
			if (path.includes('/customers')) return ok(config, CUSTOMERS_RESPONSE);
			if (path === 'products' || path.endsWith('/products'))
				return ok(config, pisProducts(config.params as { type?: string; keyword?: string }));
			// Store payment channels. GET-only: the order's own /payment endpoint is a PUT,
			// so this cannot swallow it.
			if (path === 'payment' || path.endsWith('/payment'))
				return ok(config, { data: PAYMENT_CHANNELS, total: PAYMENT_CHANNELS.length });
			// single-config GET (not on the boot path, but keep it consistent)
			const singleCfg = path.match(/\/configuration\/([^/]+)$/);
			if (singleCfg) {
				return ok(config, {
					service: singleCfg[1],
					data: CONFIG_DATA[singleCfg[1]] ?? {},
					version: 1
				});
			}
		}

		// Safe default: 200 with an empty paginated body — never trips the
		// auth-redirect and satisfies the common { data, total } consumers.
		if (import.meta.env.DEV) {
			// eslint-disable-next-line no-console
			console.warn(`[mock-api] unmocked ${method.toUpperCase()} ${url} → empty 200`);
		}
		return ok(config, { data: [], total: 0 });
	};
}
