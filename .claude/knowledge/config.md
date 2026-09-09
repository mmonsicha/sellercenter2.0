# Configuration & Environment

## Environment Variables

All environment variables use the `VITE_` prefix (Vite requirement for client-side access).

### Core

| Variable             | Purpose               | Example (dev)         |
| -------------------- | --------------------- | --------------------- |
| `NODE_ENV`           | Environment mode      | `development`         |
| `VITE_PROVIDER_CODE` | Multi-tenant provider | `patona,sellsuki,any` |

### API URLs

| Variable                                | Service                    | Example (dev)                                                     |
| --------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `VITE_MANAGEMENT_URL`                   | Management backend (v1)    | `https://api.dev-th.patona.online/management/v1`                  |
| `VITE_CUSTOMER_BOOK_URL`                | Customer Book v1 (legacy)  | `https://api.dev-th.patona.online/customer-book`                  |
| `VITE_CUSTOMER_BOOK_V2_URL`             | Customer Book v2           | `https://api.dev-th.patona.online/v2-customer-book/v1`            |
| `VITE_PIS_URL`                          | Product Information System | `https://api.dev-th.sellsuki.com/pis`                             |
| `VITE_PIS_IFRAME`                       | PIS product iframe         | `https://pis.dev.sellsuki.com`                                    |
| `VITE_I18N_URL`                         | i18n Management            | `https://api.dev-th.sellsuki.com/i18n-management/v1`              |
| `VITE_CENTRAL_CONFIGURATION_SYSTEM_URL` | Central Config             | `https://api.dev-th.sellsuki.com/central-configuration-system/v1` |
| `VITE_IMAGE_BASE_URL`                   | Image CDN                  | `https://file.dev.sellsuki.com`                                   |
| `VITE_CCS_3`                            | Admin panel (CCS3)         | `https://admin.dev-th.sellsuki.com`                               |

### Auth

| Variable                       | Purpose                    | Example                                              |
| ------------------------------ | -------------------------- | ---------------------------------------------------- |
| `VITE_AMS_URL`                 | Account Management System  | `https://accounts.revette.io`                        |
| `VITE_ACCOUNT_PATONA_URL`      | Patona accounts endpoint   | `https://accounts.dev-th.patona.online`              |
| `VITE_DISABLE_COOKIE_MATCHING` | Skip cookie matching (dev) | `false`                                              |
| `VITE_ADDITIONS_HEADERS`       | Dev auth headers (JSON)    | `{"X-User-Id":"uuid","X-User-Kind":"sellsuki.user"}` |

### Feature Flags

| Variable                           | Purpose                     |
| ---------------------------------- | --------------------------- |
| `VITE_DISABLE_FULFILLMENT_FEATURE` | Hide fulfillment menu items |
| `VITE_DISABLE_CUSTOMER_FEATURE`    | Hide customer menu          |

### Configuration Service Names

| Variable                                        | Purpose                     | Default                      |
| ----------------------------------------------- | --------------------------- | ---------------------------- |
| `VITE_CONFIGURATION_USER_SERVICE_NAME`          | Patona user config service  | `patona-seller-center-user`  |
| `VITE_CONFIGURATION_USER_SELLSUKI_GLOBAL`       | Global user config service  | `sellsuki-global-user`       |
| `VITE_CONFIGURATION_STORE_PATONA_SELLER_CENTER` | Patona store config service | `patona-seller-center-store` |

### Misc

| Variable        | Purpose                    |
| --------------- | -------------------------- |
| `VITE_LINE_URL` | LINE official account link |

## Env Files

| File               | Mode          | Use Case                                   |
| ------------------ | ------------- | ------------------------------------------ |
| `.env.dev`         | `dev`         | Local development with auth bypass headers |
| `.env.development` | `development` | Dev-TH staging APIs with real auth         |
| `.env.staging`     | `staging`     | Staging environment                        |
| `.env.production`  | `production`  | Production                                 |

Start commands: `bun run start:local` (dev), `bun run start:development`, etc.

## Vite Config (`vite.config.js`)

- Dev server: port 5173, host `0.0.0.0`
- Allowed hosts: `sellercenter.revette.io`
- `process.env` is exposed to client via `define`
- Path aliases configured for `$lib`, `$components`, `$pages`, `$stores`, `$utils`, `$types`

## Central Configuration System

User preferences are stored remotely via the Central Configuration System:

- **Service names**: `patona-seller-center-user`, `sellsuki-global-user`
- **User config**: `selectedCompanyId`, `selectedStoreId`, `language`, `uiTheme`, `defaultCurrency`, `notifications`
- **Load flow**: Bulk fetch both configs → merge → if version=0 (new), auto-create
- **Update flow**: Debounced (500ms) PUT to both services on change

## Local Storage Keys

Managed via `src/utils/local-storage.ts`:

- `PATH_BACK_URL` — return URL after company/store dialog
- Other keys as needed per feature

## i18n Configuration

- Keywords loaded from i18n Management API by tag
- Cached in IndexedDB via `IdbI18nStore('ssk-i18n')`
- Default language: `th` (Thai)
- Language preference synced with Central Configuration
- Auto-refresh: reactive subscription updates keyword map when language changes
