# Project Context — Jira

## Jira Constants

| Field | Value |
|-------|-------|
| Cloud ID | `50dc7e4a-0539-4dcf-9c33-5481a395a5ab` |
| Project Key | TBD |
| Board | TBD |

## Product Context

Seller Center is the **merchant-facing management portal** within the Sellsuki/Patona platform. It allows sellers to:

- Create and manage **companies** and **stores** (multi-company, multi-store)
- Process **orders** (POS flow: offline, online, delivery-later)
- Manage **customers** via Customer Book v2
- Browse and add **products** from PIS (Product Information System) via iframe
- Handle **sales** (POS cart, payment, receipts, thermal printing)
- Configure **payment channels** per store
- Manage **settings** (language, theme, notifications)

## Target Users

- Thai SMB merchants (primary UI language: Thai)
- Operators managing multiple stores under one company
- POS cashiers processing in-store and online orders

## Related Systems

| System | Relationship |
|--------|-------------|
| Management Backend | Core API — companies, stores, orders, payments |
| Customer Book v2 | Customer CRUD with address and tax info |
| PIS (Product Information System) | Product catalog — accessed via iframe and API |
| Central Configuration System | User/company/store preferences |
| i18n Management | Multi-language keyword translation |
| AMS (Account Management System) | Authentication and user identity |
| DOMS | Delivery/shipping management |
| Paper Backend | Receipt/invoice templates for thermal printing |

## Environments

| Env | API Domain | Auth Domain |
|-----|-----------|-------------|
| Local (dev) | `api.dev-th.patona.online` | `accounts.revette.io` |
| Development | `api.dev-th.patona.online` | `accounts.dev-th.patona.online` |
| Staging | `api.staging-th.patona.online` | `accounts.staging-th.patona.online` |
| Production | `api.patona.online` | `accounts.sellsuki.com` |

## Feature Flags (Environment Variables)

| Flag | Effect |
|------|--------|
| `VITE_DISABLE_FULFILLMENT_FEATURE` | Hides fulfillment-related menu items |
| `VITE_DISABLE_CUSTOMER_FEATURE` | Hides customer menu |
| `VITE_DISABLE_COOKIE_MATCHING` | Bypasses AMS cookie matching (dev only) |
