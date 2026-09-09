---
name: ssk-brand
description: Per-brand semantic tokens emitted by @sellsuki-org/sellsuki-components — `--text-*`, `--stroke-*`, `--icon-*`, `--bg-*`, `--fg-*`, `--link` — for the three brands `patona` (aerospace-orange), `ccs3` (sky), and `oc2plus` (sky). Includes setting brand on the provider, switching brand at runtime, persisting user preference, SSR/initial-paint handling, framework snippets (HTML, JS, React, Vue, Svelte), Storybook integration, and worked component examples (button, alert, banner, form field). Pair with `ssk-tokens` (palette / spacing / radius primitives) and `use-ssk-components` (provider wiring). TRIGGER when writing CSS that touches `--text-*` / `--bg-*` / `--stroke-*` / `--icon-*` / `--fg-*` / `--link`, when wiring or switching the `brand` attribute on `<ssk-theme-provider>`, when implementing a brand picker UI, or when deciding between a semantic vs palette token.
---

# `@sellsuki-org/sellsuki-components` — Brands & Semantic Tokens

`@sellsuki-org/sellsuki-components` ships three brands. Every brand emits the **same key set** of role-based semantic tokens — only the underlying hex values differ. Reference these tokens in your CSS so the UI re-skins automatically when the user (or the host app) swaps brand.

> Companion skills:
> - **`ssk-tokens`** — palette, spacing, border, radius, font tokens (brand-invariant).
> - **`use-ssk-components`** — install, provider stack, framework wiring.
> - **`ssk-components-catalog`** — exact prop names per `<ssk-*>` tag.

> Auto-generated from `src/contexts/theme/semantic-tokens.ts` by the maintainers' `/sync-skill`. Re-run `npx @sellsuki-org/sellsuki-components update-claude` after every minor release.

---

## Quick reference

| If you want to …                                            | Use …                                                                |
|-------------------------------------------------------------|----------------------------------------------------------------------|
| Body text on a light surface                                | `color: var(--text-primary);`                                        |
| Brand-accented label / link                                 | `color: var(--text-brand-primary);` (or `var(--link)`)               |
| Default page background                                     | `background: var(--bg-primary);`                                     |
| Solid brand fill (CTA button)                               | `background: var(--bg-brand-solid);` / hover `--bg-brand-solid-hover`|
| 1-px hairline divider                                       | `border-bottom: var(--border-xxs) solid var(--stroke-primary);`      |
| Brand outline (focus ring / chip border)                    | `outline: 2px solid var(--stroke-brand-solid);`                      |
| Coloured fill for an SVG icon                               | `fill: var(--icon-brand);` / `var(--icon-danger)` / …                |
| Success / warning / error / info accent                     | `--text-success-primary`, `--bg-warning-solid`, `--stroke-danger`, … |
| Disabled state                                              | `--text-disabled`, `--bg-disabled`, `--stroke-disabled`              |
| Switch brand at runtime                                     | `provider.setAttribute("brand", "ccs3")` — see §2.2                  |
| Read the current brand from JS                              | `provider.getAttribute("brand")` — see §8                            |

---

## 1. Available brands

### 1.1 Brand → preset → palette family

| Brand       | Preset name           | Brand palette family   | Default for       |
|-------------|-----------------------|------------------------|-------------------|
| `patona`    | `patonaTokens`        | `aerospace-orange`     | Patona            |
| `ccs3`      | `sellsukiSkyTokens`   | `sky`                  | CCS3              |
| `oc2plus`   | `sellsukiSkyTokens`   | `sky`                  | OC2+              |

> `ccs3` and `oc2plus` currently share the same semantic-token set (`sellsukiSkyTokens`). The split exists so they can diverge without a code change.

### 1.2 Where the brands differ

The brand-specific tokens are everything matching the patterns `--text-brand-*`, `--stroke-brand-*`, `--icon-brand*`, `--bg-brand-*`, `--fg-brand-*`. Within the brand family the **stop selection is identical** — only the underlying palette changes. The non-brand-prefixed semantic tokens (text-primary / bg-secondary / stroke-danger / …) are the **same hex** across all brand presets today.

| Token                       | `patona`                  | `ccs3` / `oc2plus`        |
|-----------------------------|---------------------------|---------------------------|
| `--text-brand-primary`      | `aerospace-orange.500`    | `sky.500`                 |
| `--text-brand-hover`        | `aerospace-orange.600`    | `sky.600`                 |
| `--stroke-brand`            | `aerospace-orange.300`    | `sky.300`                 |
| `--stroke-brand-solid`      | `aerospace-orange.500`    | `sky.500`                 |
| `--stroke-brand-lighter`    | `aerospace-orange.100`    | `sky.100`                 |
| `--icon-brand`              | `aerospace-orange.500`    | `sky.500`                 |
| `--icon-brand-hover`        | `aerospace-orange.600`    | `sky.600`                 |
| `--bg-primary-hover`        | `gray.100`                | `gray.50`                 |
| `--bg-brand-primary`        | `aerospace-orange.50`     | `sky.50`                  |
| `--bg-brand-secondary`      | `aerospace-orange.100`    | `sky.100`                 |
| `--bg-brand-solid`          | `aerospace-orange.500`    | `sky.500`                 |
| `--bg-brand-solid-hover`    | `aerospace-orange.600`    | `sky.600`                 |
| `--fg-brand-primary`        | `aerospace-orange.500`    | `sky.500`                 |
| `--fg-brand-secondary`      | `aerospace-orange.400`    | `sky.400`                 |

If you reference one of these tokens, your styling will **automatically re-paint** when the consumer swaps brand. If you reference `--ssk-colors-aerospace-orange-500` directly, it will **not** — that's locked to one palette.

---

## 2. Setting & switching brand

### 2.1 Initial mount (HTML)

```html
<ssk-theme-provider brand="patona">
  <ssk-i18n-provider lang="th">
    <ssk-toast-provider>
      <!-- your app -->
    </ssk-toast-provider>
  </ssk-i18n-provider>
</ssk-theme-provider>
```
Available brands: `"patona"` (default if omitted via `defaultTheme`), `"ccs3"`, `"oc2plus"`. Any other value is silently ignored and the previous brand stays active.

### 2.2 Switching at runtime (imperative JS)

```ts
const provider = document.querySelector("ssk-theme-provider")!;
provider.setAttribute("brand", "ccs3");
// Every descendant re-paints automatically — no need to remount.
```

Behavior:
- `ThemeProvider.updated()` watches the `brand` property and calls `injectSemanticTokens(brand)`, which writes every `--text-*` / `--stroke-*` / `--icon-*` / `--bg-*` / `--fg-*` / `--link` onto `document.documentElement.style`.
- Subsequent reads of `var(--text-brand-primary)` resolve to the new value on the next style recalculation (synchronous).

### 2.3 React (controlled state)

```tsx
import "@sellsuki-org/sellsuki-components";
import { useState } from "react";

type Brand = "patona" | "ccs3" | "oc2plus";

export function App() {
  const [brand, setBrand] = useState<Brand>("patona");
  return (
    <ssk-theme-provider brand={brand}>
      <header>
        <button onClick={() => setBrand("patona")}>Patona</button>
        <button onClick={() => setBrand("ccs3")}>CCS3</button>
        <button onClick={() => setBrand("oc2plus")}>OC2+</button>
      </header>
      <main>…</main>
    </ssk-theme-provider>
  );
}
```

The `brand` attribute is a plain string, so React's JSX → setAttribute path handles it without any ref dance.

### 2.4 Vue 3

```vue
<script setup lang="ts">
import "@sellsuki-org/sellsuki-components";
import { ref } from "vue";
const brand = ref<"patona" | "ccs3" | "oc2plus">("patona");
</script>

<template>
  <ssk-theme-provider :brand="brand">
    <button @click="brand = 'ccs3'">CCS3</button>
    <slot />
  </ssk-theme-provider>
</template>
```

Remember to mark `ssk-*` as a custom element in `vite.config.ts` (see `use-ssk-components` §4.3).

### 2.5 Svelte

```svelte
<script lang="ts">
  import "@sellsuki-org/sellsuki-components";
  let brand: "patona" | "ccs3" | "oc2plus" = "patona";
</script>

<ssk-theme-provider {brand}>
  <button on:click={() => (brand = "oc2plus")}>OC2+</button>
  <slot />
</ssk-theme-provider>
```

### 2.6 Persisting the user choice

```ts
type Brand = "patona" | "ccs3" | "oc2plus";
const KEY = "ssk-brand";

export function loadBrand(): Brand {
  const v = localStorage.getItem(KEY);
  return v === "patona" || v === "ccs3" || v === "oc2plus" ? v : "patona";
}

export function saveBrand(brand: Brand) {
  localStorage.setItem(KEY, brand);
  document.querySelector("ssk-theme-provider")?.setAttribute("brand", brand);
}
```

### 2.7 SSR / initial paint

`<ssk-theme-provider>` runs `injectSemanticTokens(brand)` in `updated()`, which is **client-side only**. To avoid an un-themed flash:

1. **Render the attribute server-side** so the upgrade picks up the right brand on first hydration:
   ```html
   <ssk-theme-provider brand="patona">…</ssk-theme-provider>
   ```
2. **Optionally inject the tokens in a blocking `<style>` tag** so the colours land before the custom element registers. Use this only if you measured a real FOUC:
   ```html
   <head>
     <style id="ssk-bootstrap">
       :root {
         --text-primary: #1f2937;
         --bg-primary:   #ffffff;
         --bg-brand-solid: #ff6a14;   /* patona */
         /* ...repeat for the ~50 brand-specific tokens you actually use first-paint... */
       }
     </style>
   </head>
   ```
   Generate this stylesheet from `injectSemanticTokens` output at build time so it can never drift from the runtime values.

---

## 3. Semantic token reference

Every key below appears on `:root` for **every** brand. The value differs by brand only for the brand-prefixed keys (see §1.2).

### 3.1 Text

For `color:` on text elements.

| Token                       | Purpose                                            |
|-----------------------------|----------------------------------------------------|
| `--text-primary`            | Default body text                                   |
| `--text-primary-hover`      | Hover variant of primary text                       |
| `--text-secondary`          | Secondary / muted text                              |
| `--text-secondary-hover`    | Hover variant of secondary text                     |
| `--text-white`              | Text on dark / solid brand fills                    |
| `--text-disabled`           | Disabled text                                       |
| `--text-placeholder`        | Input placeholder                                   |
| `--text-brand-primary`      | Brand-accented text (link, badge, headline accent)  |
| `--text-brand-hover`        | Hover variant of `--text-brand-primary`             |
| `--link`                    | Anchor text colour                                  |
| `--text-danger-primary`     | Error message text                                  |
| `--text-warning-primary`    | Warning message text                                |
| `--text-success-primary`    | Success message text                                |
| `--text-info`               | Info message text                                   |

```css
.headline { color: var(--text-primary); }
.subtitle { color: var(--text-secondary); }
.cta      { color: var(--text-brand-primary); }
a         { color: var(--link); }
```

### 3.2 Stroke (borders / dividers)

For `border-color:` / `outline-color:` / `--ssk-shadow-color`.

| Token                       | Purpose                                            |
|-----------------------------|----------------------------------------------------|
| `--stroke-primary`          | Default outline (input, card)                       |
| `--stroke-primary-solid`    | High-contrast outline (focus ring, popover)         |
| `--stroke-secondary`        | Subtle outline (table row divider)                  |
| `--stroke-disabled`         | Disabled outline                                    |
| `--stroke-brand`            | Brand outline (chip, tab)                           |
| `--stroke-brand-solid`      | Brand outline (focus ring on brand CTA)             |
| `--stroke-brand-lighter`    | Brand outline (subtle, on coloured bg)              |
| `--stroke-danger`           | Error outline                                       |
| `--stroke-danger-solid`     | Error outline (focus ring)                          |
| `--stroke-danger-lighter`   | Error outline (subtle, on tinted bg)                |
| `--stroke-warning`          | Warning outline                                     |
| `--stroke-warning-solid`    | Warning outline (focus ring)                        |
| `--stroke-warning-lighter`  | Warning outline (subtle, on tinted bg)              |
| `--stroke-success`          | Success outline                                     |
| `--stroke-success-solid`    | Success outline (focus ring)                        |
| `--stroke-success-lighter`  | Success outline (subtle, on tinted bg)              |
| `--stroke-info`             | Info outline                                        |
| `--stroke-info-solid`       | Info outline (focus ring)                           |
| `--stroke-info-lighter`     | Info outline (subtle, on tinted bg)                 |
| `--stroke-gray-lighter`     | Hairline divider                                    |

```css
.card  { border: var(--border-xxs) solid var(--stroke-primary); }
.input { border: var(--border-xxs) solid var(--stroke-primary); }
.input:focus { outline: 2px solid var(--stroke-brand-solid); }
hr     { border-top: var(--border-xxs) solid var(--stroke-gray-lighter); }
```

### 3.3 Icon

For `fill:` / `color:` on `<ssk-icon>` and inline SVG.

| Token                       | Purpose                                            |
|-----------------------------|----------------------------------------------------|
| `--icon-primary`            | Default icon colour                                 |
| `--icon-disabled`           | Disabled icon                                       |
| `--icon-info`               | Info icon (`ⓘ`)                                     |
| `--icon-danger`             | Danger / destructive icon (`⚠ trash`)               |
| `--icon-success`            | Success icon (`✓`)                                  |
| `--icon-warning`            | Warning icon (`!`)                                  |
| `--icon-white`              | Icon on solid brand button                          |
| `--icon-dark`               | Icon on light bg, high-contrast                     |
| `--icon-brand`              | Brand-accented icon                                 |
| `--icon-brand-hover`        | Hover variant of brand icon                         |
| `--icon-link`               | Link icon (external, arrow)                         |

```css
.toolbar svg { fill: var(--icon-primary); }
.toolbar svg.brand { fill: var(--icon-brand); }
button:disabled svg { fill: var(--icon-disabled); }
```

### 3.4 Background

For `background:` on surfaces and fills.

| Token                       | Purpose                                            |
|-----------------------------|----------------------------------------------------|
| `--bg-primary`              | Page background (default `white`)                   |
| `--bg-primary-hover`        | Hover variant of primary bg                         |
| `--bg-secondary`            | Nested surface (panel inside a panel)               |
| `--bg-tertiary`             | High-contrast surface                               |
| `--bg-quaternary`           | Subtle alternating row                              |
| `--bg-primary-solid`        | Inverse / dark surface (banner)                     |
| `--bg-active`               | Active list item                                    |
| `--bg-disabled`             | Disabled control bg                                 |
| `--bg-disabled-soft`        | Disabled control bg, softer                         |
| `--bg-brand-primary`        | Subtle brand-tinted surface                         |
| `--bg-brand-secondary`      | Slightly stronger brand-tinted surface              |
| `--bg-brand-solid`          | Solid brand fill (primary CTA)                      |
| `--bg-brand-solid-hover`    | Hover variant of brand solid fill                   |
| `--bg-danger-primary`       | Danger surface (subtle tint)                        |
| `--bg-danger-solid`         | Danger solid fill                                   |
| `--bg-warning-primary`      | Warning surface (subtle tint)                       |
| `--bg-warning-solid`        | Warning solid fill                                  |
| `--bg-success-primary`      | Success surface (subtle tint)                       |
| `--bg-success-solid`        | Success solid fill                                  |
| `--bg-info-primary`         | Info surface (subtle tint)                          |
| `--bg-info-solid`           | Info solid fill                                     |

```css
body            { background: var(--bg-primary); }
.cta            { background: var(--bg-brand-solid); color: var(--text-white); }
.cta:hover      { background: var(--bg-brand-solid-hover); }
.menu-item.active { background: var(--bg-active); }
.alert-success  { background: var(--bg-success-primary); }
```

### 3.5 Foreground (UI fills, not text)

`--fg-*` is used by Sellsuki elements to colour foreground glyphs / strokes inside composite widgets (toggle thumb, progress fill, etc.). You'll mostly use it when re-styling those parts via `::part(...)` or when building your own primitive that fits the design system.

| Token                       | Purpose                                            |
|-----------------------------|----------------------------------------------------|
| `--fg-primary`              | Default fg fill                                     |
| `--fg-secondary`            | Muted fg                                            |
| `--fg-secondary-hover`      | Hover variant of muted fg                           |
| `--fg-white`                | Fg on dark / brand-solid bg                         |
| `--fg-placeholder`          | Placeholder fg                                      |
| `--fg-disabled`             | Disabled fg                                         |
| `--fg-brand-primary`        | Brand fg                                            |
| `--fg-brand-secondary`      | Softer brand fg                                     |
| `--fg-danger-primary`       | Danger fg                                           |
| `--fg-danger-secondary`     | Softer danger fg                                    |
| `--fg-warning-primary`      | Warning fg                                          |
| `--fg-warning-secondary`    | Softer warning fg                                   |
| `--fg-success-primary`      | Success fg                                          |
| `--fg-success-secondary`    | Softer success fg                                   |

```css
.toggle::part(thumb) { background: var(--fg-white); }
.progress-fill       { background: var(--fg-brand-primary); }
```

---

## 4. Worked examples

### 4.1 Brand-aware button (looks correct in every brand)

```css
.brand-cta {
  display: inline-flex; align-items: center; gap: var(--spacing-sm);
  padding: var(--spacing-lg) var(--spacing-3xl);
  background: var(--bg-brand-solid);
  color:      var(--text-white);
  border:     var(--border-xxs) solid var(--bg-brand-solid);
  border-radius: var(--radius-md);
  font-weight:   var(--ssk-font-weight-semibold);
  cursor: pointer;
}
.brand-cta:hover    { background: var(--bg-brand-solid-hover); border-color: var(--bg-brand-solid-hover); }
.brand-cta:focus-visible { outline: 2px solid var(--stroke-brand-solid); outline-offset: 2px; }
.brand-cta[disabled]{ background: var(--bg-disabled); border-color: var(--bg-disabled); color: var(--text-disabled); cursor: not-allowed; }
```
Swap `<ssk-theme-provider brand="patona">` ↔ `"ccs3"` and the button repaints orange ↔ sky-blue automatically.

### 4.2 Status alert (success / warning / error / info)

```css
.alert { display: flex; gap: var(--spacing-lg); padding: var(--spacing-3xl); border-radius: var(--radius-lg); border: var(--border-xxs) solid transparent; }

.alert--success { background: var(--bg-success-primary); border-color: var(--stroke-success-lighter); color: var(--text-success-primary); }
.alert--warning { background: var(--bg-warning-primary); border-color: var(--stroke-warning-lighter); color: var(--text-warning-primary); }
.alert--danger  { background: var(--bg-danger-primary);  border-color: var(--stroke-danger-lighter);  color: var(--text-danger-primary);  }
.alert--info    { background: var(--bg-info-primary);    border-color: var(--stroke-info-lighter);    color: var(--text-info);            }

.alert svg.success { fill: var(--icon-success); }
.alert svg.warning { fill: var(--icon-warning); }
.alert svg.danger  { fill: var(--icon-danger);  }
.alert svg.info    { fill: var(--icon-info);    }
```

### 4.3 Brand banner

```css
.brand-banner {
  background: var(--bg-brand-primary);
  border-bottom: var(--border-xxs) solid var(--stroke-brand-lighter);
  padding: var(--spacing-4xl) var(--spacing-6xl);
  color: var(--text-brand-primary);
}
.brand-banner h1 { color: var(--text-brand-primary); font-weight: var(--ssk-font-weight-bold); }
.brand-banner p  { color: var(--text-secondary); }
```

### 4.4 Form field with default / focus / error states

```css
.field input {
  width: 100%;
  padding: var(--spacing-xl) var(--spacing-2xl);
  border: var(--border-xxs) solid var(--stroke-primary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
}
.field input::placeholder { color: var(--text-placeholder); }
.field input:focus-visible { outline: none; border-color: var(--stroke-brand-solid); box-shadow: 0 0 0 3px var(--stroke-brand-lighter); }
.field[data-error] input  { border-color: var(--stroke-danger-solid); box-shadow: 0 0 0 3px var(--stroke-danger-lighter); }
.field[data-error] small  { color: var(--text-danger-primary); }
.field input:disabled     { background: var(--bg-disabled-soft); color: var(--text-disabled); border-color: var(--stroke-disabled); }
```

---

## 5. Semantic vs palette decision

| Use case                                                   | Token group                                          | Skill        |
|------------------------------------------------------------|------------------------------------------------------|--------------|
| Anything that should re-skin per brand                     | brand semantic (`--text-*`, `--bg-*`, `--stroke-*`, `--icon-*`, `--fg-*`, `--link`) | This skill |
| Status colour (success / warning / error / info)           | brand semantic — these stay consistent across brands | This skill   |
| Brand-invariant accent (zebra striping, code block tint)   | palette (`--ssk-colors-gray-200`, …)                  | `ssk-tokens` |
| Spacing / sizing / typography                              | `--spacing-*` / `--radius-*` / `--ssk-font-*`         | `ssk-tokens` |

**Rule of thumb:** if a designer can imagine a brand wanting it different, use a semantic token. Hex literals are a smell; palette tokens are only acceptable for hardcoded chrome (zebra rows, fenced code blocks, monochrome avatars).

---

## 6. TypeScript usage

```ts
import { Brand } from "@sellsuki-org/sellsuki-components";

// `Brand` is both a value and a type:
const allBrands: Brand[] = [Brand.patona, Brand.ccs3, Brand.oc2plus];
//   ↑ values              ↑ "patona",   "ccs3",   "oc2plus"

function setBrand(b: Brand) {
  document.querySelector("ssk-theme-provider")?.setAttribute("brand", b);
}
```

The element-side `HTMLElementTagNameMap` augmentation also gives you `.brand` autocompletion on the provider:

```ts
const provider = document.querySelector<HTMLElement & { brand?: Brand }>("ssk-theme-provider");
provider?.setAttribute("brand", "ccs3"); // ← type-checked literal
```

---

## 7. Storybook brand switching

The shipped Storybook (`.storybook/preview.ts`) wraps every story in `<ssk-theme-provider>`. To switch brand inside one story, nest a second provider:

```ts
export const InOC2: StoryObj = {
  render: () => html`
    <ssk-theme-provider brand="oc2plus">
      <ssk-button themeColor="primary">CTA in OC2+</ssk-button>
    </ssk-theme-provider>
  `,
};
```

For a Storybook **global toolbar** that switches brand for every story, the maintainers' design-system repo has a `cross-brand-check` skill that wires up the toolbar — open Storybook in their repo for a reference.

---

## 8. Detecting the current brand at runtime

```ts
type Brand = "patona" | "ccs3" | "oc2plus";

export function currentBrand(): Brand {
  const v = document.querySelector("ssk-theme-provider")?.getAttribute("brand");
  return v === "patona" || v === "ccs3" || v === "oc2plus" ? v : "patona";
}
```

Watch for changes:

```ts
const provider = document.querySelector("ssk-theme-provider")!;
new MutationObserver(() => console.log("brand changed →", provider.getAttribute("brand")))
  .observe(provider, { attributes: true, attributeFilter: ["brand"] });
```

---

## 9. Common mistakes

| ❌  Wrong                                                          | ✅  Right                                                     |
|------------------------------------------------------------------|--------------------------------------------------------------|
| `background: #ff6a14;`                                           | `background: var(--bg-brand-solid);`                          |
| `color: var(--ssk-colors-aerospace-orange-500);` (hardcoded brand) | `color: var(--text-brand-primary);`                           |
| Removing & re-creating `<ssk-theme-provider>` to switch brand    | Call `provider.setAttribute("brand", "ccs3")` — descendants re-paint automatically |
| Setting `brand="patona-light"` or a custom string                 | Only `patona` / `ccs3` / `oc2plus` are accepted — others are silently ignored |
| Reading `--bg-brand-solid` from a stylesheet loaded **before** the provider mounts | Mount `<ssk-theme-provider>` first (or pre-paint the brand via SSR — see §2.7) |
| Relying on `--bg-primary-hover` being identical across brands     | It differs (`gray.100` for patona, `gray.50` for ccs3/oc2plus). If you need an invariant hover bg, use a palette token from `ssk-tokens`. |
| Using `--text-brand-primary` in a place that must stay neutral     | Use `--text-primary` / `--text-secondary` instead             |

---

## 10. Adding a brand or semantic token (maintainers only)

These steps live in the design-system repo, not in consumer projects. Consumers see only the result.

1. Add the brand to the `Brand` const in `src/contexts/theme/semantic-tokens.ts`.
2. Define a new token map (e.g. `myNewBrandTokens: SemanticTokenMap`) — copy the shape of `patonaTokens` and override hex values.
3. Map the brand to its token preset in `semanticTokens`.
4. Run the maintainers' `cross-brand-check` skill to confirm every element renders correctly under the new brand.
5. Run `/sync-skill` so the next published package includes the new brand in this skill's docs.

A new semantic token must be added to **every brand's token map** simultaneously. If one brand doesn't have an appropriate value, alias it to an existing token or pick a sensible default — never omit it.
