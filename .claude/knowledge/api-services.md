# API Services

## Management API (`src/service/management-rest.ts`)

Base: `VITE_MANAGEMENT_URL` | Client: `newAxiosClient` (with request dedup)

### Profile & Auth
| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/user/profile` | `getUserProfile()` | `Profile \| undefined` |

### Company CRUD
| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/user/company` | `listUserCompany()` | `Company[]` |
| GET | `/user/company/{id}` | `getUserCompanyById(id)` | `Company` |
| GET | `/company/{id}` | `getCompanyById(id)` | `Company` |
| POST | `/user/company` | `userCreateCompany(company)` | `string` (id) |
| PUT | `/company/{id}` | `updateCompany(company)` | `void` |

### Store CRUD
| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/store/{id}` | `getStoreById(id)` | `Store` |
| POST | `/company/{id}/store` | `companyCreateStore(store)` | `string` (id) |
| PUT | `/store/{id}` | `updateStore(store)` | `void` |
| DELETE | `/store/{id}` | `deleteStore(id)` | `void` |

### Order Operations
| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/store/{sId}/orders` | `storeListOrder(sId, offset, limit, sort, search, ...)` | `{ data: Order[], total: TotalCount }` |
| GET | `/store/{sId}/order/{oId}` | `storeGetOrder(sId, oId)` | `Order` |
| POST | `/store/{sId}/order` | `storeCreateOrder(order, sId)` | `string` (id) |
| PUT | `/store/{sId}/order/{oId}/state` | `storeUpdateOrderState(sId, oId, state)` | `string` |
| PUT | `/store/{sId}/order/{oId}/task` | `storeUpdateTaskInfo(sId, oId, tId, attrs, status)` | `string` |
| PUT | `/store/{sId}/order/{oId}/payment` | `storeUpdatePaymentAmount(sId, oId, order)` | `string` |
| PUT | `/store/{sId}/order/{oId}/delivery-channel` | `storeUpdateOrderDeliveryChannel(sId, oId, ...)` | `string` |
| PUT | `/store/{sId}/order/{oId}/delivery-remark` | `storeUpdateOrderDeliveryRemark(sId, oId, remark)` | `string` |
| PUT | `/store/{sId}/order/{oId}/payment-type` | `storeUpdateOrderPaymentType(sId, oId, type)` | `string` |
| PUT | `/store/{sId}/order/{oId}/sales-channel` | `storeUpdateOrderSalesChannel(sId, oId, type, origin)` | `string` |

### Payment Channels
| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/payment` | `listPaymentChannels(companyId, storeId)` | `{ data: PaymentChannel[], total: number }` |
| PUT | `/payment/{id}` | `updatePaymentStoreChannel(id, companyId, storeId, paymentId, status)` | response |

### Public Endpoints (no auth)
| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/public/countries` | `listCountries()` | `Country[]` |
| GET | `/public/postal-codes/{code}` | `listGeoNames(code, offset, limit)` | `{ data: GeoNames[], total: number }` |
| GET | `/public/consent/company/tos` | `getTosConsent()` | `string` |
| POST | `/company/{id}/accept_tos_consent` | `acceptTosConsent(companyId)` | `void` |

### Permissions
| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/checkpermission/each` | `managementCheckPermissionsEach(kind, id, perms[])` | `status` |

---

## Customer Book v2 API (`src/service/customer-book-v2-rest.ts`)

Base: `VITE_CUSTOMER_BOOK_V2_URL` | Client: `newAxiosClient` (with request dedup)

| Method | Path | Function | Returns |
|--------|------|----------|---------|
| POST | `/customers` | `createCustomer(customer)` | `number` (id) |
| PUT | `/customers` | `updateCustomer(customer)` | response |
| PUT | `/customers/access` | `updateCustomerWithAccess(customer)` | response |
| GET | `/customers/{id}` | `getCustomerById(id, owner)` | `Customer` |
| GET | `/customers/{id}/access` | `getCustomerByIdWithAccess(id, owner)` | `Customer` |
| GET | `/customers` | `listCustomers(owner, search?, per_page, page, sort_by, sort_order)` | `{ customers, total }` |
| GET | `/customers/access` | `listCustomersWithAccess(owner, ...)` | `{ customers, total }` |
| GET | `/customer` | `getCustomer(owner, first_name, last_name, phone, country_code)` | `Customer` |
| GET | `/checkpermission/each` | `customerCheckPermissionsEach(kind, id, perms[])` | response |

---

## PIS API (`src/service/pis-rest.ts`)

Base: `VITE_PIS_URL` | Client: `newAxiosClient` (with request dedup)

| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/products` | `listProduct(ref_id, offset, limit, type, keyword)` | `{ results: SaleProduct[], total: number }` |

Products are also loaded via iframe at `VITE_PIS_IFRAME` (see `IframeProduct.svelte`).

---

## Central Configuration API (`src/service/central-configuration-rest.ts`)

Base: `VITE_MANAGEMENT_URL` (management backend proxies to CCS) | Client: `newAxiosClient`

| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/configuration/{service}?userId=&location=` | `getConfig(service, identity, location)` | `Configuration` |
| POST | `/configuration/bulk` | `getBulkConfigs(reqConfigs[])` | `Configuration[]` |
| POST | `/configuration/{service}?userId=&location=` | `createConfig(service, identity, location, cfg)` | response |
| PUT | `/configuration/{service}?userId=&location=` | `updateConfig(service, identity, location, cfg)` | response |
| DELETE | `/configuration/{service}?userId=&location=` | `deleteConfig(service, location, userID)` | response |

---

## i18n API (`src/service/i18n-rest.ts`)

Base: `VITE_I18N_URL` | Client: `axiosClient` (legacy class)

| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/public/keywords/{tag}` | `listKeyword(tag)` | `KeywordDetail \| undefined` |
| GET | `/public/languages` | `listLanguage()` | `Language[]` |

---

## AMS (Accounts) API (`src/service/accounts.ts`)

Base: `VITE_AMS_URL` | Client: `fetch` (not axios — cross-domain cookies)

| Method | Path | Function | Returns |
|--------|------|----------|---------|
| GET | `/cookie-matching/profile` | `cookieMatchingAndUserProfile()` | `Profile \| undefined` |
| Redirect | `/cookie-matching?path=` | `redirectCookieMatching(url?)` | full page redirect |

---

## Adapter Naming Convention

Each REST file has a corresponding adapter:

| REST File | Adapter File | Key Functions |
|-----------|-------------|---------------|
| `management-rest.ts` | `management-adapter.ts` | `toCompany`, `toStore`, `toOrder`, `toProfile`, `toPaymentChannel` |
| `customer-book-v2-rest.ts` | `customer-book-v2-adapter.ts` | `customerToEntity`, `entityToCustomer`, `addressToEntity` |
| `pis-rest.ts` | `pis-adapter.ts` | `toSale` (product → SaleProduct) |
| `central-configuration-rest.ts` | `central-configuration-adapter.ts` | `configratuionEntityToEntity`, `requestToBulkModel` |
| `i18n-rest.ts` | `i18n-adapter.ts` | `keywordToEntity`, `languagesToEntity` |
