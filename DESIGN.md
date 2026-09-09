---
version: alpha
name: Patona Seller Center
description: |
  Patona Seller Center is a Thai-first merchant management SPA (Svelte 4 + Vite 5)
  skinned on the @sellsuki-org/sellsuki-components web-component design system. The
  brand voltage is a single warm orange (primary-500 #EC5E2A, the Patona accent);
  everything else is a cool neutral gray ramp. Surfaces are flat white plates
  separated by 1px gray hairlines rather than shadows — the only drop shadow in the
  whole app is on overlay menus. Type hierarchy is carried almost entirely by the
  `<ssk-text size="…">` scale on a single sans family, with size (not weight) doing
  the work. The default corner is a soft 8px. Primary UI language is Thai.
tokenSource: "@sellsuki-org/sellsuki-components@^0.24.6 (CSS custom properties: --ssk-colors-*, --spacing-*, --radius-*, --border-*, --ssk-font-*)"
themeOverrides: "src/App.svelte (applyTheme({...}) at lines 37–97 — overrides gray, primary, secondary, sky, stroke, button palettes)"
---

```yaml
# Every value below is a token REFERENCE into the upstream system named in
# `tokenSource`. The concrete hex for each --ssk-colors-* var is set by
# applyTheme({...}) in src/App.svelte. Raw hex / px appear ONLY where the
# codebase itself hardcodes a value with no token behind it — each such case
# is flagged in ## Known Gaps. NOTE: this app consumes the brand-INVARIANT
# palette layer (--ssk-colors-*) directly, NOT the per-brand semantic layer
# (--text-*/--bg-*/--stroke-*). That is a real characteristic, documented below.

colors:
  # Brand & accent
  primary-500:    "var(--ssk-colors-primary-500)"    # #EC5E2A — the Patona orange
  primary-600:    "var(--ssk-colors-primary-600)"    # #BC4B20 — pressed/hover solid
  primary-100:    "var(--ssk-colors-primary-100)"    # #F9DDCE — tint border
  primary-50:     "var(--ssk-colors-primary-50)"     # #FCEFE7 — tint surface
  on-primary:     "var(--ssk-colors-white-50)"       # text/icon on a solid orange fill

  # Surface
  canvas:         "var(--ssk-colors-background-100)"  # page background
  surface-card:   "var(--ssk-colors-white-50)"        # white content plate
  surface-subtle: "var(--ssk-colors-gray-50)"         # #F9FAFB — subtle fill / hover
  surface-muted:  "var(--ssk-colors-gray-100)"        # #F3F4F6 — muted fill / zebra

  # Hairlines
  hairline:        "var(--ssk-colors-gray-200)"       # #E5E7EB — the default 1px border (used ~70×)
  hairline-strong: "var(--ssk-colors-gray-300)"       # #D1D5DB — stronger divider

  # Text
  ink:        "var(--ssk-colors-gray-800)"            # #1F2937 — primary body / heading text
  ink-max:    "var(--ssk-colors-text-900)"            # highest-contrast title text
  muted:      "var(--ssk-colors-gray-500)"            # #6B7280 — secondary / label text
  muted-soft: "var(--ssk-colors-text-300)"            # faint helper / section caption

  # Semantic
  link:           "var(--ssk-colors-sky-600)"         # #1B8BF5 — anchor + input focus accent
  info-surface:   "var(--ssk-colors-sky-200)"         # #BCE8FF — input focus outline
  danger-500:     "var(--ssk-colors-error-500)"       # destructive / error
  secondary-500:  "var(--ssk-colors-secondary-500)"   # red secondary accent (rare)

typography:
  # Named text styles. fontSize maps to the upstream --ssk-font-size-* scale,
  # which is what `<ssk-text size="…">` resolves to. Family is the library
  # default sans (not overridden by this app — see ## Typography).
  display-lg:
    fontSize: "var(--ssk-font-size-4xl)"
    fontWeight: 700
  display-md:
    fontSize: "var(--ssk-font-size-2xl)"
    fontWeight: 600
  heading-lg:
    fontSize: "var(--ssk-font-size-xl)"
    fontWeight: 600
  heading-md:
    fontSize: "var(--ssk-font-size-lg)"
    fontWeight: 600
  body-md:
    fontSize: "var(--ssk-font-size-md)"
    fontWeight: 400
  body-sm:
    fontSize: "var(--ssk-font-size-sm)"
    fontWeight: 400
  caption:
    fontSize: "var(--ssk-font-size-xs)"
    fontWeight: 400
  button:
    fontSize: "var(--ssk-font-size-sm)"
    fontWeight: 500
  badge:
    fontSize: "var(--ssk-font-size-xs)"
    fontWeight: 500

rounded:
  # Upstream --radius-* scale. NOTE: app code overwhelmingly hardcodes `8px`
  # (== md) instead of the token — see ## Known Gaps.
  none: "var(--radius-none)"   # 0
  xxs:  "var(--radius-xxs)"    # 2px
  xs:   "var(--radius-xs)"     # 4px
  sm:   "var(--radius-sm)"     # 6px  — inputs
  md:   "var(--radius-md)"     # 8px  — DEFAULT (buttons, cards, menus)
  lg:   "var(--radius-lg)"     # 12px — cards
  xl:   "var(--radius-xl)"     # 16px — modal
  2xl:  "var(--radius-2xl)"    # 20px — drawer
  full: "var(--radius-full)"   # pill / circle (avatar, badge)

spacing:
  # Upstream --spacing-* semantic scale. NOTE: app CSS frequently hardcodes the
  # equivalent rem/px (gap: 0.5rem, 1rem; padding: 1rem, 1.5rem, 32px) rather
  # than the token — see ## Known Gaps. px shown is the resolved value.
  none: "var(--spacing-none)"  # 0
  sm:   "var(--spacing-sm)"    # 4px  — icon-to-text gap
  lg:   "var(--spacing-lg)"    # 8px  — default control padding / tight gap
  2xl:  "var(--spacing-2xl)"   # 12px — card inner padding
  3xl:  "var(--spacing-3xl)"   # 16px — section padding / common gap
  5xl:  "var(--spacing-5xl)"   # 24px — container padding
  6xl:  "var(--spacing-6xl)"   # 32px — page gutter / hero padding

elevation:
  none:     "none"                          # cards, inputs, navbar, sidebar
  dropdown: "0 8px 24px rgba(0, 0, 0, 0.08)" # overlay menus only — MenuDropdown.svelte:78

motion:
  spin-duration: "1s"        # .spinner — main.css @keyframes spin
  spin-easing:   "linear"

layout:
  app-width: "100dvw"
  app-height: "100dvh"
  # No grid-template-areas at the shell level — the shell is composed from
  # <ssk-top-navbar> + <ssk-sidebar> + content slot in Layout.svelte.
  shell: "top-navbar (full width) over [ sidebar | content ]"

components:
  # COMPOSED from {token.refs} + literal padding/border-width only.
  # Variants are separate entries. `invoke` names the underlying element.

  card:
    invoke: "div / <ssk-container>"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"
    rounded: "{rounded.md}"
    padding: "{spacing.6xl}"

  button-primary:
    invoke: "<ssk-button> (default solid, themeColor=primary)"
    backgroundColor: "{colors.primary-500}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"

  button-primary-pressed:
    invoke: "<ssk-button> :active / :hover"
    backgroundColor: "{colors.primary-600}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"

  button-outline:
    invoke: "<ssk-button variant=\"outline\">"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"
    typography: "{typography.button}"
    rounded: "{rounded.md}"

  button-ghost:
    invoke: "<ssk-button variant=\"ghost\">"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.muted}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"

  input:
    invoke: "<ssk-input> / <ssk-textarea>"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"
    rounded: "{rounded.sm}"

  input-focus:
    invoke: "<ssk-input> :focus (main.css override)"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.link}"
    outlineColor: "{colors.info-surface}"
    borderWidth: "1px"
    rounded: "{rounded.sm}"

  input-error:
    invoke: "<ssk-input> error state"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.danger-500}"
    borderWidth: "1px"
    rounded: "{rounded.sm}"

  badge-solid:
    invoke: "<ssk-badge variant=\"solid\">"
    backgroundColor: "{colors.primary-500}"
    textColor: "{colors.on-primary}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"

  badge-outline:
    invoke: "<ssk-badge variant=\"outline\">"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"

  badge-subtle:
    invoke: "<ssk-badge variant=\"subtle\">"
    backgroundColor: "{colors.primary-50}"
    textColor: "{colors.primary-600}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"

  divider:
    invoke: "<ssk-divider>"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"

  table-header-cell:
    invoke: "<ssk-header-cell>"
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.muted}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"
    typography: "{typography.caption}"

  table-row:
    invoke: "<ssk-table-cell>"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"
    typography: "{typography.body-sm}"

  dropdown-menu:
    invoke: "MenuDropdown.svelte / <ssk-dropdown> options"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    elevation: "{elevation.dropdown}"
    padding: "{spacing.lg}"

  dropdown-option:
    invoke: "<ssk-dropdown-option> / .dropdown-option-item"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"

  modal:
    invoke: "<ssk-modal>"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    elevation: "{elevation.dropdown}"

  drawer:
    invoke: "<ssk-drawer>"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    elevation: "{elevation.dropdown}"

  tooltip:
    invoke: "<ssk-tooltip>"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    typography: "{typography.caption}"

  top-navbar:
    invoke: "<ssk-top-navbar>"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"

  sidebar:
    invoke: "<ssk-sidebar> (collapsible, expanded prop)"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"

  avatar:
    invoke: "<ssk-avatar shape=\"circle\">"
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.full}"

  icon-circle:
    invoke: "IconCircle.svelte (type=\"light\")"
    backgroundColor: "{colors.primary-50}"
    borderColor: "{colors.primary-100}"
    borderWidth: "1px"
    iconColor: "{colors.primary-500}"
    rounded: "{rounded.full}"

  skeleton:
    invoke: "<ssk-skeleton>"
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.md}"

  alert:
    invoke: "<ssk-alert> (themeColor drives success/warning/danger/info)"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"
    rounded: "{rounded.lg}"
```

## Overview

Patona Seller Center is the merchant-facing management portal of the Sellsuki/Patona
platform — a Svelte 4 single-page app where Thai SMB sellers manage companies, stores,
orders, customers, products, and a POS sales flow. It is rendered entirely through the
`@sellsuki-org/sellsuki-components` web-component library (`<ssk-*>` custom elements),
themed once at the root via `applyTheme({...})` in `src/App.svelte` and a
`<ssk-theme-provider>` wrapper.

The visual voltage is deliberately concentrated. **One** warm orange — `primary-500`
`#EC5E2A` — carries every brand moment: primary buttons, active states, links-as-accents,
the Patona logo lockup. Everything around it is a cool, near-monochrome gray ramp.
Surfaces are flat white plates; depth is communicated almost exclusively by **1px gray
hairlines** (`hairline` / gray-200 appears in roughly 70 style rules), not by shadow. The
single drop shadow in the entire codebase lives on overlay menus.

Typography does its work through **size, not weight**. The app leans on `<ssk-text size="…">`
(over 300 invocations) mapped to the upstream `--ssk-font-size-*` scale, with `sm` as the
workhorse body size and larger steps for headings. There is one sans family and no local
font stack override. Corners are soft and consistent — a `md` / 8px radius is the default
on nearly everything (buttons, cards, menus, skeletons), with `full` reserved for avatars
and badges.

The system is pragmatic rather than maximal: it consumes the design library's
**brand-invariant palette layer** (`--ssk-colors-*`) directly and bypasses the per-brand
semantic layer (`--text-*` / `--bg-*` / `--stroke-*`). That keeps the styling legible and
self-documenting, but it means the app is effectively pinned to the Patona skin (see
## Known Gaps).

**Key Characteristics**

- **Single accent, gray everywhere else.** `primary-500` `#EC5E2A` is the only chromatic
  brand color in regular use; the rest is the gray 50→800 ramp (`src/App.svelte:38–63`).
- **Hairlines over shadows.** `var(--ssk-colors-gray-200)` borders define every plate edge;
  the only `box-shadow` is `0 8px 24px rgba(0,0,0,0.08)` on overlay menus
  (`MenuDropdown.svelte:78`).
- **8px is the house corner.** `border-radius: 8px` appears ~71× across components — the
  de-facto default radius.
- **Type by size.** `<ssk-text size="…">` (×304) is the hierarchy mechanism; weight is
  used sparingly.
- **Thai-first.** UI copy and i18n keywords are Thai (`patona-sellercenter-*` keys), routed
  through `<ssk-i18n-translate>`.
- **Web-component composition.** UI is `<ssk-*>` elements (`ssk-text`, `ssk-button`,
  `ssk-input`, `ssk-table-*`, `ssk-modal`, `ssk-drawer`, `ssk-sidebar`, `ssk-top-navbar`),
  not hand-rolled markup.
- **Palette-direct theming.** Styling reads `--ssk-colors-*` directly, not the brand
  semantic layer — fast to read, but not auto-reskinnable.

## Colors

> Every bullet references a token, never a hex. The concrete hex is set by `applyTheme`
> in `src/App.svelte:37–97`.

### Brand & Accent
- **{colors.primary-500}** — `#EC5E2A`, the Patona orange. The single brand accent: primary
  buttons, active/selected states, accent text. Used ~22× directly.
- **{colors.primary-600}** — `#BC4B20`. Hover / pressed state of any solid orange fill.
- **{colors.primary-100}** — `#F9DDCE`. Border of tinted brand chips (e.g. `icon-circle`).
- **{colors.primary-50}** — `#FCEFE7`. Subtle brand-tinted surface (badge-subtle, icon-circle).

### Surface
- **{colors.canvas}** — the page background behind all content plates.
- **{colors.surface-card}** — white. The default content plate / navbar / sidebar / menu fill.
- **{colors.surface-subtle}** — gray-50 `#F9FAFB`. Subtle fills, table header rows, hover states.
- **{colors.surface-muted}** — gray-100 `#F3F4F6`. Muted fills, skeleton placeholders, zebra rows.

### Hairlines
- **{colors.hairline}** — gray-200 `#E5E7EB`. The workhorse 1px border on every plate, input,
  divider, and table cell (~70 rules).
- **{colors.hairline-strong}** — gray-300 `#D1D5DB`. A stronger divider where extra contrast
  is needed.

### Text
- **{colors.ink}** — gray-800 `#1F2937`. Primary body and heading text.
- **{colors.ink-max}** — text-900. Highest-contrast title text where ink isn't dark enough.
- **{colors.muted}** — gray-500 `#6B7280`. Secondary text, labels, captions, placeholder-ish copy.
- **{colors.muted-soft}** — text-300. Faint section captions / helper text in dropdown groups.

### Semantic
- **{colors.danger-500}** — error red. Destructive actions, error borders, validation messages.
- **{colors.link}** — sky-600 `#1B8BF5`. Anchor color and the input focus border accent.
- **{colors.info-surface}** — sky-200 `#BCE8FF`. The soft outline ring on a focused input.
- **{colors.secondary-500}** — red secondary accent; rare, present in the palette but seldom used.

## Typography

### Font Family
The app does **not** override `fontFamily` in `applyTheme`, so text inherits the library
default `var(--ssk-font-family-sans)` stack (a sans family with Thai support). There is no
`@font-face` or `<link>` font import in `index.html`; only two local `font-family: inherit`
rules exist in `src/`.

### Hierarchy

| Token | Invocation | Used for |
|---|---|---|
| `display-lg` | `<ssk-heading>` / `<ssk-text size="4xl">` | Largest page/hero titles |
| `display-md` | `<ssk-text size="2xl">` | Page titles, prominent numbers |
| `heading-lg` | `<ssk-text size="xl">` | Section headers |
| `heading-md` | `<ssk-text size="lg">` | Sub-section headers, card titles |
| `body-md` | `<ssk-text size="md">` | Default body copy |
| `body-sm` | `<ssk-text size="sm">` | The workhorse body size (most common) |
| `caption` | `<ssk-text size="xs">` | Helper text, table headers, group labels |
| `button` | `<ssk-button>` label | All button labels |
| `badge` | `<ssk-badge>` label | Badge / chip labels |

### Principles
- **Size, not weight, sets hierarchy.** The vast majority of `<ssk-text>` usages vary `size`
  and stay at normal weight; `fontWeight` is bumped to `medium`/`semibold`/`bold` only for
  occasional emphasis (e.g. company name, price). Observed in `Layout.svelte` dropdowns.
- **`sm` is the default body step.** `size="sm"` dominates the codebase; `md` and up are
  reserved for headings and emphasis.
- **No local font-size rules (ideal).** Hierarchy should come from the `size` prop; where the
  app hardcodes `font-size: 20px / 24px / 36px` in scoped styles, that's drift to avoid (see
  ## Known Gaps).

### Note on Font Substitutes
Because no custom font is loaded, the rendered face depends entirely on the library's default
sans stack and the platform's available fonts. Under fallback (no preferred Thai face present),
Thai and Latin glyphs fall to the OS default sans, which can shift line height and metrics —
do not pin pixel-perfect vertical rhythm to a specific face.

## Layout

### App Shell
There is no `grid-template-areas` declaration at the shell level. The shell is **composed
from web components** in `src/components/Layout.svelte`:

```text
┌─────────────────────────────────────────────┐
│  <ssk-top-navbar>           (full width)      │
├───────────────┬───────────────────────────────┤
│ <ssk-sidebar> │  content (router <Route/> )   │
│ (collapsible) │                               │
└───────────────┴───────────────────────────────┘
```

The sidebar collapses/expands via the `expanded` prop (toggled by `sidebarToggle`). The
top-navbar is hidden on company/store onboarding routes; the sidebar is hidden on
`/product/add`; content padding is removed on `/sales` and `/customers/view/*`.

### Spacing System

| Token | px | Where used |
|---|---|---|
| `{spacing.sm}` | 4px | Icon-to-text gaps |
| `{spacing.lg}` | 8px | Default control padding, tight gaps |
| `{spacing.2xl}` | 12px | Card inner padding |
| `{spacing.3xl}` | 16px | Section padding, the most common gap |
| `{spacing.5xl}` | 24px | Container padding |
| `{spacing.6xl}` | 32px | Page gutter, hero padding |

> Observed raw equivalents the codebase hardcodes instead of these tokens: `gap: 0.5rem`
> (×40), `gap: 1rem` (×36), `padding: 1.5rem` (×13), `padding: 32px` (×7). They resolve to
> the same values — prefer the token (see ## Known Gaps).

### Container Widths
No global max-width container is enforced at the shell level; page layouts use local grids
(e.g. `grid-template-columns: 368px auto` in `customer/List.svelte`, `repeat(3, 1fr)` in
`setting/OrderTimeout`). Content fills the area beside the sidebar.

### Whitespace Philosophy
The rhythm is built on the 8 / 16 / 24 / 32 progression. Card inner padding (12–16px) sits
inside section padding (16–24px) inside page gutters (32px), so each nesting level gets a
visibly larger breathing zone without introducing a new arbitrary number.

## Elevation

### Surface Tiers
1. **Canvas** — `{colors.canvas}`, no elevation. The page background.
2. **Card / navbar / sidebar / input** — `{colors.surface-card}` with a 1px `{colors.hairline}`
   border, **no shadow**. Depth comes entirely from the hairline.
3. **Overlay** — dropdown menus, modals, drawers. The **only** tier that uses a shadow.

### Shadows
| Token | Value | Where |
|---|---|---|
| `none` | `none` | Cards, inputs, navbar, sidebar, tables |
| `dropdown` | `0 8px 24px rgba(0, 0, 0, 0.08)` | Overlay menus (`MenuDropdown.svelte:78`); reused conceptually for modals/drawers |

> Do not invent new shadow tokens. This system is intentionally near-flat — if a surface
> needs separation, reach for a `{colors.hairline}` border before a shadow.

## Components

> **1:1 match with the YAML `components:` block** — 25 keys, 25 entries, same order.

**`card`** — The default content plate. White `{colors.surface-card}` background, `{colors.ink}`
text, a 1px `{colors.hairline}` border, `{rounded.md}` corners, `{spacing.6xl}` padding. **No
drop shadow** — depth is the hairline.

**`button-primary`** — The signature CTA (`<ssk-button>` solid, `themeColor=primary`). Background
`{colors.primary-500}`, label `{colors.on-primary}`, typography `{typography.button}`, `{rounded.md}`.
The pressed state is documented separately as `button-primary-pressed`.

**`button-primary-pressed`** — Hover/active state of `button-primary`. Background shifts to
`{colors.primary-600}`; everything else holds.

**`button-outline`** — Secondary action (`<ssk-button variant="outline">`). White background,
`{colors.ink}` label, 1px `{colors.hairline}` border, `{typography.button}`, `{rounded.md}`. Used
for "Sign in" and low-emphasis actions.

**`button-ghost`** — Lowest-emphasis action (`<ssk-button variant="ghost">`). Transparent over the
card surface, `{colors.muted}` label, `{typography.button}`, `{rounded.md}`.

**`input`** — Text field (`<ssk-input>` / `<ssk-textarea>`). White background, `{colors.ink}` text,
1px `{colors.hairline}` border, `{rounded.sm}` (6px). Focus and error are separate entries.

**`input-focus`** — Focused field. Border switches to `{colors.link}` with a `{colors.info-surface}`
outline ring — set via the `main.css` override on `ssk-input`/`ssk-textarea` (`--border-color-active`
/ `--outline-color-active`).

**`input-error`** — Invalid field. Border switches to `{colors.danger-500}`; the error message uses
`{colors.danger-500}` text.

**`badge-solid`** — Filled status chip (`<ssk-badge variant="solid">`). `{colors.primary-500}` fill,
`{colors.on-primary}` label, `{typography.badge}`, `{rounded.full}`.

**`badge-outline`** — Outlined chip (`<ssk-badge variant="outline">`). White fill, `{colors.ink}`
label, 1px `{colors.hairline}` border, `{rounded.full}`.

**`badge-subtle`** — Tinted chip (`<ssk-badge variant="subtle">`). `{colors.primary-50}` fill,
`{colors.primary-600}` label, `{rounded.full}`.

**`divider`** — Horizontal/vertical rule (`<ssk-divider>`). A 1px `{colors.hairline}` line, no fill.

**`table-header-cell`** — Column header (`<ssk-header-cell>`). `{colors.surface-subtle}` background,
`{colors.muted}` text in `{typography.caption}`, 1px `{colors.hairline}` border.

**`table-row`** — Data cell (`<ssk-table-cell>`). White background, `{colors.ink}` text in
`{typography.body-sm}`, separated by 1px `{colors.hairline}` borders.

**`dropdown-menu`** — Overlay menu surface (`MenuDropdown.svelte` / `<ssk-dropdown>` options).
White `{colors.surface-card}`, `{rounded.md}`, `{spacing.lg}` padding, and the **only** shadow,
`{elevation.dropdown}`.

**`dropdown-option`** — A row inside the menu (`<ssk-dropdown-option>` / `.dropdown-option-item`).
White background, `{colors.ink}` text, `{rounded.md}`; hover tints to a subtle surface.

**`modal`** — Centered dialog (`<ssk-modal>`). White `{colors.surface-card}`, `{rounded.xl}` (16px),
`{elevation.dropdown}`, over a scrim backdrop.

**`drawer`** — Edge-anchored panel (`<ssk-drawer>`). White `{colors.surface-card}`, `{rounded.2xl}`
(20px) on the inner corners, `{elevation.dropdown}`.

**`tooltip`** — Hover hint (`<ssk-tooltip>`). White `{colors.surface-card}`, `{colors.ink}` text in
`{typography.caption}`, `{rounded.sm}`.

**`top-navbar`** — App header (`<ssk-top-navbar>`). White `{colors.surface-card}` with a 1px
`{colors.hairline}` bottom edge; holds the logo, notifications, app switcher, and profile menu.

**`sidebar`** — Primary navigation (`<ssk-sidebar>`, collapsible via `expanded`). White
`{colors.surface-card}` with a 1px `{colors.hairline}` edge; grouped menu items with outline/solid
icon pairs.

**`avatar`** — User/company image (`<ssk-avatar shape="circle">`). `{colors.surface-muted}` fallback
fill, `{rounded.full}`.

**`icon-circle`** — Circular tinted icon badge (`IconCircle.svelte`, `type="light"`). `{colors.primary-50}`
fill, 1px `{colors.primary-100}` border, `{colors.primary-500}` icon, `{rounded.full}`. (The app
currently passes these as raw hex props — see ## Known Gaps.)

**`skeleton`** — Loading placeholder (`<ssk-skeleton>`). `{colors.surface-muted}` block, `{rounded.md}`.

**`alert`** — Inline status banner (`<ssk-alert>`). Base is a white `{colors.surface-card}` plate with
a 1px `{colors.hairline}` border and `{rounded.lg}`; the `themeColor` prop drives success / warning /
danger / info coloring, which the element resolves internally from the library's semantic tokens (not
re-declared in app CSS — see ## Known Gaps).

## Responsive Behavior

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 720px | Sidebar collapses to icons (or hidden); content goes single-column; top-navbar condenses |
| Tablet | 720–1024px | Sidebar collapsible; multi-column page grids may drop to one column |
| Desktop | 1024–1440px | Full shell: expanded sidebar + content; standard page grids |
| Wide | > 1440px | Content fills available width beside the sidebar (no global max-width container) |

> Note: explicit breakpoints are not centralized in this codebase; responsive behavior is
> largely delegated to the `<ssk-*>` components and per-page `grid-template-columns`. The table
> above is the intended behavior, not a set of declared media-query tokens.

### Touch Targets
- Buttons and icon-buttons render through `<ssk-button>`/`<ssk-icon>` at the library's default
  control sizing; icon hit-areas use ~8px padding (e.g. the navbar collapse icon `padding="8px"`).
  Verify against WCAG AA (≥ 24px) / AAA (≥ 44px) — the library default should be checked per release.
- Inputs use the `<ssk-input>` default height.

### Collapsing Strategy
- **Nav:** `<ssk-sidebar>` toggles between expanded and icon-collapsed via `sidebarToggle`.
- **Grid:** page layouts use local `grid-template-columns`; collapse multi-column to single column
  on narrow widths.
- **Content padding:** removed entirely on full-bleed routes (`/sales`, `/customers/view/*`).

## Known Gaps

- **No dark mode.** `applyTheme` defines a single light palette; there is no dark token set or
  `prefers-color-scheme` handling. A dark theme would live in `src/App.svelte`'s `applyTheme` call.
- **Palette-direct, not brand-semantic.** The app consumes `--ssk-colors-*` directly and bypasses
  the per-brand semantic layer (`--text-*` / `--bg-*` / `--stroke-*`). Result: it will **not**
  auto-reskin if `<ssk-theme-provider brand>` is switched. Migrating CSS to semantic tokens is the
  path to brand portability.
- **Radius token bypassed.** `border-radius: 8px` is hardcoded ~71× instead of `var(--radius-md)`.
  Likewise `12px`, `4px`, `50%`, `999px` appear as literals. The `rounded:` scale above is the
  upstream system the app *should* reference.
- **Spacing token bypassed.** Gaps and padding are hardcoded in `rem`/`px` (`gap: 0.5rem` ×40,
  `1rem` ×36; `padding: 1.5rem`, `1rem`, `32px`) rather than `var(--spacing-*)`.
- **Typography literals.** Some scoped styles hardcode `font-size: 20px / 24px / 36px / 0.875rem`
  instead of `<ssk-text size>` or `var(--ssk-font-size-*)`.
- **Raw-hex leaks.** `main.css` sets anchor color `#1b8bf5` and input focus colors `#1b8bf5` /
  `#bce8ff` as raw hex (they map to `sky-600` / `sky-200`). `IconCircle` in `Layout.svelte` is passed
  `#EC5E2A` / `#FCEFE7` / `#F9DDCE` as raw props. These should reference tokens.
- **No motion system.** The only animation is the `.spinner` keyframe (`1s linear`) in `main.css`;
  there are no duration/easing tokens for transitions, enter/exit, or state changes.
- **No data-viz / chart palette.** No defined color ramp for charts or analytics.
- **Alert variants component-owned.** Success / warning / danger / info coloring for `<ssk-alert>`
  is resolved inside the element from the library's semantic tokens and is not surfaced as app-level
  color tokens — so this file documents `alert` as one entry, not four.
- **No empty-state / error-page pattern documented** beyond `NotFound.svelte`.

---

**How to use this file:** Read it before generating any UI. When picking a color, reach for a
`{colors.*}` token (which resolves to `var(--ssk-colors-*)`), never a hex. When sizing text, use a
typography role (`<ssk-text size="sm">` ≈ `{typography.body-sm}`), never a `font-size` literal.
Default the corner to `{rounded.md}` (8px) and separate surfaces with a `{colors.hairline}` border,
not a shadow — the only shadow in this app is `{elevation.dropdown}` on overlays. Prefer composing
from `<ssk-*>` elements over hand-rolled markup, and keep all user-facing copy Thai via
`<ssk-i18n-translate>`.
