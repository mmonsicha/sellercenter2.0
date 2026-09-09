Generate `DESIGN.md` at the repository root — a semantic design-system document agents read **before** writing any UI. Follows the **Google Stitch / getdesign.md alpha spec**.

## Goal

Produce a single `DESIGN.md` file that captures the project's visual language so any coding agent (Claude Code, Cursor, Windsurf) can generate UI consistent with the existing codebase — without re-prompting the system on every turn.

## Spec Reference — the 9 canonical pieces (Google Stitch alpha)

A spec-compliant `DESIGN.md` has **exactly these 9 pieces, in this order**:

| # | Piece | Lives in |
|---|---|---|
| 1 | YAML front matter (`version: alpha`, name, description) | Top of file, fenced by `---` |
| 2 | `colors:` tokens — intent-named role keys | YAML block |
| 3 | `typography:` tokens — **named text styles as objects** (`display-lg`, `body-md`, `button`) | YAML block |
| 4 | `rounded:` + `spacing:` tokens — t-shirt sizes + semantic names | YAML block |
| 5 | `components:` tokens — **composed entirely through `{token.refs}`**, variants as separate entries | YAML block |
| 6 | `## Overview` prose — atmosphere statement + Key Characteristics bullets | Body |
| 7 | `## Colors` / `## Typography` / `## Layout` / `## Elevation` prose | Body |
| 8 | `## Components` prose — **1:1 match** with YAML `components:` block | Body |
| 9 | `## Responsive Behavior` + `## Known Gaps` | Body, last two sections |

## Golden Rules (non-negotiable)

1. **NEVER invent token values.** Every literal in the YAML must be traceable to the codebase — either a `var(--…)` reference, a theme prop, or a value that already appears in source. If you cannot grep it, do not write it.
2. **NEVER duplicate the theme.** If the project has a `theme.ts` / `tailwind.config` / `applyTheme()` / `:root` block, that file is the source of truth. `DESIGN.md` references it via `var(--…)` strings; it does not redeclare hex.
3. **Intent-named keys only.** Color keys must read as roles — `primary`, `ink`, `canvas`, `hairline`, `on-primary`. **NEVER** `blue1`, `gray-100`, `accent-2`. Typography keys must read as roles — `display-lg`, `body-md`, `button`. **NEVER** `h1`, `h2`, `text1`.
4. **Components compose from `{token.refs}` only.** Inside `components:`, every value is either a `{colors.x}` / `{typography.x}` / `{rounded.x}` / `{spacing.x}` reference OR a literal padding/border-width. **Inline hex or font-size is a spec violation.**
5. **Variants are separate entries.** `button-primary-active`, `button-primary-disabled`, `input-focus`, `input-error` each get their own YAML key — never nest state objects inside a parent component.
6. **1:1 coverage between YAML and prose.** Every key in `components:` must have a matching `**`key`**` entry in `## Components` prose, and vice versa. A linter walks this.
7. **Rationale alongside values.** A token tells you what to use. The prose tells you when and why. Every `## Colors` sub-group bullet has a one-sentence rationale; every `## Components` entry says what surface/role it serves.
8. **Be honest about gaps.** Missing dark mode, no animation system, no empty-state pattern — list it under `## Known Gaps`. Stated gaps keep the contract honest.

## Workflow

### Phase 1 — Discover the design system (read-only)

Run these probes in parallel before writing anything. Capture actual filenames and line numbers.

```bash
# Surface framework + UI library
cat package.json | head -80
ls -1 src/ 2>/dev/null || ls -1 app/ 2>/dev/null

# Find the theme / token definition
rg -l "applyTheme\(|createTheme\(|defineConfig\(|@theme|:root\s*\{|tailwind\.config|theme\.(ts|js)" --type-add 'cfg:*.{ts,tsx,js,jsx,css,scss}' -tcfg | head

# Find every CSS custom property in use (these become token values)
rg -ohE "var\(--[a-z0-9-]+\)" src/ 2>/dev/null | sort -u | head -100

# Find raw style literals (likely the rounded + spacing scale + shadows)
rg -ohE "(border-radius|padding|margin|gap|font-size|font-weight|line-height|box-shadow):\s*[^;]+;" src/ 2>/dev/null | sort -u | head -60

# Find UI component invocations
rg -ohE "<(ssk|md|mat|ion|sl|fluent)-[a-z-]+" src/ 2>/dev/null | sort -u
rg -ohE "className=\"[^\"]+\"" src/ 2>/dev/null | head -20
```

Identify the primary theming layer:
- **CSS variables** (`var(--…)`) → use those strings as the token values
- **Tailwind config** → reference theme path; tokens are class names + the underlying scale
- **CSS-in-JS theme object** → reference theme object path
- **Plain CSS literals** → tokens are observational; flag in Known Gaps

### Phase 2 — Inventory (still read-only)

Build a working list before writing the file. For each layer:

1. **Color roles** — group by role (Brand / Surface / Hairlines / Text / Semantic + sub-app accents if any). For each, capture the token reference + one-sentence rationale.
2. **Typography roles** — **NAMED TEXT STYLES**, not size-only. Map observed usage to roles:
   - `display-lg` / `display-md` / `display-sm` — big hero/page-title sizes
   - `heading-lg` / `heading-md` / `heading-sm` — section headers
   - `body-md` / `body-sm` — default and secondary body
   - `caption` — helper, footnote
   - `button` — button label
   - `badge` — badge label
   Each role gets fontSize/fontWeight (line-height + family added when the upstream library doesn't own them).
3. **Spacing scale** — `xs/sm/md/base/lg/xl/2xl/section` literal values OR token references.
4. **Radius scale** — same.
5. **Elevation** — list every `box-shadow` in source. Usually 1–3.
6. **Layout shell** — root grid/flex (often `App.svelte`, `_layout.tsx`). Capture `grid-template-areas` verbatim.
7. **Component primitives** — every `<x-*>` element actually used, plus app-local compositions (`Container.svelte`, `Layout.svelte`, etc.). For each, plan the composed token map (background, text, border, rounded, padding, typography, elevation).

### Phase 3 — Write `DESIGN.md`

Write to the **repo root** as `DESIGN.md`. Structure below is **mandatory** — every section is required, in this order.

#### Skeleton

````markdown
---
version: alpha
name: <Project Display Name>
description: |
  One dense paragraph (3–5 sentences). The brand atmosphere, not a tagline.
  Mention the dominant color, the surface system, the typography stance,
  and the primary language(s) of the UI.
tokenSource: "<npm package name OR file path that owns upstream tokens>"
themeOverrides: "<file path where the app overrides tokens, if any>"
---

```yaml
# All values below are token REFERENCES into the upstream system listed
# in `tokenSource`. Raw hex/px values appear only where the upstream
# system does not yet expose a token (flagged in Known Gaps).

colors:
  # Intent-named role keys ONLY — primary/ink/canvas/hairline, never blue1.
  primary-500:    "var(--…-primary-500)"
  on-primary:     "var(--…-white-50)"
  canvas:         "var(--…-background-100)"
  surface-card:   "var(--…-white-50)"
  hairline:       "var(--…-gray-200)"
  ink:            "var(--…-text-900)"
  muted:          "var(--…-text-300)"
  danger-500:     "var(--…-danger-500)"
  # ... full role inventory

typography:
  # NAMED TEXT STYLES (objects), not size aliases.
  display-lg:
    fontSize: "var(--…-font-size-4xl)"
    fontWeight: 700
    lineHeight: 1.1
  display-md:
    fontSize: "var(--…-font-size-2xl)"
    fontWeight: 600
  heading-lg:
    fontSize: "var(--…-font-size-xl)"
    fontWeight: 600
  body-md:
    fontSize: "var(--…-font-size-md)"
    fontWeight: 400
  body-sm:
    fontSize: "var(--…-font-size-sm)"
    fontWeight: 400
  caption:
    fontSize: "var(--…-font-size-xs)"
    fontWeight: 400
  button:
    fontSize: "var(--…-font-size-sm)"
    fontWeight: 500
  badge:
    fontSize: "var(--…-font-size-xs)"
    fontWeight: 500

rounded:
  none: "0px"
  sm: "6px"
  md: "8px"      # default
  lg: "10px"
  xl: "12px"
  pill: "100px"
  full: "9999px"
  circle: "50%"

spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
  section: "48px"

elevation:
  none: "none"
  dropdown: "<actual box-shadow from codebase>"

motion:
  duration-base: "200ms"
  easing-base: "ease-in-out"

layout:
  app-height: "100dvh"
  app-width: "100dvw"
  grid-areas: "'top-navbar top-navbar' 'sidebar content'"

components:
  # COMPOSE FROM {token.refs} — never inline hex or font-size.
  # VARIANTS ARE SEPARATE ENTRIES — never nested state.

  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"
    rounded: "{rounded.md}"
    padding: "{spacing.2xl}"

  button-primary:
    backgroundColor: "{colors.primary-500}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 18px"

  button-primary-pressed:               # VARIANT — separate entry
    backgroundColor: "{colors.primary-600}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 18px"

  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.muted}"
    borderColor: "{colors.hairline}"
    borderWidth: "1px"
    typography: "{typography.button}"
    rounded: "{rounded.md}"

  # ... full inventory of primitives
```

## Overview

<3–5 paragraphs. Open with what the product is. Then the visual stance:
what carries the voltage, what surfaces look like, what typography role
does. Close with **Key Characteristics** — 5–7 bullets, each tied to
a concrete codebase observation.>

## Colors

> Every bullet references a token, never a hex. Every bullet has a one-
> sentence rationale (what role this color plays in the system).

### Brand & Accent
- **{colors.primary-500}** — <one-sentence role + where it appears>
- **{colors.primary-50}** — <…>

### Surface
- **{colors.canvas}** — <…>
- **{colors.surface-card}** — <…>

### Hairlines
- **{colors.hairline}** — <…>

### Text
- **{colors.ink}** — <…>
- **{colors.muted}** — <…>

### Semantic
- **{colors.danger-500}** — <…>

## Typography

### Font Family
<Stack used in the codebase, including fallbacks.>

### Hierarchy

| Token | Invocation | Used for |
|---|---|---|
| `display-lg` | `<x-text size="…">` or class `…` | <where in app> |
| `body-md`    | <invocation>                     | Default body |
| `button`     | <invocation>                     | All buttons |

### Principles
- **Size, not weight, sets hierarchy.** <rationale + codebase example>
- **No local font-size rules.** <rationale>

### Note on Font Substitutes
<Behavior under fallback fonts. Mandatory section per spec.>

## Layout

### App Shell
<grid-template-areas as a code block.>

### Spacing System
<Table mapping `{spacing.x}` → px → where used.>

### Container Widths
<Max-width rules, if any.>

### Whitespace Philosophy
<One paragraph on the rhythm number — why content padding × card padding
equals the breathing zone it does.>

## Elevation

### Surface Tiers
1. **Canvas** — <{colors.canvas}, no elevation>
2. **Card** — <hairline-bordered, no shadow>
3. **Overlay** — <only place shadow appears>

### Shadows
| Token | Value | Where |
|---|---|---|
| `none` | `none` | Cards, inputs |
| `dropdown` | <value> | Dropdowns, modals |

<Rule against inventing new shadow tokens.>

## Components

> **1:1 match with the YAML `components:` block.** Every key above has an
> entry here; every entry here is a key above. A linter walks this.

**`card`** — The default content plate. Background `{colors.surface-card}`,
text `{colors.ink}`, 1px `{colors.hairline}` border, rounded `{rounded.md}`,
padding `{spacing.2xl}`. **No drop shadow** — depth comes from the hairline.

**`button-primary`** — The signature primary CTA. Background
`{colors.primary-500}`, text `{colors.on-primary}`, typography
`{typography.button}`, rounded `{rounded.md}`, padding `10px × 18px`.
The pressed state is documented separately as `button-primary-pressed`.

**`button-primary-pressed`** — Active/pressed state of `button-primary`.
Shifts background to `{colors.primary-600}`; everything else holds.

<…one entry per YAML components: key, in the same order…>

## Responsive Behavior

| Name | Width | Key Changes |
|---|---|---|
| Mobile  | < 720px       | <changes> |
| Tablet  | 720–1024px    | <changes> |
| Desktop | 1024–1440px   | <changes> |
| Wide    | > 1440px      | <changes> |

### Touch Targets
- Primary CTAs ≥ <px>. WCAG AA / AAA assessment.
- Form inputs at <px> height.

### Collapsing Strategy
- <Bullet list — how nav, grid, spacing, forms adapt at each breakpoint.>

## Known Gaps

- <Honest list. Each bullet: what's missing, where the missing piece
  would live. Examples: no dark mode, no spacing token system in the
  upstream library, no empty-state pattern, no animation tokens, no
  data-viz palette, underused color, no doc-site for this app.>

---

**How to use this file:** Read it before generating any UI. When picking
a color, reach for a token reference, never a hex. When sizing text,
reach for a typography role (`{typography.body-md}`), never a font-size
literal. <2–3 closing rules unique to this project.>
````

### Phase 4 — Verify (the linter walk)

Run **every check** before reporting done:

**Token integrity:**
- [ ] Every `colors:` value is `var(--…)`, `{theme.…}`, or a class reference — **no bare hex** (except documented exceptions)
- [ ] Every `typography:` entry is an **object** with at least `fontSize` + `fontWeight` — not a flat size alias
- [ ] Color keys are intent-named (primary/ink/canvas) — **no `blue1`, no `accent-2`, no `gray-100`** as a top-level key
- [ ] Typography keys are role-named (`display-lg`, `body-md`, `button`) — **no `h1`, no `text1`, no `size-md`** as a typography key
- [ ] No `box-shadow` value appears outside the `elevation:` block

**Structural integrity:**
- [ ] Every `components:` entry is composed of `{token.refs}` and literals — **no inline hex, no inline font-size**
- [ ] Variants live as separate top-level entries (`button-primary-active`, `input-focus`) — **never nested under a parent**
- [ ] **1:1 coverage**: every key in YAML `components:` has a bolded entry in `## Components` prose, and vice versa. Run this mentally — if you count 18 YAML keys, you must count 18 prose entries.

**Prose integrity:**
- [ ] `## Colors` has all 5 canonical sub-headings (Brand & Accent / Surface / Hairlines / Text / Semantic). Skip a sub-heading **only** if the system genuinely has no color in that role.
- [ ] `## Typography` has a hierarchy table, a `### Principles` block, and a `### Note on Font Substitutes` block
- [ ] `## Elevation` has a Surface Tiers list and a Shadows table
- [ ] `## Known Gaps` is non-empty (every project has gaps; admitting them is part of the spec)

**Provenance:**
- [ ] File written to repo root: `DESIGN.md` (not under `docs/` or `.claude/`)
- [ ] No values invented — every literal is grep-able to source

If a check fails, fix and re-verify. A `DESIGN.md` that contains values the agent will trust but that don't exist in the codebase is **worse than no file at all**.

## Anti-patterns to refuse

- ❌ Copying a `DESIGN.md` from a famous brand and presenting it as the project's system. Capture **this codebase**, not aspire to another.
- ❌ Writing `typography:` as a size-mapping (`size-md: var(--font-size-md)`). The spec requires **named text styles as objects**. A size token is a primitive; `body-md` is the consumable role.
- ❌ Writing `components:` entries as invocation hints (`invoke: '<ssk-button>'`) **without** the underlying `{token.refs}` composition. Invocation can be added as an extra field, but never replaces the structural payload.
- ❌ Nesting variant state inside a parent (`button-primary: { default: {...}, active: {...} }`). Variants are separate entries.
- ❌ Using semantic-HTML keys for typography (`h1`, `h2`, `p`). Use role keys (`display-lg`, `body-md`).
- ❌ Inventing a "complete" token system when the codebase has 4 colors. Reflect reality — sparse system, sparse file.
- ❌ Writing rationale you cannot back up with a code citation.
- ❌ Adding emojis or decorative voice. The file is read by agents that need clarity.
- ❌ Writing a "future state" `DESIGN.md`. Present-state only.

## Portability

Works for any framework — Phase 1 probes auto-detect:

- Svelte + Web Components (`<ssk-*>`)
- React + Tailwind
- React + MUI / Chakra / Mantine
- Vue + UnoCSS / Element Plus
- Angular + Material
- Plain HTML/CSS
- SwiftUI / Jetpack Compose (adapt invocation syntax)

Token references adapt to the system:
- CSS variables → `"var(--…)"` strings
- Tailwind → class names + `theme.extend` path
- CSS-in-JS → `theme.palette.…` paths
- Plain CSS → literal values flagged in Known Gaps as "no token system upstream"
