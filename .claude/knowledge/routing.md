# Routing

## Router

Uses `svelte-routing` (not SvelteKit). All routes are defined in `src/App.svelte` inside a `<Router>` wrapper.

## Route Table

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Home.svelte` | Dashboard home |
| `/company/new` | `NewCompany.svelte` | Create first company |
| `/company/tos` | `Tos.svelte` | Terms of service acceptance |
| `/store/new` | `NewStore.svelte` | Create new store |
| `/product` | `ProductList.svelte` | Product listing (PIS iframe) |
| `/product/add` | `ProductAdd.svelte` | Add product (PIS iframe) |
| `/sales` | `Sale.svelte` | POS sales page (cart, payment) |
| `/order` | `Orders.svelte` | Order list with filters |
| `/order/view/:order_id` | `Order.svelte` | Order detail view |
| `/customers` | `CustomerList.svelte` | Customer list |
| `/customers/new` | `CustomerCreate.svelte` | Create customer |
| `/customers/edit/:customerId` | `CustomerEdit.svelte` | Edit customer |
| `/customers/view/:customerId` | `CustomerView.svelte` | Customer detail |
| `/contact` | `ContactUs.svelte` | Contact information |
| `/settings` | `Settings/index.svelte` | User settings (language, payment, printer) |
| `*` | `NotFound.svelte` | 404 fallback |

## Route Parameters

Parameters are accessed via `let:params` in Svelte routing:

```svelte
<Route path="/order/view/:order_id" let:params>
  <OrderView orderId={params.order_id} />
</Route>

<Route path="/customers/edit/:customerId" let:params>
  <CustomerEdit customerId={params.customerId} />
</Route>
```

## Navigation

- **Client-side**: `import { navigate } from 'svelte-routing'` — for in-app navigation
- **Full page redirect**: `window.location.href = ...` — for auth redirects to AMS
- **Programmatic navigation**: `navigate('/path', { replace: true })` — for post-login redirects

## Layout Structure

All routes are wrapped in:
```svelte
<ssk-theme-provider {theme}>
  <ssk-i18n-provider store={i18nStore}>
    <ssk-toast-provider toast={toastStore}>
      <Router {url}>
        <Layout>
          <!-- Routes here -->
        </Layout>
      </Router>
    </ssk-toast-provider>
  </ssk-i18n-provider>
</ssk-theme-provider>
```

The `Layout` component (`src/components/Layout.svelte`) provides:
- Sidebar navigation with menu items grouped by domain
- Company/store selector dialog
- User profile menu (settings, logout)
- Language selector
- Unsaved changes alert modal
- i18n keyword loading

## Route Guards

- **Company check**: If `companyList.data.length === 0` → redirect to `/company/new`
- **Profile check**: If profile fails to load → navigate to `/` with replace
- **Auth check**: 401 responses trigger redirect to AMS login page
- **Loading gate**: Routes only render when `!$companyList.loading`

## Adding New Routes

1. Create page component in `src/pages/<domain>/`
2. Import in `src/App.svelte`
3. Add `<Route path="..." component={...} />` inside the `{#if !$companyList.loading}` block
4. If the route needs sidebar visibility, update the `sidebarGroups` array in `Layout.svelte`
