---
name: use-ssk-components
description: Use this skill in any frontend (Lit, React, Vue, Svelte, or vanilla HTML) that consumes @sellsuki-org/sellsuki-components. Covers install, provider stack, brand selection, theme tokens, framework-specific quirks for binding properties/events, and the full tag catalog. TRIGGER when the consumer code imports `@sellsuki-org/sellsuki-components`, references an `<ssk-*>` custom element, or asks how to wire a Sellsuki Design System primitive.
---

# Using `@sellsuki-org/sellsuki-components`

A portable reference skill for any Sellsuki front-end that consumes the Design System web-component library. Install it into your project with:

```bash
npm install @sellsuki-org/sellsuki-components
npx @sellsuki-org/sellsuki-components init-claude
```

This places the file at `.claude/skills/use-ssk-components.md` in your repo and the AI working there will know how to wire ssk-components correctly. Re-run `init-claude --force` (or `update-claude`) after every package upgrade.

This skill is auto-generated from the current source tree by the maintainers (`/sync-skill`). The "Component catalog" section is the part that changes most often — re-sync after every minor release.

> Companion skills (auto-loaded alongside this one when you `init-claude`):
> - **`ssk-components-catalog`** — exact prop names, types, events, and slots for every `<ssk-*>` tag.
> - **`ssk-tokens`** — palette, spacing, border, radius, font tokens + the `cssVar` / `parseVariables` helpers.
> - **`ssk-brand`** — per-brand semantic tokens (`--text-*`, `--bg-*`, `--stroke-*`, `--icon-*`, `--fg-*`) and brand-switching flow.
>
> This skill stays high-level (install, providers, framework wiring, common patterns). Drill into the companion skills for exact token names, brand values, or per-tag prop tables.

> Library: `@sellsuki-org/sellsuki-components`
> Built on: Lit 3, Web Components / Shadow DOM
> Framework-neutral: works in Lit, React (18+), Vue 3, Svelte, Angular, vanilla HTML

---

## 1. Install

```bash
npm install @sellsuki-org/sellsuki-components
```

`peerDependencies`: `lit` (already a transitive dep, but a recent `lit@^3` in your app keeps the bundle small).

## 2. Bootstrap the provider stack

**Without `<ssk-theme-provider>` everything renders broken.** Theme tokens are CSS custom properties and elements have no hardcoded fallbacks — missing the provider means missing colors, spacing, borders, the lot.

```ts
// app entry (run once)
import "@sellsuki-org/sellsuki-components";
import "@sellsuki-org/sellsuki-components/style.css";
```

```html
<ssk-theme-provider brand="patona">
  <ssk-i18n-provider lang="th"><!-- .store=${i18nStore} -->
    <ssk-toast-provider><!-- .toast=${toastStore} -->
      <!-- your app -->
    </ssk-toast-provider>
  </ssk-i18n-provider>
</ssk-theme-provider>
```

Available brands: `patona` (default), `ccs3`, `oc2plus`.

| Provider                | Required?  | What it gives you                                       | Construct your own store via             |
| ----------------------- | ---------- | ------------------------------------------------------- | ---------------------------------------- |
| `<ssk-theme-provider>`  | **Yes**    | Color/spacing/border/radius/typography tokens per brand | Built-in defaults — just set `brand`     |
| `<ssk-i18n-provider>`   | Optional¹  | i18n templating + `<ssk-i18n-translate>` lookups        | `new IdbI18nStore("my-app")` (from the package) |
| `<ssk-toast-provider>`  | Optional¹  | Global toast queue used by `<ssk-toast>`                | `new InMemoryToastStore()` (from the package)   |

¹ Optional only if your app doesn't render the elements that depend on them. Most production apps include all three.

## 3. Theme tokens (CSS custom properties)

After `<ssk-theme-provider>` mounts, two layers of CSS custom properties are available on `:root`:

| Layer                  | Examples                                                          | Where to look                    |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------- |
| Palette                | `--ssk-colors-primary-500`, `--ssk-colors-gray-900`               | **`ssk-tokens`** skill — full palette catalog |
| Spacing                | `--spacing-xxs` … `--spacing-15xl`                                | **`ssk-tokens`** skill           |
| Border / Radius        | `--border-xxs` … `--border-sm`, `--radius-none` … `--radius-full` | **`ssk-tokens`** skill           |
| Font                   | `--ssk-font-family-*`, `--ssk-font-weight-*`                      | **`ssk-tokens`** skill           |
| Brand semantic — text  | `--text-primary`, `--text-brand-primary`, `--link`                | **`ssk-brand`** skill            |
| Brand semantic — bg    | `--bg-primary`, `--bg-brand-primary`, `--bg-danger-solid`         | **`ssk-brand`** skill            |
| Brand semantic — stroke| `--stroke-primary`, `--stroke-brand`, `--stroke-danger-lighter`   | **`ssk-brand`** skill            |
| Brand semantic — icon  | `--icon-primary`, `--icon-brand`, `--icon-danger`                 | **`ssk-brand`** skill            |
| Brand semantic — fg    | `--fg-primary`, `--fg-brand-primary`, `--fg-danger-secondary`     | **`ssk-brand`** skill            |

**Rule of thumb for your own CSS:**
- Use **brand semantic tokens** (`--text-primary`, `--bg-brand-primary`) for anything that should re-skin when the brand changes. → see **`ssk-brand`**.
- Use **palette / spacing / radius / border tokens** for brand-invariant accents and layout. → see **`ssk-tokens`**.
- Never inline hex.

## 4. Framework-specific wiring

Web components have one quirky rule: HTML attributes accept **strings**, properties accept **anything**. Pass primitives via attributes; pass objects/arrays/functions via properties.

### Lit / vanilla HTML

```ts
import { html } from "lit";

html`
  <ssk-button variant="solid" themeColor="primary" ?disabled=${isLoading}>
    Save
  </ssk-button>

  <ssk-dropdown .options=${[{ value: "a", label: "Alpha" }]}
                @ssk-change=${(e) => this.onChange(e.detail.value)}>
  </ssk-dropdown>
`;
```

Reactive bindings cheat-sheet:
- `attr="value"` — static string attribute
- `?attr=${bool}` — boolean attribute (adds/removes)
- `.prop=${value}` — JS property (objects, arrays, functions)
- `@event=${handler}` — event listener

### React (18+)

React 18 still passes complex props through `setAttribute`, which stringifies them. **You must use refs for object/array props** — or upgrade to React 19, which finally handles custom elements properly. Until then:

```tsx
import { useEffect, useRef } from "react";
import "@sellsuki-org/sellsuki-components";

export function StatusDropdown({ options, onChange }) {
  const ref = useRef<HTMLElement>(null);

  // Object/array props: assign on ref
  useEffect(() => {
    if (ref.current) (ref.current as any).options = options;
  }, [options]);

  // Custom events: addEventListener on ref
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: CustomEvent) => onChange(e.detail.value);
    el.addEventListener("ssk-change", handler as EventListener);
    return () => el.removeEventListener("ssk-change", handler as EventListener);
  }, [onChange]);

  // Primitive props are fine as JSX attrs
  return <ssk-dropdown ref={ref} placeholder="Select status" />;
}
```

Caveats:
- JSX type errors: add `declare namespace JSX { interface IntrinsicElements { "ssk-button": any; /* ... */ } }` once in your project, or use the published `HTMLElementTagNameMap` augmentation via `@sellsuki-org/sellsuki-components`.
- Event names are kebab-case (`ssk-change`), not camelCase. React does **not** auto-uppercase them.
- For React 19: `<ssk-dropdown options={options} onSskChange={handler} />` works natively.

### Vue 3

Mark Sellsuki tags as custom elements in `vite.config.ts`:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("ssk-") } } })],
});
```

Then:

```vue
<template>
  <ssk-dropdown
    :options="options"            <!-- :prop="value" binds as JS property -->
    placeholder="Select status"
    @ssk-change="onChange"        <!-- kebab-case event names -->
  />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import "@sellsuki-org/sellsuki-components";
  let options = [{ value: "a", label: "Alpha" }];
  function onChange(e) { console.log(e.detail.value); }
</script>

<!-- Bind object prop with explicit prop directive -->
<ssk-dropdown options={options} on:ssk-change={onChange} placeholder="Pick one" />
```

In `svelte.config.js`, set `compilerOptions.customElement = false` and add a tag matcher to silence "Unknown HTML tag" warnings:

```js
preprocess: vitePreprocess({ script: true }),
// In your tsconfig: include lib "DOM" and the package type augmentation.
```

### Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to every module that uses `ssk-*` tags:

```ts
@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [],
})
export class AppModule {}
```

Bind object props via property binding (`[options]="options"`); listen with `(ssk-change)="onChange($event)"`.

## 5. Common patterns

### Form field

```html
<ssk-input
  label="Email"
  type="email"
  name="email"
  placeholder="you@example.com"
  helperText="We'll never share this"
  status=${hasError ? "error" : ""}
  .value=${value}
  @input=${(e) => setValue(e.target.value)}
></ssk-input>
```

### Confirm modal

```html
<ssk-modal ?open=${isOpen} @ssk-close=${() => setOpen(false)}>
  <ssk-heading slot="header" size="lg">Delete record?</ssk-heading>
  <ssk-text>This cannot be undone.</ssk-text>
  <div slot="footer" style="display:flex; gap: var(--spacing-md); justify-content: flex-end;">
    <ssk-button variant="ghost" @click=${cancel}>Cancel</ssk-button>
    <ssk-button variant="solid" themeColor="danger" @click=${confirm}>Delete</ssk-button>
  </div>
</ssk-modal>
```

### Tagging the brand at the root

```html
<!-- index.html -->
<ssk-theme-provider brand="patona">
  <div id="root"></div>
</ssk-theme-provider>
```

Switch brand at runtime by updating the attribute — every descendant re-renders against the new tokens.

### Toast usage

```ts
import { InMemoryToastStore } from "@sellsuki-org/sellsuki-components";

const toast = new InMemoryToastStore();
toast.addToast({
  type: "success",                // "success" | "error" | "info" | "warning"
  title: "Saved",
  message: "Your changes are live.",
  timeout: 5000,                  // ms; 0 disables auto-dismiss
});
```

Pass the store to `<ssk-toast-provider .toast=${toast}>` once at the app root. The provider polls `requestUpdate()` every 100 ms, so mutating `toast.toasts` is enough — no manual re-render. See `ssk-components-catalog` for the full `ToastStore` / `ToastData` interfaces.

## 6. Component catalog

> Auto-generated from `src/{elements,components,contexts}/`. Re-run `/sync-skill` in the design-system repo after every release.

### Contexts (mount once at the app root)

| Tag                      | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `<ssk-theme-provider>`   | Inject brand tokens onto `:root`         |
| `<ssk-i18n-provider>`    | Provide i18n store + active language     |
| `<ssk-i18n-template>`    | Templated translation string             |
| `<ssk-i18n-translate>`   | Simple key→string translation            |
| `<ssk-toast-provider>`   | Mount the toast queue                    |
| `<ssk-toast>`            | Toast renderer (auto-mounted by provider)|

### Elements (atomic UI)

| Group         | Tags                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| Form & Input  | `ssk-button`, `ssk-input`, `ssk-input-addon`, `ssk-input-range`, `ssk-input-tag`, `ssk-textarea`, `ssk-checkbox`, `ssk-toggle`, `ssk-radio`, `ssk-radio-group`, `ssk-pin-code`, `ssk-card-select`, `ssk-card-group` |
| Typography    | `ssk-heading`, `ssk-text`                                                                  |
| Indicators    | `ssk-badge`, `ssk-tag`, `ssk-spinner`, `ssk-skeleton`, `ssk-progress-bar`, `ssk-alert`     |
| Media         | `ssk-avatar`, `ssk-image`, `ssk-icon`, `ssk-country-icon`, `ssk-logo`, `ssk-code-block`, `ssk-date-display`    |
| Layout        | `ssk-container`, `ssk-divider`, `ssk-accordion`, `ssk-accordion-item`                       |
| Navigation    | `ssk-tab-header`, `ssk-tab-button`, `ssk-top-navbar`, `ssk-menu-group`, `ssk-menu-items`    |
| Widgets       | `ssk-widget-example`, `ssk-widget-matric`, `ssk-widget-table`, `ssk-widget-title`, `ssk-widget-user-detail` |

### Components (composed widgets)

| Group         | Tags                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| Overlay       | `ssk-modal`, `ssk-drawer`, `ssk-drawer-header`, `ssk-tooltip`                              |
| Data display  | `ssk-table`, `ssk-table-row`, `ssk-table-cell`, `ssk-header-cell`, `ssk-cell`, `ssk-dynamic-table`, `ssk-pagination`, `ssk-timeline`, `ssk-stepper` |
| Pickers       | `ssk-dropdown`, `ssk-dropdown-button`, `ssk-dropdown-option`, `ssk-dropdown-preview`, `ssk-date-picker`, `ssk-range-date-picker`, `ssk-calendar`, `ssk-time`, `ssk-addon-phone-country` |
| Layout        | `ssk-tabs`, `ssk-card`, `ssk-expandable-card`, `ssk-sidebar`, `ssk-sidebar-group`, `ssk-sidebar-header`, `ssk-sidebar-item`, `ssk-sidebar-list` |
| Media         | `ssk-image-cropper`, `ssk-wave-icon`, `ssk-misc-icon`                                       |
| Files         | `ssk-download-file`                                                                         |
| Dashboards    | `ssk-widget-grid`                                                                           |

For **per-prop documentation**, see the `ssk-components-catalog` skill (drops in next to this file) — it has the full prop/event/slot table for every tag.

For **token catalog** (palette names, spacing scale, helpers) see **`ssk-tokens`**. For **per-brand semantic tokens** (`--text-*`, `--bg-*`, `--stroke-*`, `--icon-*`, `--fg-*`) see **`ssk-brand`**.

For live, interactive docs see [Storybook autodocs](#) (link to the design-system team's hosted Storybook).

## 7. Common prop conventions

Most theme-aware elements accept the same base set. Memorise these once and you can use any element without looking up its full prop table.

| Prop              | Values                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------- |
| `themeColor`      | `primary` \| `secondary` \| `success` \| `warning` \| `error` \| `danger` \| `info` \| any palette name |
| `size`            | `3xs` \| `2xs` \| `xs` \| `sm` \| `md` (default) \| `lg` \| `xl` \| `2xl` … or any CSS length string |
| `variant`         | element-specific — common values: `solid` \| `outline` \| `ghost` \| `solid-light`      |
| `disabled`        | boolean attribute                                                                       |
| `hidden`          | boolean attribute (renders nothing)                                                     |
| `padding`         | size token (`md`, `lg`) **or** raw value (`1rem`, `12px`)                               |
| `width`, `height` | CSS length or `full` / `screen` / `min` / `max` / `fit`                                 |
| `fontFamilyGroup` | `sans` (default) \| `serif` \| `mono`                                                   |
| `fontWeight`      | `thin` \| `light` \| `normal` \| `medium` \| `semibold` \| `bold` \| `extrabold` \| `black` |
| `rounded`         | radius token (`md`, `lg`, `full`) or CSS length                                          |
| `testId`          | string — emitted as `data-testid` for end-to-end tests                                   |

If a prop accepts a token name (`md`), it also accepts a raw value (`1.5rem`). The library resolves it via `cssVar()` + `parseVariables()`.

## 8. Events

Element events fall into two buckets:

- **Re-dispatched native events** — `click`, `input`, `change`, `focus`, `blur`. The library wraps them as `CustomEvent` with `detail: { originalEvent }`. Listen exactly as you would for a native control.
- **Custom domain events** — prefixed `ssk-`. Examples: `ssk-open`, `ssk-close`, `ssk-change`, `ssk-select`. Payload sits on `event.detail`.

All events bubble and cross shadow boundaries (`composed: true`).

## 9. Troubleshooting

| Symptom                                              | Likely cause                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Nothing has color or spacing                         | Missing `<ssk-theme-provider>` in the ancestor tree                          |
| Inputs ignore `.value=${...}`                        | In React you must assign via ref; JSX attributes stringify                    |
| `customElement already defined` warning              | The package was bundled twice (check `lit` is the only externalized dep)      |
| TypeScript can't find `<ssk-button>` in JSX          | Augment `JSX.IntrinsicElements` once (React) or set `isCustomElement` (Vue)   |
| Style overrides don't apply                          | Element uses Shadow DOM. Use the `::part(...)` API or change the relevant `--ssk-*` custom property at a higher level |
| Brand swap doesn't update colors                     | You changed `brand` after first paint but bypassed Lit reactivity — set the attribute, don't replace the element  |
| Toast doesn't appear                                 | Missing `<ssk-toast-provider .toast=${store}>` at the app root                |

## 10. Versioning

This library follows SemVer:

- **patch** — bug fix, no visible change
- **minor** — new tag or new prop, no breaking change → safe to upgrade
- **major** — renamed/removed prop, removed tag, default behavior change, token rename → read the migration note in the maintainers' Outline UX/UI collection

Stay within a single major version across all your micro-frontends; mismatched majors can register the same custom-element name twice.

## 11. Where to learn more

- Companion skills (auto-installed by `npx ... init-claude`):
  - **`ssk-components-catalog`** — per-tag props/events/slots reference
  - **`ssk-tokens`** — palette, spacing, border, radius, font tokens + helpers
  - **`ssk-brand`** — per-brand semantic tokens and brand-switching flow
- Source: the design-system repo's `src/{elements,components,contexts}/`
- Live catalog: hosted Storybook (link from the maintainers)
- Tokens reference: `src/contexts/theme/default.ts`, `semantic-tokens.ts`
- Per-brand spec sheets: Outline → UX/UI collection
- Bug reports / requests: Jira (LR project, or the project your team uses for design-system tickets)
