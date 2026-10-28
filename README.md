# Patona Seller Center — Frontend

Merchant portal for the Patona/Sellsuki platform: companies, stores, orders, customers,
products and the POS sales screen. Svelte 4 + TypeScript + Vite 5 (plain SPA, not
SvelteKit).

This copy is a working mirror of the GitLab origin
(`gitlab.sellsuki.com:sellsuki/patona/…`) used to review and hand off the POS rework.

## Run it

```bash
bun install

bun run start:local        # .env.dev — dev identity headers, no AMS cookie matching
bun run start:development  # .env.development — staging APIs, real login
bun run build:staging      # production build against the staging APIs
bun run check              # svelte-check
```

Environment files are per-environment and tracked in this (private) repo:
`.env.dev`, `.env.development`, `.env.staging`, `.env.production`.
`.env.example` lists every key with empty values.

### Reviewing the UI with no backend

```bash
bun run build:demo    # or set VITE_MOCK_API=true in .env.dev and run start:local
```

`VITE_MOCK_API=true` swaps in an axios adapter (`src/lib/mock/mock-api.ts`) that answers
every request — profile, one company with three branches, configuration, orders,
customers, products, Thai keywords — and grants every permission. No login, no network.
The `deploy/static-host/` folder holds the SPA rewrite rules for dropping the resulting
`dist/` on Netlify or Vercel. Mock data only — never point it at real data.

## Design system

`@sellsuki-org/sellsuki-components` is pinned to the published **0.27.1**. Two fixes made
during the POS review are **not** in that release and are still open on the DS branch
`feat/ds1-font-token-logo`:

- `ssk-drawer-header` renders its title as `<ssk-heading level="1">`, and `ssk-heading`
  renders `<h1><slot/></h1>`. The title text is therefore _slotted_, so it inherits from
  the light-DOM host (16px) and never sees the `h1`'s own font-size — measured on 0.27.1:
  host `ssk-heading` 16px/400, inner `h1` 32px with a 24px line-height, painted title
  **16px**, i.e. a heading that renders at body size while the `h1` box is sized for 32px.
  The fix has the header own its typography (`<h2 class="title">` plus
  `--ssk-drawer-title-*` hooks, 20px/600) instead of inheriting it.
- `ssk-dynamic-table` owns no typography, so header cells inherit whatever font-size an
  ancestor sets. The fix adds `size` / `headerSize` props publishing `--table-font-*`.

Until those land and a 0.27.2 is published, drawer titles here are the same size as the
body text around them.

## What the POS screen does today

`/sales` — `src/pages/sales/`, cart in `src/pages/sales/cart/`.

- **Channels**: POS / ONLINE / LINK_BILL across the top of the cart. The order payload
  still carries the two-value `SaleChannelType` (POS → offline, the others → online)
  because the backend has no link-bill channel yet, so **LINK_BILL's CTA is deliberately
  inert**. The online sub-channel (LINE / Facebook / Shopee / …) is a cart field and
  writes `saleChannel.saleOrigin`, the same field the online drawer always wrote.
- **One decision per row**, each under its own label; the customer block carries its
  delivery address inside itself.
- **Customer + address in one drawer** (`section/DrawerCustomerAddress.svelte`): views for
  the customer list, the create form, the summary and the address form. Address edits are
  matched by id, never by row position.
- **Pick-up-later** sales choose the branch the customer collects from
  (`section/ModalPickupBranch.svelte`). With no pickup field in the order API, the choice
  rides on the order's `seller` block — see `setSellerInfo` in `src/stores/order/order.ts`,
  the single place to redirect once a real field exists.
- **Item list fills the panel** in every state; folding the header hands it that space.
  Totals shrink and scroll so the clear/pay buttons stay pinned to the bottom.
- Discount and note are modals; the compact customer summary masks the phone
  (`081***5678`, `src/utils/format-phone.ts`).

### Not built yet (from the OMS 2.0 spec)

Fulfilment is still the three-value enum (the spec has seven) · no item-options modal,
service booking, digital-delivery email or separate delivery-method block · shipping fee
is display-only and does not enter the total · payment tabs are the fixed four, not the
per-channel matrix · no link-bill result screen.

Known layout issue, pre-dating this work: the cart panel collapses to ~115px at a 1024px
viewport because `.right-section` has no `min-width`.

## Conventions

See `.claude/CLAUDE.md` and `.claude/rules/` — Svelte 4 with `<script lang="ts">`, `$lib`
/ `$components` / `$pages` / `$stores` / `$utils` / `$service` aliases, the
`*-gen.ts` + `*-rest.ts` + `*-adapter.ts` service pattern, stores as
`{ loading, data }`, Thai UI copy, and `data-testid` on interactive elements (stripped in
production builds).

## CI

`.github/workflows/ci.yml` installs with a frozen lockfile, runs `svelte-check` (three
pre-existing errors in `GeoNameBreadCrumb.svelte` are reported but do not fail the run)
and builds `--mode staging`, uploading `dist/` as an artifact. No deploy step yet: point
it at a host and add the environment values as repository secrets.
