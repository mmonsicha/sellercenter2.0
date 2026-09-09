# Tech Stack & File Organization

## Framework & Build

| Technology | Version | Purpose |
|-----------|---------|---------|
| Svelte | 4.2.x | UI framework (NOT SvelteKit — plain Svelte SPA) |
| Vite | 5.x | Build tool and dev server |
| TypeScript | 5.2.x | Type system |
| Bun | (see .nvmrc) | Package manager and runtime |
| svelte-routing | 2.11.x | Client-side routing |
| axios | 1.9.x | HTTP client |
| yup | 1.4.x | Form validation schemas |
| svelte-forms-lib | 2.0.x | Form state management |
| dexie | 4.0.x-beta | IndexedDB wrapper (for i18n keyword cache) |

## UI Component Library

- `@sellsuki-org/sellsuki-components` — Sellsuki design system (web components)
- Components are used as custom elements: `<ssk-theme-provider>`, `<ssk-i18n-provider>`, `<ssk-toast-provider>`
- Theme is applied via `applyTheme()` with custom color palette (primary orange `#EC5E2A`)
- Context providers: `setContext('toast', toastStore)`, `setContext('i18n', i18nStore)`

## Path Aliases (vite.config.js + tsconfig.json)

```
$lib       → src/lib/
$components → src/components/
$pages     → src/pages/
$stores    → src/stores/
$utils     → src/utils/
$types     → src/types/
```

**Always use path aliases** — never use relative paths like `../../lib/`.

## File Organization

### Pages (`src/pages/`)
- One directory per domain: `company/`, `customer/`, `order/`, `product/`, `sales/`, `setting/`, `store/`
- Page components: `PascalCase.svelte` (e.g., `List.svelte`, `Create.svelte`, `Edit.svelte`)
- Sub-directories for complex views: `order/list/`, `order/view/`
- Page-specific sub-components live alongside the page (e.g., `order/list/FilterPopup.svelte`)

### Components (`src/components/`)
- Shared reusable components: `Layout.svelte`, `StoreDialog.svelte`
- Grouped by concern: `form/`, `modal/`, `drawer/`, `dropdown/`, `payment/`
- Component naming: `PascalCase.svelte`

### Stores (`src/stores/`)
- Svelte writable stores grouped by domain: `cart/`, `company/`, `order/`, `store/`, etc.
- Pattern: `writable<State>({ loading: false, data: undefined })`
- Derived stores for computed values
- Async load functions that update store state
- Export individual stores and functions (no default exports)

### Services (`src/service/`)
- Three-file pattern per API domain:
  - `*-gen.ts` — Auto-generated OpenAPI types (DO NOT EDIT)
  - `*-rest.ts` — API call functions using axios client
  - `*-adapter.ts` — snake_case API response -> camelCase entity mapping
- Services: `management`, `customer-book-v2`, `pis`, `central-configuration`, `i18n`, `doms`, `papers`
- Special: `accounts.ts` — AMS cookie matching (uses fetch, not axios)

### Entities (`src/lib/entities/`)
- TypeScript interfaces per domain: `address/`, `company/`, `customer/`, `order/`, `payment/`, `store/`, etc.
- Each entity file exports: interface(s), enums, factory functions (`newOrder()`, `newCompany()`)
- Entities are camelCase; adapters convert from snake_case API responses

### Utils (`src/utils/`)
- `auth-redirect.ts` — 401/unauthenticated detection logic
- `navigate.ts` — AMS redirect functions (login, logout, register, settings)
- `format-date.ts`, `format-number.ts` — formatting helpers
- `form-validation/` — Yup schemas for forms (Thai validation messages)
- `queryParams.ts` — URL query parameter utilities

## Svelte Component Structure

```svelte
<script lang="ts">
  // 1. Imports (use $aliases)
  import { writable } from 'svelte/store';
  import Component from '$components/Component.svelte';
  import { someStore } from '$stores/domain';
  import type { Entity } from '$lib/entities/domain/entity';

  // 2. Props (export let)
  export let propName: string;

  // 3. Local state
  let localVar = '';

  // 4. Reactive declarations
  $: derivedValue = $someStore.data?.field;

  // 5. Functions
  function handleAction() { ... }

  // 6. Lifecycle
  import { onMount } from 'svelte';
  onMount(async () => { ... });
</script>

<!-- Template -->
<div>
  {#if condition}
    <Component />
  {/if}
</div>
```

## Testing

- Unit tests: `vitest` (configured but minimal coverage currently)
- `data-testid` attributes stripped in production builds via `svelte-preprocess-remove-attribute`
- Use `data-testid` for test selectors in development

## Preprocessors

- `vitePreprocess()` — standard Svelte preprocessing
- `removeAttribute` — removes `data-testid` and `testId` attributes in production
- a11y warnings are suppressed in `svelte.config.js`
