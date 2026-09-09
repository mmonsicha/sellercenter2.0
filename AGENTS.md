# AGENTS.md — Seller Center Frontend

Comprehensive guide for AI agents working on this codebase.

## Project Overview

**Seller Center** is a multi-tenant merchant management SPA built with **Svelte 4 + TypeScript + Vite 5**. It enables Thai SMB merchants to manage companies, stores, orders, customers, products (via PIS), and POS sales within the Sellsuki/Patona platform.

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Svelte 4.2.x | UI framework (NOT SvelteKit — plain SPA) |
| TypeScript 5.2.x | Type system |
| Vite 5.x | Build tool + dev server (port 5173) |
| svelte-routing 2.11.x | Client-side routing |
| axios 1.9.x | HTTP client (two clients: `newAxiosClient` preferred, `axiosClient` legacy) |
| yup 1.4.x | Form validation |
| svelte-forms-lib 2.0.x | Form state management |
| @sellsuki-org/sellsuki-components | Design system (web components `<ssk-*>`) |
| dexie 4.0.x-beta | IndexedDB (i18n keyword cache) |
| vitest 1.2.x | Unit testing |

## Project Structure

```
src/
  App.svelte              # Root — router, providers, theme, routes
  main.ts                 # Entry point
  main.css                # Global CSS variables
  pages/                  # Route-level components
    company/              #   Company CRUD
    customer/             #   Customer CRUD
    order/                #   Order list + detail
      list/               #     Filters, search, table
      view/               #     Order detail with actions
    product/              #   PIS iframe integration
    sales/                #   POS cart, payment, receipts
    setting/              #   User settings
    store/                #   Store CRUD
    contact/              #   Contact page
  components/             # Reusable UI components
    Layout.svelte         #   Sidebar, header, company selector
    form/                 #   Address, company, customer, store forms
    modal/                #   Confirm, unsaved changes modals
    drawer/               #   Channel, company detail drawers
    dropdown/             #   Menu dropdown
    payment/              #   Payment method components
  stores/                 # Svelte writable/derived stores
    cart/                 #   POS cart state
    company/              #   Company list, current company
    order/                #   Order list, filters
    store/                #   Store list, current store
    configuration.ts      #   User preferences (central config)
    i18n.ts               #   Language, keywords
    profile.ts            #   User profile + auth state
    layout.ts             #   Sidebar state
  service/                # API integration layer
    management-rest.ts    #   Management API (company, store, order)
    management-adapter.ts #   snake_case → camelCase mapping
    management-gen.ts     #   Generated OpenAPI types (DO NOT EDIT)
    customer-book-v2-*    #   Customer Book v2 API
    pis-*                 #   Product Information System API
    central-configuration-* # Central Config API
    i18n-*                #   i18n Management API
    accounts.ts           #   AMS auth (fetch-based)
  lib/
    axios-client-v2.ts    #   Preferred Axios factory (with request dedup)
    axios.client.ts       #   Legacy Axios class
    entities/             #   TypeScript interfaces per domain
      address/address.ts  #     Address, Country, GeoNames
      company/company.ts  #     Company with stores
      customer/customer.ts#     Customer, TaxInformation
      order/order.ts      #     Order, Item, Task, enums
      payment/payment.ts  #     PaymentChannel, BankTransfer
      store/store.ts      #     Store
      identity/profile.ts #     User Profile
      sale/sale.ts        #     SaleProduct, SaleVariant
      configuration/      #     UserConfiguration
      i18n/               #     KeywordDetail, Language
  utils/
    auth-redirect.ts      #   401/unauthenticated detection
    navigate.ts           #   AMS redirect functions
    form-validation/      #   Yup schemas (Thai messages)
    format-date.ts        #   Date formatting
    format-number.ts      #   Number formatting
    queryParams.ts        #   URL query utilities
```

## Architecture Patterns

### API Three-File Pattern

Every backend domain uses three files:
1. `*-gen.ts` — Auto-generated OpenAPI types. **NEVER edit manually.** Regenerate with `bun run generate-openapi:<domain>`.
2. `*-rest.ts` — API call functions. Use `newAxiosClient` for new services. Type responses against `*-gen.ts`.
3. `*-adapter.ts` — Pure mapping functions. Convert snake_case API responses to camelCase entity interfaces. Always provide safe defaults.

### Svelte Store Pattern

```typescript
interface EntityState {
  loading: boolean;
  data: Entity[] | undefined;
}

export const entityStore = writable<EntityState>({ loading: false, data: undefined });

export async function loadEntities() {
  entityStore.update(s => ({ ...s, loading: true }));
  const data = await fetchEntities();
  entityStore.set({ loading: false, data });
}
```

### Entity Pattern

- Interfaces in `src/lib/entities/<domain>/` with camelCase fields
- Factory functions: `newOrder()`, `newCompany()`, `newStore()`, etc.
- Enums for known value sets (OrderFlow, PaymentType, Status, etc.)
- API types stay in `*-gen.ts`; entities are the app's internal representation

### Routing Pattern

- All routes in `src/App.svelte` using `<Route>` from `svelte-routing`
- Wrapped in `<Layout>` for sidebar/header
- Gated by `{#if !$companyList.loading}` to prevent rendering before data loads
- Route params via `let:params` pattern

### Auth Pattern

- Cookie-based via AMS (Account Management System)
- Cookie matching flow on startup
- Dev mode: `VITE_ADDITIONS_HEADERS` with `X-User-Id` for local development
- Auto-redirect to login on 401/unauthenticated responses (axios interceptor)

## Code Exploration — MANDATORY First Step

This project has a pre-built code knowledge graph. **Always query the graph before exploring or modifying code.**

### Available tools (prefix: `mcp__plugin_code-review-graph_code-review-graph__`)

| Tool | When to use |
|------|------------|
| `query_graph_tool(pattern, target)` | Explore code structure and relationships |
| `get_impact_radius_tool(target)` | Assess blast radius before making changes |
| `get_review_context_tool(file_path)` | Get full context for reviewing a file |
| `semantic_search_nodes_tool(query)` | Find code by meaning/concept |
| `build_or_update_graph_tool()` | Rebuild graph after significant changes |

### Query patterns

| Pattern | Purpose | Example target |
|---------|---------|---------------|
| `children_of` | List contents of a file/directory | `src/service` |
| `file_summary` | All exports in a file | `src/service/management-rest.ts` |
| `callers_of` | Who calls this function | `storeCreateOrder` |
| `callees_of` | What this function calls | `loadCompany` |
| `imports_of` | What a file imports | `src/stores/profile.ts` |
| `importers_of` | Who imports this module | `src/lib/entities/order/order.ts` |
| `tests_for` | Find tests for a target | `toOrder` |

### Protocol

1. **Before any task**: Query the graph to map relevant files and dependencies
2. **Before modifying a file**: Run `get_impact_radius_tool` to understand downstream effects
3. **After significant changes**: Run `build_or_update_graph_tool()` to keep the graph current

## Backend Services

| Service | Env Var | Protocol | Purpose |
|---------|---------|----------|---------|
| Management | `VITE_MANAGEMENT_URL` | REST/HTTP | Company, Store, Order, Payment, Profile |
| Customer Book v2 | `VITE_CUSTOMER_BOOK_V2_URL` | REST/HTTP | Customer CRUD |
| PIS | `VITE_PIS_URL` | REST/HTTP + iframe | Product catalog |
| Central Config | `VITE_CENTRAL_CONFIGURATION_SYSTEM_URL` | REST/HTTP | User/company preferences |
| i18n Management | `VITE_I18N_URL` | REST/HTTP | Translation keywords |
| AMS | `VITE_AMS_URL` | HTTP (fetch) | Authentication |

## Path Aliases

Always use these aliases — never relative paths:

| Alias | Maps to |
|-------|---------|
| `$lib` | `src/lib/` |
| `$components` | `src/components/` |
| `$pages` | `src/pages/` |
| `$stores` | `src/stores/` |
| `$utils` | `src/utils/` |
| `$types` | `src/types/` |

## Build & Check Commands

```bash
bun install              # Install dependencies
bun run start:local      # Dev server with auth bypass (.env.dev)
bun run start:development # Dev server with staging APIs
bun run build            # Production build
bun run check            # svelte-check type checking
bun run test:unit        # vitest unit tests
```

## Key Constraints

- **Svelte 4** — not SvelteKit, not Svelte 5. Components use `export let` for props, `$:` for reactivity.
- **No Tailwind, no CSS-in-JS** — Styling via `@sellsuki-org/sellsuki-components` or scoped `<style>` blocks.
- **Thai primary language** — User-facing text defaults to Thai. Use i18n keywords for multilingual support.
- **Never edit `*-gen.ts`** — These are auto-generated from Swagger/OpenAPI specs.
- **Never read `.env` files** — Protected by a PreToolUse hook.
- **`providerCode` is always `"patona"`** — Multi-tenant identifier, sourced from `VITE_PROVIDER_CODE`.

## Agent-Specific Instructions

Detailed agent configurations are in `.claude/agents/`:
- `architect-developer.md` — For planning, design decisions, and full-stack implementation
- `developer.md` — For focused feature implementation following established patterns
- `qa.md` — For code review, testing, and quality verification
