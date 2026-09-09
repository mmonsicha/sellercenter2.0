# sellercenter-frontend

Merchant-facing web portal for the Patona/Sellsuki platform — enables Thai SMB merchants to manage companies, stores, orders, customers, products, and sales (POS) from a single interface.

## Requirements

- Node.js 20+
- Bun (package manager and runtime)

## Project Overview

sellercenter-frontend is the Seller Center SPA (Single-Page Application) built with Svelte 4, TypeScript, and Vite 5. It is the primary merchant-facing interface within the Patona/Sellsuki ecosystem, responsible for giving Thai SMB merchants a unified portal to operate their business: creating companies and stores, processing orders (online, offline, and delivery-later), managing customers, browsing and adding products, running a POS terminal, and configuring payment channels and settings.

The application is designed as a feature-based layered SPA — Pages consume Svelte stores for state, stores call Service functions for API access, and Services map raw API responses to clean TypeScript entities through an adapter pattern. Authentication is cookie-based via the AMS (Account Management System), with automatic redirect on session expiry. All user-facing text is in Thai, delivered through a keyword-based i18n system.

## Key Features

- **Multi-Company and Multi-Store Management**: Merchants can create and manage multiple companies and stores under a single account. Company and store selection is persisted via the Central Configuration System.
- **Order Management**: Full order lifecycle — list with search and filter, detail view with customer info, item breakdown, payment status, delivery tracking, and state transitions (e.g., confirm, cancel, mark delivered).
- **Customer Management**: CRUD operations for customers with address and tax invoice details, integrated with the Customer Book v2 backend. Supports search, create, edit, and view flows.
- **POS Sales**: Full point-of-sale flow including product search, variant selection, cart management, payment processing, and receipt generation with thermal printer support via `sellsuki-paper-template-renderer`.
- **Product Integration**: Product catalog browsed via a PIS (Product Information System) iframe embed and added to stores through a PIS API-backed search.
- **Payment Channel Configuration**: Per-store setup and management of payment channels (e.g., cash, QR, card) via the Management backend.
- **Settings**: Store profile settings, thermal printer connection management, and language/theme preferences.
- **Cookie-Based Authentication**: Session management via AMS cookie-matching flow. Axios interceptors automatically detect 401/unauthenticated responses and redirect to the AMS login page.
- **Role-Based Access Control (RBAC)**: Permission checks are evaluated from the permission store and enforced at the page and component level, with a dedicated `PermissionDenied` fallback screen.
- **Keyword-Based i18n**: Translations delivered through `@sellsuki-org/sellsuki-components` `IdbI18nStore` backed by the i18n Management backend, cached locally via IndexedDB (Dexie).
- **Observability**: Google Analytics (GA4) and Microsoft Clarity are embedded for usage analytics and session recording.

## Used By

**Target Audience / Users:**

- **Thai SMB Merchants**: Business owners using Seller Center as their primary management portal for day-to-day operations (orders, customers, POS).
- **Store Operators**: Staff members managing in-store POS transactions, payment channels, and order fulfillment.
- **Company Administrators**: Merchants managing multiple stores under a single company account, configuring per-store settings and payment channels.

**Domain Boundaries:**
Defines what is handled within this service versus what is delegated to other systems.

| Domain Area | In Scope (This Service) | Out of Scope (Delegated To) |
| --- | --- | --- |
| Company & Store UI | Create and edit company and store via Management API | Company data persistence → Management Backend |
| Order UI | View, filter, and transition order states | Order creation and payment processing → Management Backend |
| Customer UI | CRUD customer profiles with address and tax info | Customer data storage → Customer Book v2 Backend |
| POS / Sales UI | Cart management, payment flow, receipt display | Product catalog data → PIS; receipt templates → Paper Backend |
| Product Browsing | PIS iframe embed and API-backed product add to store | Product master data → PIS |
| Authentication | Cookie-matching redirect, 401 interception | Login/logout/identity → AMS (Account Management System) |
| i18n Translations | Keyword lookup and IndexedDB cache | Translation management → i18n Management Backend |
| User Preferences | Company/store selection, settings display | Preference persistence → Central Configuration System |

## Project Instruction

### 1. Clone Repository

```bash
git clone https://gitlab.sellsuki.com/sellsuki/patona/sellercenter-frontend.git
cd sellercenter-frontend
```

### 2. Configuration

The project uses Vite's `--mode` flag to load the corresponding `.env.<mode>` file. Create or verify the env file for the mode you want to run.

For local development, create `.env.dev`:

| Variable | Default (local dev) | Description |
| --- | --- | --- |
| VITE_PROVIDER_CODE | patona | Multi-tenant provider identifier, included in API requests |
| VITE_AMS_URL | https://accounts.sellsuki.local | AMS base URL for cookie-matching and auth redirects |
| VITE_ACCOUNT_PATONA_URL | https://accounts.sellsuki.local | Patona accounts URL used in navigation helpers |
| VITE_MANAGEMENT_URL | http://localhost:8083 | Management backend API base URL |
| VITE_CUSTOMER_BOOK_URL | http://localhost:8086 | Customer Book v1 API base URL (legacy) |
| VITE_CUSTOMER_BOOK_V2_URL | http://localhost:8086/v1 | Customer Book v2 API base URL |
| VITE_PIS_URL | http://localhost:8081 | PIS (Product Information System) API base URL |
| VITE_PIS_IFRAME | http://localhost:8081 | PIS iframe origin for the embedded product catalog |
| VITE_I18N_URL | http://localhost:8088/v1 | i18n Management backend base URL |
| VITE_CENTRAL_CONFIGURATION_SYSTEM_URL | http://localhost:8085/v1 | Central Configuration System base URL |
| VITE_CCS_3 | http://localhost:8085 | CCS admin URL for navigating to the company admin panel |
| VITE_IMAGE_BASE_URL | http://localhost:8087 | Base URL for uploaded image assets |
| VITE_LINE_URL | https://line.me/R/ti/p/@795iopqs?... | Support LINE contact URL shown on the home page |
| VITE_ADDITIONS_HEADERS | (unset in production) | JSON object of extra request headers; when set, bypasses cookie auth and injects dev user identity headers |
| VITE_DISABLE_COOKIE_MATCHING | (unset in production) | When `true`, skips the AMS cookie-matching redirect; use together with `VITE_ADDITIONS_HEADERS` for local dev |
| VITE_DISABLE_FULFILLMENT_FEATURE | (unset in production) | When `true`, hides fulfillment-related menu items |
| VITE_DISABLE_CUSTOMER_FEATURE | (unset in production) | When `true`, hides the customer management menu |
| VITE_CONFIGURATION_USER_PATONA_SELLER_CENTER | patona-seller-center-user | Service name key used to read per-user settings from Central Config |
| VITE_CONFIGURATION_USER_SELLSUKI_GLOBAL | sellsuki-global-user | Global user config namespace for Central Config |

### 3. Install Dependencies

```bash
bun install
```

### 4. Run Project

```bash
# Local development — uses .env.dev (local backends, dev identity headers, no cookie matching)
bun run start:local

# Development environment — uses .env.development (staging APIs at api.dev-th.patona.online)
bun run start:development
```

## Project Structure

The project uses a **feature-based layered SPA** architecture. Pages consume Svelte stores for state management; stores call service functions for data fetching; services map raw API responses (snake_case) to typed TypeScript entities (camelCase) through an adapter layer. There is no server-side rendering — this is a pure client-side SPA using `svelte-routing`.

```
.
├── index.html                              # SPA entry point — mounts #app, loads GA4 and Microsoft Clarity
├── package.json                            # Scripts and dependencies
├── vite.config.js                          # Vite config — path aliases ($lib, $components, etc.), server host
├── svelte.config.js                        # Svelte preprocessors — strips data-testid in production builds
├── tsconfig.json                           # TypeScript project configuration
├── sonar-project.properties                # SonarQube static analysis config
├── public/                                 # Static assets served as-is
│   └── images/                             # Background, delivery, and sales-channel images
└── src/
    ├── main.ts                             # App bootstrap — mounts Svelte root, calls loadProfile()
    ├── App.svelte                          # Root component — theme, i18n, toast context providers, router
    ├── pages/                              # Route-level page components (one directory per domain)
    │   ├── Home.svelte                     # Welcome page with menu section navigation
    │   ├── NotFound.svelte                 # 404 fallback page
    │   ├── company/
    │   │   ├── NewCompany.svelte           # Company creation flow
    │   │   └── Tos.svelte                  # Terms of Service acceptance page
    │   ├── contact/
    │   │   └── ContactUs.svelte            # Contact support page with LINE link
    │   ├── customer/
    │   │   ├── List.svelte                 # Customer list with search and filter
    │   │   ├── Create.svelte               # New customer creation form
    │   │   ├── Edit.svelte                 # Customer edit form
    │   │   └── View.svelte                 # Customer detail view
    │   ├── order/
    │   │   ├── list/                       # Order list page — filter popup, search, sortable table
    │   │   ├── view/                       # Order detail — channel, customer, items, payment, tracking
    │   │   └── orderHandler.ts             # Order state transition and action helpers
    │   ├── product/
    │   │   ├── IframeProduct.svelte        # PIS product catalog embedded as iframe
    │   │   ├── ProductAdd.svelte           # Add product from PIS API search results
    │   │   └── ProductList.svelte          # Store product listing
    │   ├── sales/
    │   │   ├── Sale.svelte                 # POS terminal screen
    │   │   ├── SaleList.svelte             # Sales history list
    │   │   ├── cart/                       # Cart item management components
    │   │   ├── modals/                     # Sale-related modals (payment, confirmation)
    │   │   └── variant/                    # Product variant selection UI
    │   ├── setting/
    │   │   ├── index.svelte                # Settings container page
    │   │   ├── Payment/                    # Payment channel configuration
    │   │   ├── Printer/                    # Thermal printer connection settings
    │   │   └── Store/                      # Store profile settings
    │   └── store/
    │       └── NewStore.svelte             # New store creation flow
    ├── components/                         # Reusable UI components (shared across pages)
    │   ├── Layout.svelte                   # App shell — sidebar navigation, top bar
    │   ├── StoreDialog.svelte              # Company/store selector modal
    │   ├── MenuSection.svelte              # Dynamic navigation menu builder
    │   ├── LoadingPage.svelte              # Full-page loading spinner
    │   ├── PermissionDenied.svelte         # RBAC access-denied fallback screen
    │   ├── ImageEditor.svelte              # Image crop and upload editor
    │   ├── company-and-store/              # Company and store selection flow components
    │   ├── drawer/                         # Slide-out drawer components
    │   ├── dropdown/                       # Dropdown menu components
    │   ├── form/                           # Shared form input components
    │   ├── modal/                          # Modal dialog components
    │   └── payment/                        # Payment channel display components
    ├── stores/                             # Svelte writable/derived stores — global state per domain
    │   ├── profile.ts                      # User profile state and loadProfile() bootstrap function
    │   ├── layout.ts                       # Sidebar open/close state
    │   ├── i18n.ts                         # i18n keyword store backed by IdbI18nStore
    │   ├── settings.ts                     # App language and theme settings
    │   ├── toast.ts                        # Toast notification store
    │   ├── configuration.ts                # Central Config user/company/store preferences
    │   ├── cart/                           # POS cart items, totals, and payment state
    │   ├── company/                        # Current selected company state
    │   ├── geo-names/                      # Province, district, and sub-district name lists
    │   ├── order/                          # Order list pagination and order detail state
    │   ├── payment/                        # Payment channel state
    │   ├── permission/                     # RBAC permission state for the current user
    │   ├── sales/                          # POS sales session state
    │   ├── store/                          # Current selected store state
    │   ├── thermal-printer/                # Thermal printer connection state
    │   └── variant/                        # Product variant selection state
    ├── service/                            # API service layer — three-file pattern per domain
    │   ├── accounts.ts                     # AMS cookie-matching and profile (uses fetch, not axios)
    │   ├── management-gen.ts               # Auto-generated OpenAPI types — Management backend (DO NOT EDIT)
    │   ├── management-rest.ts              # Management API: company, store, order, user, payment channel
    │   ├── management-adapter.ts           # snake_case → camelCase mapping for management responses
    │   ├── customer-book-v2-gen.ts         # Auto-generated OpenAPI types — Customer Book v2 (DO NOT EDIT)
    │   ├── customer-book-v2-rest.ts        # Customer Book v2 API: customer CRUD
    │   ├── customer-book-v2-adapter.ts     # Data mapping for customer book v2
    │   ├── pis-gen.ts                      # Auto-generated OpenAPI types — PIS (DO NOT EDIT)
    │   ├── pis-rest.ts                     # PIS product API calls
    │   ├── pis-adapter.ts                  # Data mapping for PIS product responses
    │   ├── central-configuration-gen.ts    # Auto-generated OpenAPI types — Central Config (DO NOT EDIT)
    │   ├── central-configuration-rest.ts   # Central Config API: get and set user and company preferences
    │   ├── central-configuration-adapter.ts # Data mapping for central configuration
    │   ├── i18n-gen.ts                     # Auto-generated OpenAPI types — i18n Management (DO NOT EDIT)
    │   ├── i18n-rest.ts                    # i18n keyword fetch calls
    │   ├── i18n-adapter.ts                 # Data mapping for i18n keyword responses
    │   ├── papers-gen.ts                   # Auto-generated OpenAPI types — Paper/printing (DO NOT EDIT)
    │   └── doms-gen.ts                     # Auto-generated OpenAPI types — DOMS shipping (DO NOT EDIT)
    ├── lib/
    │   ├── axios-client-v2.ts              # Preferred axios factory — request deduplication, auth intercept
    │   ├── axios.client.ts                 # Legacy class-based axios client (used by central-config, i18n)
    │   ├── types.ts                        # Shared TypeScript utility types
    │   ├── crop-image.ts                   # Image crop helper used by ImageEditor
    │   ├── paper-template/                 # Receipt and invoice template rendering helpers
    │   └── entities/                       # TypeScript domain interfaces (camelCase, no external deps)
    │       ├── address/                    # Address entity (street, province, district, postal code)
    │       ├── company/                    # Company entity
    │       ├── configuration/              # User/company/store configuration entity
    │       ├── customer/                   # Customer entity with tax info
    │       ├── error/                      # Shared error types
    │       ├── i18n/                       # i18n keyword types
    │       ├── identity/                   # User profile entity
    │       ├── order/                      # Order entity with items, payment, delivery
    │       ├── payment/                    # Payment channel entity
    │       ├── provider/                   # Provider/tenant entity
    │       ├── role-permission/            # RBAC role and permission types
    │       ├── sale/                       # POS sale and cart entity
    │       └── store/                      # Store entity
    └── utils/                              # Shared utilities
        ├── auth-redirect.ts                # Detects 401/unauthenticated responses and triggers login redirect
        ├── navigate.ts                     # AMS navigation helpers: login, logout, register, settings
        ├── format-date.ts                  # Date formatting helpers (Thai locale)
        ├── format-number.ts                # Number and currency formatting helpers
        ├── image-url.ts                    # Constructs image URLs from VITE_IMAGE_BASE_URL
        ├── local-storage.ts                # LocalStorage read/write helpers
        ├── queryParams.ts                  # URL query parameter serialisation utilities
        ├── permission.ts                   # RBAC permission check helper functions
        ├── debounce.ts                     # Debounce utility for search inputs
        ├── event-handler.ts                # Shared DOM event helpers
        ├── utils-order.ts                  # Order-specific formatting and state helpers
        ├── yup.ts                          # Yup locale configuration with Thai validation messages
        └── form-validation/                # Yup validation schemas per domain (Thai error messages)
```

**Layer Responsibilities:**

- `pages/` — Route-level components. Each page composes components, subscribes to stores, and dispatches store actions. Pages must not call API functions directly; they go through stores.
- `components/` — Reusable, domain-agnostic UI components. Must not import from `pages/`. May subscribe to stores.
- `stores/` — Global reactive state per domain. Each store module exports a `writable` store and one or more async load functions. Shape: `{ loading: boolean, data: T | undefined }`.
- `service/` — API integration layer. `*-rest.ts` files call backends using `newAxiosClient`; `*-adapter.ts` files convert raw API responses (snake_case) to typed TypeScript entities (camelCase). `*-gen.ts` files are auto-generated from OpenAPI specs and must not be edited manually.
- `lib/entities/` — Pure TypeScript interfaces and factory functions. No external dependencies. Shared type contract between all layers.
- `utils/` — Pure helper functions with no store imports and no Svelte-specific code.

## Testing

Unit tests use **Vitest** and are co-located with source files. Test coverage for this project is currently minimal — the framework is configured and ready for expansion.

### Test Commands

**Unit Tests**
```bash
bun run test:unit
```

**Type Check**
```bash
bun run check
```

### Regenerating OpenAPI Types

When a backend API schema changes, regenerate the corresponding `*-gen.ts` file from the staging Swagger endpoint:

```bash
# Management backend
bun run generate-openapi:management

# Customer Book v2
bun run generate-openapi:customer-book-v2

# PIS (Product Information System)
bun run generate-openapi:pis

# Central Configuration System
bun run generate-openapi:central-configuration

# i18n Management
bun run generate-openapi:i18n

# Paper/printing
bun run generate-openapi:paper

# DOMS (shipping)
bun run generate-openapi:doms
```

> Note: These commands connect to staging internal endpoints and require network access to `*.internal.staging.sellsuki.com`. Do not commit regenerated files without reviewing the diff.
