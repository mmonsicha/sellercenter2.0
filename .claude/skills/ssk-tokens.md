---
name: ssk-tokens
description: Detailed reference for the brand-invariant design tokens shipped by @sellsuki-org/sellsuki-components — spacing primitives, semantic spacing, border width, radius, color palette, font tokens — plus the cssVar / parseVariables / parseThemeToCssVariables / applyTheme helpers. Includes ready-to-paste examples in plain CSS, Lit, React, Vue, Svelte, and Tailwind. Pair with `use-ssk-components` (high-level wiring), `ssk-brand` (per-brand semantic tokens), and `ssk-components-catalog` (per-tag prop names). TRIGGER whenever generating CSS or markup that references `--ssk-*` / `--spacing-*` / `--radius-*` / `--border-*` / `--ssk-font-*` custom properties, when picking a size / colour name to pass to a Sellsuki prop, when calling `cssVar()` / `parseVariables()`, or when overriding a theme value via `<ssk-theme-provider .theme>`.
---

# `@sellsuki-org/sellsuki-components` — Design Tokens

`<ssk-theme-provider>` injects every token below onto `:root` (via `injectSpaceTokens()`) and a subset of brand-specific semantic tokens (via `injectSemanticTokens(brand)`). Use these tokens in your own CSS — **never inline a hex value or a `px` length**, or the design system can't re-skin you.

> Companion skills — drill into these for the matching surface:
> - **`use-ssk-components`** — install, providers, framework wiring, brand selection.
> - **`ssk-brand`** — per-brand semantic tokens (`--text-*`, `--bg-*`, `--stroke-*`, `--icon-*`, `--fg-*`) and brand-switching flow.
> - **`ssk-components-catalog`** — exact prop names for each `<ssk-*>` tag.

> Auto-generated from `src/contexts/theme/default.ts` and `src/types/theme.ts` by the maintainers' `/sync-skill`. Re-run `npx @sellsuki-org/sellsuki-components update-claude` in your project after every minor release to pull the latest version.

---

## Quick reference

| If you want to …                                  | Use …                                                         | Section |
|---------------------------------------------------|---------------------------------------------------------------|---------|
| Add padding / margin / gap                        | `var(--spacing-xs … --spacing-15xl)`                          | §2      |
| Round a corner                                    | `var(--radius-xxs … --radius-4xl)` or `--radius-full` (pill)  | §3      |
| Draw a 1-px hairline                              | `var(--border-xxs)`                                            | §3      |
| Pick a colour that's the **same across brands**   | `var(--ssk-colors-<name>-<scale>)`                            | §4      |
| Pick a colour that **changes with brand**         | See `ssk-brand` (`--text-*`, `--bg-*`, etc.)                  | →       |
| Set a font family                                 | `var(--ssk-font-family-sans \| serif \| mono)`                | §5      |
| Build a CSS-var name from a token group + value   | `cssVar("spacing", "md")` → `"--ssk-spacing-md"`              | §6.1    |
| Resolve a prop value that may be a token name or a raw length | `parseVariables(cssVar("spacing", size), "1rem")` | §6.2    |
| Override the entire theme tree from the consumer  | `applyTheme({...}) → <ssk-theme-provider .theme=${…}>`        | §6.4    |

---

## 1. Token system overview

Tokens are arranged in two layers. **Always consume the upper (semantic) layer**, never the primitives directly, so the design team can re-scale without breaking your code.

```
defaultSpacePrimitives          ←  raw scale  (space-0 … space-128 + space-9999)
        │
        ▼
defaultSpacingTokens            ←  semantic   (--spacing-xxs … --spacing-15xl)
defaultBorderTokens             ←              (--border-none, --border-xxs, …)
defaultRadiusTokens             ←              (--radius-none … --radius-full)
defaultColorPallete             ←  per-scale  (--ssk-colors-primary-50 … 900)
        │
        ▼
brand semantic tokens           ←  per-brand role-based (--text-primary, --bg-surface, …)
   patona / ccs3 / oc2plus          (see the `ssk-brand` skill)
```

| Layer                  | Where it lives in source                          | Who reads it                                       |
|------------------------|---------------------------------------------------|----------------------------------------------------|
| Primitives             | `defaultSpacePrimitives`, `defaultColorPallete`   | Maintainers only — referenced by semantic layer    |
| Semantic spacing/border/radius | `defaultSpacingTokens`, `defaultBorderTokens`, `defaultRadiusTokens` | **You** — directly in CSS via `var(--spacing-md)` |
| Palette (per scale)    | `defaultColorPallete`                              | **You** — for brand-invariant accents              |
| Brand semantic         | `semantic-tokens.ts` (`patonaTokens`, `sellsukiSkyTokens`) | **You** — for anything that should re-skin per brand |

---

## 2. Spacing

### 2.1 Spacing primitives

Source — `src/contexts/theme/default.ts → defaultSpacePrimitives`. These are referenced by the semantic layer; you rarely consume them directly.

| Key             | rem         | px  |
|-----------------|-------------|-----|
| `space-0`       | `0`         | 0   |
| `space-1`       | `0.065rem`  | 1   |
| `space-2`       | `0.125rem`  | 2   |
| `space-4`       | `0.25rem`   | 4   |
| `space-6`       | `0.375rem`  | 6   |
| `space-8`       | `0.5rem`    | 8   |
| `space-10`      | `0.625rem`  | 10  |
| `space-12`      | `0.75rem`   | 12  |
| `space-16`      | `1rem`      | 16  |
| `space-20`      | `1.25rem`   | 20  |
| `space-24`      | `1.5rem`    | 24  |
| `space-32`      | `2rem`      | 32  |
| `space-40`      | `2.5rem`    | 40  |
| `space-44`      | `2.75rem`   | 44  |
| `space-48`      | `3rem`      | 48  |
| `space-56`      | `3.5rem`    | 56  |
| `space-64`      | `4rem`      | 64  |
| `space-72`      | `4.5rem`    | 72  |
| `space-80`      | `5rem`      | 80  |
| `space-96`      | `6rem`      | 96  |
| `space-128`     | `8rem`      | 128 |
| `space-9999`    | `9999rem`   | —   |

> You normally don't reference these directly. Use the semantic spacing tokens below.

### 2.2 Semantic spacing

These CSS custom properties are injected on `:root` the moment `<ssk-theme-provider>` mounts.

| Token              | rem         | px  | Typical use                  |
|--------------------|-------------|-----|------------------------------|
| `--spacing-none`   | `0`         | 0   | Reset                        |
| `--spacing-xxs`    | `0.065rem`  | 1   | Hairline gap                 |
| `--spacing-xs`     | `0.125rem`  | 2   | Tight inline spacing         |
| `--spacing-sm`     | `0.25rem`   | 4   | Icon-to-text gap             |
| `--spacing-md`     | `0.375rem`  | 6   | Compact stack gap            |
| `--spacing-lg`     | `0.5rem`    | 8   | Default control padding      |
| `--spacing-xl`     | `0.625rem`  | 10  | Form field padding           |
| `--spacing-2xl`    | `0.75rem`   | 12  | Card inner padding           |
| `--spacing-3xl`    | `1rem`      | 16  | Section padding              |
| `--spacing-4xl`    | `1.25rem`   | 20  | Card outer gap               |
| `--spacing-5xl`    | `1.5rem`    | 24  | Container padding            |
| `--spacing-6xl`    | `2rem`      | 32  | Page gutter                  |
| `--spacing-7xl`    | `2.5rem`    | 40  | Layout / hero spacing        |
| `--spacing-8xl`    | `2.75rem`   | 44  | Layout / hero spacing        |
| `--spacing-9xl`    | `3rem`      | 48  | Layout / hero spacing        |
| `--spacing-10xl`   | `3.5rem`    | 56  | Layout / hero spacing        |
| `--spacing-11xl`   | `4rem`      | 64  | Layout / hero spacing        |
| `--spacing-12xl`   | `4.5rem`    | 72  | Layout / hero spacing        |
| `--spacing-13xl`   | `5rem`      | 80  | Layout / hero spacing        |
| `--spacing-14xl`   | `6rem`      | 96  | Layout / hero spacing        |
| `--spacing-15xl`   | `8rem`      | 128 | Layout / hero spacing        |

### 2.3 Using semantic spacing

#### Plain CSS
```css
.card {
  padding: var(--spacing-3xl);                          /* 16px */
  gap: var(--spacing-lg);                               /* 8px  */
  margin-block: var(--spacing-5xl);                     /* 24px */
}
```

#### Inside a Sellsuki element prop (Lit / HTML)
Many props accept a token name **or** a raw CSS length — the package resolves it for you:
```html
<ssk-container padding="3xl"></ssk-container>           <!-- 16px      -->
<ssk-container padding="1.25rem"></ssk-container>       <!-- raw value -->
<ssk-container padding="var(--spacing-3xl)"></ssk-container>
```
Under the hood the element calls `parseVariables(cssVar("spacing", padding), padding)`, so a name wins, and a raw value falls through. See §6 for the helper APIs.

#### React (JSX) — props that aren't typed for custom elements
```tsx
<ssk-container style={{ padding: "var(--spacing-3xl)" }} />
```
JSX stringifies primitives correctly, so passing the token string through `style` is the simplest reach into the design system from React. For object-shaped props see `use-ssk-components` §4.

#### Tailwind
Either reference the variable from `@apply`:
```css
.btn { @apply px-[var(--spacing-2xl)] py-[var(--spacing-lg)]; }
```
or extend `tailwind.config` to expose the design tokens:
```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      spacing: {
        "ssk-lg":  "var(--spacing-lg)",
        "ssk-2xl": "var(--spacing-2xl)",
        "ssk-3xl": "var(--spacing-3xl)",
      },
    },
  },
};
```

---

## 3. Border & Radius

### 3.1 Border width
Source — `defaultBorderTokens`.

| Token          | rem         | px |
|----------------|-------------|----|
| `--border-none`| `0`         | 0  |
| `--border-xxs` | `0.065rem`  | 1  |
| `--border-xs`  | `0.125rem`  | 2  |
| `--border-sm`  | `0.25rem`   | 4  |

```css
.card { border: var(--border-xxs) solid var(--stroke-primary); }
```
> The colour `--stroke-primary` is a **brand semantic token** (see `ssk-brand`) — pair the width with a semantic stroke so the border re-skins automatically.

### 3.2 Border radius
Source — `defaultRadiusTokens`. `--radius-full` is the pill / circle radius (`9999rem`).

| Token           | rem         | px    | Typical use         |
|-----------------|-------------|-------|---------------------|
| `--radius-none` | `0`         | 0     | Reset               |
| `--radius-xxs`  | `0.125rem`  | 2     | Tiny chip           |
| `--radius-xs`   | `0.25rem`   | 4     | Tag                 |
| `--radius-sm`   | `0.375rem`  | 6     | Input               |
| `--radius-md`   | `0.5rem`    | 8     | Button              |
| `--radius-lg`   | `0.75rem`   | 12    | Card                |
| `--radius-xl`   | `1rem`      | 16    | Modal               |
| `--radius-2xl`  | `1.25rem`   | 20    | Drawer              |
| `--radius-3xl`  | `1.5rem`    | 24    | Banner              |
| `--radius-4xl`  | `2rem`      | 32    | Hero card           |
| `--radius-full` | `9999rem`   | pill  | Avatar, badge, FAB  |

### 3.3 Using radius

```css
.btn         { border-radius: var(--radius-md); }
.avatar      { border-radius: var(--radius-full); }
.modal       { border-radius: var(--radius-xl); }
```

Inside a Sellsuki prop:
```html
<ssk-button rounded="md">Save</ssk-button>
<ssk-avatar rounded="full" src="…"></ssk-avatar>
```

---

## 4. Color palette

Source — `src/contexts/theme/default.ts → defaultColorPallete`.

Every palette has the scales `50 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 / 900` (some also have `1000`). CSS variables are emitted as `--ssk-colors-<name>-<scale>`.

> Prefer palette tokens for **brand-invariant** accents (zebra stripes, code blocks, neutral hairlines). For anything that should re-skin per brand, use `--text-*` / `--bg-*` / `--stroke-*` / `--icon-*` / `--fg-*` from the `ssk-brand` skill instead.

### 4.1 Role palettes

The names below resolve to a 10-stop colour ramp each, for use as **brand-invariant** semantic accents.

`primary`, `secondary`, `success`, `warning`, `error`, `danger`, `info`, `text`, `background`.

| State                         | Recommended stop |
|-------------------------------|------------------|
| Surface / extremely subtle bg | `50` / `100`     |
| Hover fill on light surface   | `100` / `200`    |
| Default outline               | `300` / `400`    |
| Default solid fill            | `500`            |
| Hover solid fill              | `600`            |
| Active / pressed              | `700`            |
| On-dark text                  | `800` / `900`    |

```css
.alert-error {
  background: var(--ssk-colors-error-50);
  border:     var(--border-xxs) solid var(--ssk-colors-error-300);
  color:      var(--ssk-colors-error-700);
}
```

### 4.2 Named palettes

`white`, `black`, `vin-rouge`, `light-orchid`, `wisteria`, `matte-violet`, `matte-blue`, `cobalt-blue`, `fiord`, `navy`, `slate`, `gray`, `stone`, `brown`, `cappuccino`, `ecru`, `olive`, `lime`, `green`, `emerald`, `teal`, `turquoise`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`, `red`, `apricot`, `orange`, `aerospace-orange`, `amber`, `yellow`, `gold`, `border`.

```css
code { color: var(--ssk-colors-gray-700); background: var(--ssk-colors-gray-100); }
```

### 4.3 Brand-prefixed palettes (legacy)

`SSK-Primary`, `SSK-Secondary`, `AKT-Primary`, `AKT-Secondary`, `Beary-Primary`, `Beary-Secondary`, `Patona-Primary-Dark`, `KK-Primary`, `KK-Secondary`, `Patona-Primary-Orange`, `Patona-Secondary-Red`, `Patona-Secondary-Grey`, `OC2/New-primary`, `OC2/New-Secondary/1`, `Fuse-Primary-Blue`, `OC2/New-Secondary/2`, `Fuse-Secondary-purple`, `Fuse-Secondary-Sky`, `Fuse-Primary-Violet`, `LINE-Primary`, `LINE-Secondary-Dark`, `SHP-Primary/1`, `SHP-Primary/2`, `SHP-Secondary/1`, `SHP-Secondary/2`, `SHP-Secondary/3`.

> These are kept for legacy callsites. **Do not introduce new references to them** — use brand semantic tokens (`ssk-brand`) or the role palette (§4.1) instead. They will be removed in a future major.

### 4.4 Using the palette

#### Plain CSS — full variable name
```css
.callout {
  color:      var(--ssk-colors-primary-700);
  background: var(--ssk-colors-primary-50);
  border:     var(--border-xxs) solid var(--ssk-colors-primary-200);
}
```

#### Sellsuki element prop — `themeColor`, `color`, `backgroundColor`
Most theme-aware tags accept either a **role name** (`"primary"`), a **named palette** (`"gray"`), or **either + scale** (`"primary.700"`):
```html
<ssk-button themeColor="primary">Primary 500</ssk-button>
<ssk-button themeColor="primary.700">Primary 700</ssk-button>
<ssk-tag color="gray.500">muted</ssk-tag>
```
Without a scale suffix the element picks the `500` stop by default. The implementation does `cssVar("colors", "primary.700")` → `--ssk-colors-primary-700`.

---

## 5. Font tokens

Source — `Theme.fontFamily` / `Theme.fontWeight` / `Theme.fontSize` / `Theme.lineHeight`. Emitted by `parseThemeToCssVariables()` onto the `<ssk-theme-provider>` shadow root, and inherited down the tree.

| Token group       | CSS variables emitted                                                                                     |
|-------------------|-----------------------------------------------------------------------------------------------------------|
| Family            | `--ssk-font-family-sans`, `--ssk-font-family-serif`, `--ssk-font-family-mono`                              |
| Weight            | `--ssk-font-weight-thin`, `-extralight`, `-light`, `-normal`, `-medium`, `-semibold`, `-bold`, `-extrabold`, `-black` |
| Size              | `--ssk-font-size-<size>` for every `Size` key (`3xs`, `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` … `9xl`)   |
| Line-height       | `--ssk-line-height-<size>` for every `Size` key (matches the font-size scale)                              |

```css
.headline {
  font-family: var(--ssk-font-family-sans);
  font-weight: var(--ssk-font-weight-bold);
  font-size:   var(--ssk-font-size-2xl);
  line-height: var(--ssk-line-height-2xl);
}
```

Sellsuki elements accept the matching unions on their props:
```html
<ssk-text fontFamilyGroup="mono" fontWeight="medium" size="lg">…</ssk-text>
```

---

## 6. Helpers (TypeScript API)

Exported from the package barrel `@sellsuki-org/sellsuki-components` (re-exported from `src/types/theme.ts` and `src/contexts/theme/`).

### 6.1 `cssVar(...key)`

```ts
import { cssVar } from "@sellsuki-org/sellsuki-components";

cssVar("spacing", "md");           // → "--ssk-spacing-md"
cssVar("colors", "primary", 500);  // → "--ssk-colors-primary-500"
cssVar("colors", "primary.700");   // → "--ssk-colors-primary-700"
cssVar("spacing", undefined);      // → undefined  (short-circuits)
```

Behavior:
- Joins every key as kebab-case and prefixes the chain with `--ssk-`.
- If **any** argument is `undefined`, the whole call returns `undefined` so it falls out of a `parseVariables(...)` chain.

### 6.2 `parseVariables(...vars)`

```ts
import { parseVariables, cssVar } from "@sellsuki-org/sellsuki-components";

parseVariables(cssVar("spacing", "md"));                  // → "var(--ssk-spacing-md)"
parseVariables(cssVar("spacing", "md"), "1rem");          // → "var(--ssk-spacing-md, 1rem)"
parseVariables("--text-primary", "--ssk-colors-gray-800", "#000"); // → "var(--text-primary, var(--ssk-colors-gray-800, #000))"
parseVariables(undefined, "--spacing-md", "1rem");        // → "var(--spacing-md, 1rem)"
parseVariables("1.25rem");                                 // → "1.25rem"  (raw passthrough)
```

Behavior:
- Filters out `undefined` arguments and right-folds the rest into a nested `var(..., var(..., …))` chain.
- The first argument **not** starting with `--` terminates the chain — it becomes the final concrete fallback.
- This enables the consumer-prop pattern `parseVariables(cssVar(group, prop), prop)` — a token name wins, a raw `"1rem"` / `"20px"` falls through.

### 6.3 `parseThemeToCssVariables(theme, scope = ":host")`

```ts
parseThemeToCssVariables(this.theme);
// → <style>:host { --ssk-colors-primary-500: #44aef8; … }</style> plus any @keyframes
```

Sellsuki elements call this in `render()` to project the current `Theme` onto their shadow root. Call it manually only when SSR-rendering static markup, or when scoping a theme block to a non-`:host` selector — pass the second argument (e.g. `parseThemeToCssVariables(theme, ".my-app")`).

### 6.4 `applyTheme(partial)`

Deep-merges your partial theme over `defaultTheme` and returns the full `Theme` object. Pass that into the provider:

```ts
import { applyTheme, defaultTheme } from "@sellsuki-org/sellsuki-components";

const customTheme = applyTheme({
  fontFamily: {
    sans: ["Inter", "DB HeaventRounded", "sans-serif"],
  },
  components: {
    button: {
      rounded: { md: "10px", lg: "12px" },
    },
  },
});
```

```html
<ssk-theme-provider brand="patona" .theme=${customTheme}>…</ssk-theme-provider>
```

Use `applyTheme` to override **brand-invariant** tokens (typography, per-component overrides). For brand colour swaps, change the `brand` attribute (see `ssk-brand`).

### 6.5 Inject helpers (SSR / non-provider)

```ts
import { injectSpaceTokens, injectSemanticTokens } from "@sellsuki-org/sellsuki-components";

injectSpaceTokens();                // writes --spacing-*, --border-*, --radius-* onto <html>
injectSemanticTokens("patona");     // writes --text-*, --bg-*, --stroke-*, --icon-*, --fg-*, --link
```

Both are called automatically by `<ssk-theme-provider>` on mount and on `brand` change. Call them manually only when you can't render the provider (Workers, server-rendered static HTML, test bootstrap).

---

## 7. Worked examples

### 7.1 Card built from tokens

```css
.product-card {
  padding:          var(--spacing-4xl);          /* 20px */
  gap:              var(--spacing-2xl);          /* 12px */
  border:           var(--border-xxs) solid var(--stroke-primary);
  border-radius:    var(--radius-lg);            /* 12px */
  background:       var(--bg-primary);           /* re-skins per brand */
  color:            var(--text-primary);
  font-family:      var(--ssk-font-family-sans);
}
.product-card .price { color: var(--text-brand-primary); font-weight: var(--ssk-font-weight-bold); }
.product-card hr     { border-top: var(--border-xxs) solid var(--stroke-gray-lighter); margin: var(--spacing-3xl) 0; }
```

### 7.2 Brand-invariant accent (zebra striping)

```css
tbody tr:nth-child(even) { background: var(--ssk-colors-gray-50); }
tbody tr:nth-child(odd)  { background: var(--ssk-colors-gray-100); }
```

### 7.3 Overriding a token from the consumer

#### Override globally (write to `:root`)
```css
:root {
  --radius-lg: 0.5rem; /* tighter than the default 12px, applies everywhere */
}
```

#### Override on a single subtree
```html
<section style="--spacing-3xl: 2rem">
  <ssk-container padding="3xl">…</ssk-container>
</section>
```

#### Override via `applyTheme` (typed)
See §6.4. This is the recommended path when you want to override consistently across the app.

### 7.4 Using a Sellsuki prop that accepts token-or-raw

```ts
// inside your own Lit element
import { cssVar, parseVariables } from "@sellsuki-org/sellsuki-components";

@property({ type: String }) padding?: Size; // "md" | "1rem" | "20px"

render() {
  return html`<style>
    :host {
      padding: ${parseVariables(cssVar("spacing", this.padding ?? "md"), "0.5rem")};
    }
  </style>`;
}
```

---

## 8. Framework-specific consumption

CSS custom properties are framework-agnostic — every framework can read `var(--…)`. Only the bindings around the providers differ. See `use-ssk-components` §4 for the full provider-wiring matrix; the snippets below cover **just the token consumption** side.

### 8.1 Plain CSS / HTML
```html
<link rel="stylesheet" href="/node_modules/@sellsuki-org/sellsuki-components/dist/style.css" />
<style>
  .btn { padding: var(--spacing-lg) var(--spacing-3xl); border-radius: var(--radius-md); }
</style>
```

### 8.2 Lit (inside a custom element)
```ts
static styles = css`
  :host        { padding: var(--spacing-3xl); border-radius: var(--radius-lg); }
  :host(:hover){ background: var(--bg-primary-hover); }
`;
```

### 8.3 React
```tsx
<div style={{ padding: "var(--spacing-3xl)", borderRadius: "var(--radius-lg)" }}>…</div>
```
Or with CSS Modules / styled-components / Emotion — they all accept the same `var(…)` string.

### 8.4 Vue 3
```vue
<template>
  <div :style="{ padding: 'var(--spacing-3xl)', borderRadius: 'var(--radius-lg)' }">…</div>
</template>
```

### 8.5 Svelte
```svelte
<div style="padding: var(--spacing-3xl); border-radius: var(--radius-lg);">…</div>
```

### 8.6 Tailwind
See §2.3 above — either inline `[var(--…)]` arbitrary values, or extend `tailwind.config.ts` so the tokens become first-class utility classes.

---

## 9. TypeScript types

Importable from the package barrel:

```ts
import type {
  SizeSystem,       // "full" | "screen" | "min" | "max" | "fit" | string (raw CSS length)
  Size,             // "3xs" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" … "9xl" | string
  FontWeight,       // "thin" | "extralight" | "light" | "normal" | "medium" | "semibold" | "bold" | "extrabold" | "black"
  FontFamilyGroup,  // "sans" | "serif" | "mono"
  ColorScale,       // "50" | "100" … "900" | string
  ColorRole,        // "primary" | "secondary" | "success" | "warning" | "error" | "danger" | "info" | "light" | "dark" | "text" | "muted" | "background" | "foreground" | "shadow"
  ColorName,        // every named palette (`gray`, `sky`, `aerospace-orange`, …) | string
  Position,         // "left" | "right" | "bottom" | "center" | "top" | corner combinations
  BackgroundSize,   // "auto" | "cover" | "contain"
  ButtonVariants,   // "solid" | "outline" | "ghost" | "solid-light"
  BadgeVariants,    // "solid" | "outline" | "subtle"
  MenuVariants,     // "solid" | "outline"
  TabVariants,      // "inline" | "button"
  TabWidth,         // "true" | "false"
  TabSize,          // "md" | "sm"
  CardSize,         // "md" | "sm"
  Color,            // a single hex string or a scale record { "50": "#…", "100": "#…", … }
  ColorPalette,     // record keyed by ColorName | ColorRole → Color
  ThemeField,       // the flat per-token shape (colors, fontSize, padding, rounded, …)
  Theme,            // ThemeField + `components` partial overrides per element
} from "@sellsuki-org/sellsuki-components";
```

`Size`, `ColorScale`, and `ColorName` keep a `string` escape hatch in their unions, so a raw CSS length (`"1.25rem"`) or a custom palette name still type-checks — the runtime helpers `cssVar` + `parseVariables` resolve token names first, then pass anything else through.

---

## 10. Debugging

| Question                                            | How to answer it                                                                                                  |
|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| Which value did `--spacing-md` resolve to?          | DevTools → Elements → `:root` → Computed → search "`--spacing-md`". Each `--ssk-*` var lists its current value.    |
| Why isn't a brand colour applying?                  | Inspect a `<ssk-*>` element → look for `--text-brand-primary` under Computed. If it's missing, no `<ssk-theme-provider>` is in the ancestor tree. |
| Why does my override not take effect?               | Variables follow normal CSS specificity. A `<ssk-theme-provider>` writes onto `:host` and `:root`; an override deeper in the tree wins. Check the cascade. |
| Did `applyTheme()` actually merge in my override?   | `console.log(JSON.stringify(myTheme, null, 2))` — `applyTheme` returns the fully-merged tree.                       |

---

## 11. Common mistakes

| ❌  Wrong                                              | ✅  Right                                                            |
|------------------------------------------------------|---------------------------------------------------------------------|
| `color: #2563eb;`                                    | `color: var(--ssk-colors-primary-600);`                              |
| `padding: 8px;`                                       | `padding: var(--spacing-lg);`                                        |
| `border-radius: 9999px;`                              | `border-radius: var(--radius-full);`                                 |
| `<ssk-button themeColor="#ff6a14">`                   | `<ssk-button themeColor="aerospace-orange.500">` or use `--text-brand-primary` via CSS |
| Reading `Theme.fontWeight.bold` and inlining `700`    | `var(--ssk-font-weight-bold)` so overrides flow through              |
| Editing `dist/style.css` directly                     | Override via `applyTheme(…)` and pass `.theme` to the provider       |
| Calling `injectSpaceTokens()` on every render         | Mount `<ssk-theme-provider>` once and let it call inject helpers     |
| Hard-coding a brand colour in CSS                     | Use brand semantic tokens (see `ssk-brand`) so it re-skins           |

---

## 12. Cheatsheet (paste this into a comment block in your code)

```css
/*
  Sellsuki design tokens — quick reference
  Provider: <ssk-theme-provider brand="patona|ccs3|oc2plus">

  Spacing:   --spacing-none xxs xs sm md lg xl 2xl 3xl 4xl 5xl 6xl 7xl 8xl 9xl 10xl 11xl 12xl 13xl 14xl 15xl
  Border:    --border-none --border-xxs --border-xs --border-sm
  Radius:    --radius-none --radius-xxs xs sm md lg xl 2xl 3xl 4xl --radius-full
  Palette:   --ssk-colors-<name>-<50..900>     (name = primary|secondary|success|warning|error|danger|info|gray|emerald|sky|amber|rose|…)
  Font fam:  --ssk-font-family-sans|serif|mono
  Font wt:   --ssk-font-weight-thin..black
  Brand:     --text-* --bg-* --stroke-* --icon-* --fg-* --link     (see `ssk-brand`)

  Helpers:   cssVar("spacing","md")  →  "--ssk-spacing-md"
             parseVariables(cssVar("spacing","md"), "1rem")  →  "var(--ssk-spacing-md, 1rem)"
             applyTheme(partial) + <ssk-theme-provider .theme=${…}>
*/
```
