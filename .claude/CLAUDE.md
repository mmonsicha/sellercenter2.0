# Seller Center Frontend

Patona Seller Center is a multi-tenant SPA for merchants to manage companies, stores, orders, customers, products, and sales (POS). Built with Svelte 4 + TypeScript + Vite 5.

## Quick Start

```bash
bun install
bun run start:local      # .env.dev — dev headers, no cookie matching
bun run start:development # .env.development — staging APIs
bun run build             # production build
bun run check             # svelte-check type checking
```

## Architecture Overview

| Layer | Location | Purpose |
|-------|----------|---------|
| Pages | `src/pages/` | Route-level Svelte components |
| Components | `src/components/` | Reusable UI (Layout, forms, modals, drawers) |
| Stores | `src/stores/` | Svelte writable/derived stores (state management) |
| Services | `src/service/` | API calls (`*-rest.ts`) + data mapping (`*-adapter.ts`) |
| Entities | `src/lib/entities/` | TypeScript interfaces (domain models) |
| Lib | `src/lib/` | Axios clients, shared utilities |
| Utils | `src/utils/` | Auth, formatting, form validation, navigation |

## Key Conventions

- **Svelte 4** (not SvelteKit) — client-side SPA with `svelte-routing`
- **TypeScript** — `<script lang="ts">` in all `.svelte` files
- **Path aliases**: `$lib`, `$components`, `$pages`, `$stores`, `$utils`, `$types`
- **State management**: Svelte writable/derived stores in `src/stores/`
- **API pattern**: OpenAPI codegen (`*-gen.ts`) + REST client (`*-rest.ts`) + adapter (`*-adapter.ts`)
- **Two Axios clients**: class-based `axiosClient` (legacy) and functional `newAxiosClient` (preferred)
- **UI components**: `@sellsuki-org/sellsuki-components` web components (`<ssk-*>`)
- **i18n**: keyword-based via `@sellsuki-org/sellsuki-components` IdbI18nStore
- **Forms**: `svelte-forms-lib` + `yup` validation with Thai error messages
- **Auth**: Cookie-based via AMS (Account Management System) with cookie matching flow

## Rules & Knowledge

Read all files in `.claude/rules/` and `.claude/knowledge/` before any task. Rules define *how* to code; knowledge defines *what* the service is.

## Commands

| Command | Purpose |
|---------|---------|
| `dev` | Start dev server |
| `build` | TypeScript check + Vite build |
| `add-component` | Scaffold a new Svelte component |
| `add-page` | Scaffold a new page + route |
| `add-service` | Scaffold REST service + adapter |

## Skills

| Skill | Purpose |
|-------|---------|
| `implement` | Architect-driven feature implementation |
| `scaffold-feature` | Full feature scaffold (entity -> service -> page -> route) |
| `review` | Post-implementation review cycle |
| `debug-api` | Debug API integration issues |
