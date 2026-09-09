# Data Models

All entity interfaces live in `src/lib/entities/`. Each domain has its own subdirectory.

## Address (`src/lib/entities/address/address.ts`)

```typescript
type Address = {
  addressId?: string;
  contactName?: string;
  country?: Country;
  coordinates?: { latitude: number; longitude: number };
  administrativeAreaLevel1: string;   // Province/State
  administrativeAreaLevel2?: string;  // District
  administrativeAreaLevel3?: string;  // Sub-district
  localityAreaLevel1?: string;
  localityAreaLevel2?: string;
  localityAreaLevel3?: string;
  postalCode: string;
  street: string;
  phone?: string;
  notes?: string;
}

type Country = {
  iso: string;              // ISO alpha-3 code
  name?: string;
  addressMapper?: { ... };  // Maps admin levels to display names
  settings?: Settings;      // Phone/tax/postal code format regexes
  phoneCode?: string;
}

type GeoNames = {
  iso?: string;
  postalCode?: string;
  addressMapper?: GeoNamesAddressMapper;  // Multilingual address level names
}
```

## Company (`src/lib/entities/company/company.ts`)

```typescript
interface Company {
  id?: string;
  providerCode: string;     // Always "patona"
  name: string;
  code: string;
  logo: string;
  phone: string;
  phone2?: string;
  address: Address;
  taxInformation: { fullName: string; taxNumber?: string } & Address;
  tosId?: string;
  stores: Store[];
  email?: string;
}
```

## Store (`src/lib/entities/store/store.ts`)

```typescript
interface Store {
  code: string;
  isSystemCode: boolean;
  companyId: string;
  id?: string;
  name: string;
  providerCode: string;
  phone: string;
  phone2?: string;
  address: Address;
  taxInformation: { fullName: string; taxNumber: string } & Address;
}
```

## Order (`src/lib/entities/order/order.ts`)

```typescript
interface Order {
  orderId?: string;
  orderSerial?: string;
  orderDocRef?: string;
  providerCode?: string;
  refs?: string[];
  flow: Flow;                    // { revision?: number; type: string }
  cashierInfo?: CashierInfo;
  state?: string;
  status?: string;               // pending | processing | partial_completed | completed | canceled
  saleChannel?: SaleChannel;     // { saleOrigin?: string; type?: SaleChannelType }
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

interface Item {
  productId: string;
  productName: string;
  sku?: string;
  originalPrice?: number;
  salePrice: number;
  qty: number;
  image?: string;
  variants?: Record<string, string>;
}
```

Key enums: `OrderFlow`, `PaymentType`, `FullfilmentType`, `Status`, `PaymentState`, `SaleChannelType`, `ShippingType`

## Customer (`src/lib/entities/customer/customer.ts`)

```typescript
interface Customer {
  addresses?: Address[];         // Extended with id + isDefault + tags
  countryCode: string;
  email?: string;
  firstName?: string;
  id?: number;
  lastName?: string;
  latestOrder?: Date;
  createAt?: Date;
  orderList?: string[];
  owner: string;                 // Company/store identifier
  phone?: string;
  taxInformation?: TaxInformation[];
}

interface TaxInformation extends AddressEntity {
  branchName?: string;
  fullName: string;
  id?: number;
  kind: 'individual' | 'juristic';
  taxNumber: string;
  email?: string;
}
```

## Payment (`src/lib/entities/payment/payment.ts`)

```typescript
interface PaymentChannel {
  id: string;
  status: boolean;
  data: PaymentChannelDetail;
}

interface PaymentChannelDetail {
  paymentId: string;
  name: string;
  description: string;
  type?: PaymentType;    // 'cash' | 'bankTransfer'
  logo?: string;
  metadata?: BankTransfer;
}

interface BankTransfer {
  bankImage: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}
```

## Profile (`src/lib/entities/identity/profile.ts`)

```typescript
interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string;
  gender: string;
  verified: boolean;
}
```

## Sale / Product (`src/lib/entities/sale/sale.ts`)

```typescript
type SaleProduct = {
  type?: string;
  product_id: string;
  code: string;
  label: string;
  price: SalePrice;       // { min: number; max?: number }
  image: string;
  variant?: SaleVariant[];
  customerInput?: SaleCustomerInput[];
}

type SaleVariant = {
  image?: string;
  id: string;
  name: string;
  sku: string;
  price: number;
  variant_combination?: VariantCombination[];
}
```

## Configuration (`src/lib/entities/configuration/configuration.ts`)

```typescript
interface UserConfiguration {
  kind: 'user';
  uiTheme: string;
  language: string;
  selectedCompanyId: string;
  selectedStoreId: string;
  defaultCurrency: string;
  notifications: Notifications;
}
```

Two service names: `patonaSellerCenterUser` and `sellsukiGlobalUser` (merged on load).

## Factory Functions

Each entity file exports a `new*()` factory function for creating empty instances:
- `newAddress()`, `newCompany()`, `newStore()`, `newOrder()`, `newItem()`, `newPartyInfo()`, etc.
