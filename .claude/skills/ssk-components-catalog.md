---
name: ssk-components-catalog
description: Detailed per-tag reference for every custom element shipped by @sellsuki-org/sellsuki-components — props, types, defaults, events, slots, and usage notes. Pair with `use-ssk-components` (high-level wiring) when an AI needs exact prop names to render a specific `<ssk-*>` tag without round-tripping through Storybook. TRIGGER on any precise question about an `<ssk-*>` tag's API (props, events, slots), or whenever generating code that uses a Sellsuki element.
---

# `@sellsuki-org/sellsuki-components` — Full Tag Catalog

This is the **detailed reference** for every public `<ssk-*>` tag. It is auto-generated from the design-system source tree by `/sync-skill`. Re-sync after every release.

> Companion skills:
> - **`use-ssk-components`** — install, providers, framework wiring, brand selection.
> - **`ssk-tokens`** — palette, spacing, border, radius, font tokens + helpers.
> - **`ssk-brand`** — per-brand semantic tokens (`--text-*`, `--bg-*`, …) and brand-switching flow.

Conventions used in the prop tables below:
- `Size` = `"3xs" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" … "9xl"` or any CSS length (`"1rem"`, `"20px"`).
- `ColorRole` = `"primary" | "secondary" | "success" | "warning" | "error" | "danger" | "info" | "light" | "dark" | "text" | "muted" | "background" | "foreground" | "shadow"`.
- `ColorName` = a palette name (`"gray"`, `"red"`, `"emerald"`, `"primary"`, etc.) optionally suffixed with a scale (`"gray.500"`, `"primary.700"`).
- `FontWeight` = `"thin" | "extralight" | "light" | "normal" | "medium" | "semibold" | "bold" | "extrabold" | "black"`.
- `FontFamilyGroup` = `"sans" | "serif" | "mono"`.
- "Re-dispatched" events are wrapped via `redispatchEvents()` and reach you as `CustomEvent` with `detail: { originalEvent }`. Custom domain events are listed with their `detail` shape.

---

## Canonical per-tag block shape

Every `### <ssk-tag>` block below follows the **same field order**. `/sync-skill` MUST not deviate.

```markdown
### `<ssk-name>` (class `ClassName`)
<one-paragraph blurb on what the element is for. End with the provider requirement if relevant.>

**Props**
| Name        | Type                          | Default        | Description                              |
|-------------|-------------------------------|----------------|------------------------------------------|
| `<name>`    | `<TS type>`                   | `<initializer>`| <one short phrase>                       |

**Events** *(omit the section if the element fires none)*
- `<event-name>` — `CustomEvent<{ <detail shape> }>` — <when it fires>

**Slots** *(omit the section if the element renders no slot)*
- default — <what the consumer is expected to put here>
- `<named>` — <purpose>

**Behavior** *(optional — include only when the element has non-obvious lifecycle / state)*
- <one bullet per noteworthy behaviour>

**Notes** *(optional — deprecation warnings, framework caveats, related elements)*
- <bullet>
```

If a tag belongs to a **family** (e.g. `dropdown` has `dropdown-button`, `dropdown-option`, `dropdown-preview`), group them under a single `### <family>` header with `#### <sub-tag>` blocks inside.

---

## 1. Contexts (mount once at the app root)

### `<ssk-theme-provider>` (class `ThemeProvider`)
Provides the design-system `Theme` object via `@lit/context` and injects brand/spacing CSS custom properties onto `:root`. This must be the outermost wrapper of any tree that uses `<ssk-*>` tags — without it every element renders unstyled.

**Props**
| Name    | Type      | Default        | Description                                    |
|---------|-----------|----------------|------------------------------------------------|
| `theme` | `Theme`   | `defaultTheme` | The theme object to provide. Usually default.  |
| `brand` | `Brand`   | `undefined`    | `"patona" \| "ccs3" \| "oc2plus"` — brand swap. |

**Slots**
- default — the app tree that should consume the theme.

**Behavior**
- `connectedCallback` calls `injectSpaceTokens()` once (idempotent).
- `updated` re-runs `injectSemanticTokens(brand)` whenever `brand` changes — that swaps `--text-*`, `--bg-*`, `--border-*` semantic tokens on `:root`.

---

### `<ssk-i18n-provider>` (class `I18nProvider`)
Provides an `I18nStore` (IDB-backed by default) and the active `lang` to descendant elements. Required for `<ssk-i18n-translate>`, `<ssk-i18n-template>`, and date pickers that localise month/day names.

**Props**
| Name         | Type        | Default              | Description                                       |
|--------------|-------------|----------------------|---------------------------------------------------|
| `store`      | `I18nStore` | `new IdbI18nStore()` | Translation store implementation.                 |
| `lang`       | `string`    | `"en"`               | Active language code (overwrites `store.currentLang` on render). |
| `lastUpdate` | `number`    | `0`                  | Bump to force re-renders after store mutations.   |

**Slots**
- default — the app subtree that needs translations.

```ts
export type I18nData = { [key: string]: { [lang: string]: string } };

export interface I18nStore {
  currentLang: string;
  getVersion: () => Promise<number>;
  setVersion: (version: number) => Promise<void>;
  bulkSet: (data: I18nData) => Promise<void>;
  set: (key: string, lang: string, value: string) => Promise<void>;
  sets: (key: string, values: { [lang: string]: string }) => Promise<void>;
  get: (key: string, lang: string, fallbackLang?: string) => Promise<string>;
  getAll: () => Promise<I18nData>;
  render: (key: string, lang: string, metadata: any, fallbackLang?: string) => Promise<string>;
  clear: () => Promise<void>;
}
```

**Notes**
- Default store uses IndexedDB via `idb`. Tests should swap in `fake-indexeddb` (`import "fake-indexeddb/auto"`).

---

### `<ssk-i18n-template>` (class `Template`)
Renders an interpolated translation key from the i18n store (e.g. `"hello {name}"` with `data={ name: "Pan" }`). Requires `<ssk-i18n-provider>` ancestor.

**Props**
| Name           | Type      | Default | Description                                          |
|----------------|-----------|---------|------------------------------------------------------|
| `key`          | `string`  | `""`    | i18n key to look up.                                  |
| `data`         | `object`  | `{}`    | Interpolation data passed to `store.render`.          |
| `lang`         | `string`  | `""`    | Override the provider lang.                           |
| `fallbackLang` | `string`  | `""`    | Fallback when `lang` has no entry.                    |

---

### `<ssk-i18n-translate>` (class `Translate`)
Renders a translation key without interpolation. Requires `<ssk-i18n-provider>` ancestor.

**Props**
| Name           | Type     | Default | Description                                       |
|----------------|----------|---------|---------------------------------------------------|
| `key`          | `string` | `""`    | i18n key to look up.                              |
| `lang`         | `string` | `""`    | Override the provider lang.                       |
| `fallbackLang` | `string` | `""`    | Fallback when `lang` has no entry.                |

---

### `<ssk-toast-provider>` (class `ToastProvider`)
Provides a `ToastStore` to descendants and renders the queued `<ssk-toast>` stack in a fixed-position container at the top of the viewport. Required for any code that pushes toasts (typically the innermost of the three providers).

**Props**
| Name    | Type         | Default       | Description                                          |
|---------|--------------|---------------|------------------------------------------------------|
| `toast` | `ToastStore` | empty no-op store | Toast store implementation (queue + add/remove).  |

**Slots**
- default — app content. Toasts render in a sibling overlay container.

```ts
export type ToastData = {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  timeout: number;
  testId?: string;
};

export interface ToastStore {
  addToast: (toast: Partial<ToastData>) => string;
  removeToast: (id: string) => void;
  toasts: ToastData[];
  clearToasts: () => void;
}
```

**Behavior**
- Polls `requestUpdate()` every 100 ms while connected — consumers can mutate `toast.toasts` and the UI catches up without manual `requestUpdate` calls.

---

### `<ssk-toast>` (class `Toast`)
Single toast card. The provider renders these automatically; you only need to mount one directly to render an inline notification card.

**Props**
| Name              | Type                                            | Default  | Description                                |
|-------------------|-------------------------------------------------|----------|--------------------------------------------|
| `testId`          | `string`                                        | `undefined` | Test id forwarded to the root element.   |
| `width`           | `string`                                        | `undefined` | Container width (token or CSS length).    |
| `hidden`          | `boolean`                                       | `false`  | Skip rendering when true.                  |
| `hideCloseButton` | `boolean`                                       | `false`  | Hide the X icon.                           |
| `heading`         | `string`                                        | `undefined` | Bold title text.                          |
| `content`         | `string`                                        | `undefined` | Body text.                                 |
| `type`            | `"success" \| "error" \| "warning" \| "info"`   | `"info"` | Visual variant + leading icon.             |

**Events**
- `close` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires when the X is clicked.

**Slots**
- default — extra content inside the toast body (below `content`).

---

## 2. Elements (atomic UI)

Atomic primitives — single-purpose custom elements built directly on Lit. Compose them inside §3 components.

### 2.1 Form & Input

### `<ssk-button>` (class `Button`)
Themed button with `solid`, `outline`, `ghost`, and `solid-light` variants. Supports prefix/postfix icon slots.

**Props**
| Name              | Type                           | Default       | Description                              |
|-------------------|--------------------------------|---------------|------------------------------------------|
| `testId`          | `string`                       | `undefined`   | Test id for the inner `<button>`.        |
| `themeColor`      | `ColorRole \| ColorName`       | `"primary"`   | Primary palette role.                    |
| `color`           | `ColorRole \| ColorName`       | `undefined`   | Text color override.                     |
| `backgroundColor` | `string`                       | `undefined`   | Background color override.               |
| `borderColor`     | `string`                       | `undefined`   | Border color override.                   |
| `size`            | `Size`                         | `"md"`        | Token-driven sizing.                     |
| `padding`         | `Size`                         | `undefined`   | Override padding scale.                  |
| `fontSize`        | `string`                       | `undefined`   | Override font size.                      |
| `lineHeight`      | `string`                       | `undefined`   | Override line height.                    |
| `gap`             | `string`                       | `undefined`   | Spacing between prefix/label/postfix.    |
| `rounded`         | `string`                       | `undefined`   | Border radius override.                  |
| `margin`          | `string`                       | `undefined`   | Margin override.                         |
| `fontFamilyGroup` | `FontFamilyGroup`              | `"sans"`      | Font family group.                       |
| `fontWeight`      | `FontWeight`                   | `"normal"`    | Font weight.                             |
| `borderWidth`     | `string`                       | `undefined`   | Border width override.                   |
| `boxShadow`       | `string`                       | `undefined`   | Box shadow override.                     |
| `dropShadow`      | `string`                       | `undefined`   | Drop shadow override.                    |
| `width`           | `string`                       | `undefined`   | Width override.                          |
| `height`          | `string`                       | `undefined`   | Height override.                         |
| `minWidth`        | `string`                       | `undefined`   | Min width override.                      |
| `minHeight`       | `string`                       | `undefined`   | Min height override.                     |
| `maxWidth`        | `string`                       | `undefined`   | Max width override.                      |
| `maxHeight`       | `string`                       | `undefined`   | Max height override.                     |
| `variant`         | `ButtonVariants`               | `"solid"`     | `"solid" \| "outline" \| "ghost" \| "solid-light"`. |
| `disabled`        | `boolean`                      | `false`       | Disabled state.                          |
| `hidden`          | `boolean`                      | `false`       | Skip rendering when true.                |

**Slots**
- default — button label.
- `prefix` — leading icon/content.
- `postfix` — trailing icon/content.

---

### `<ssk-input>` (class `Input`)
Single-line text input with optional label, helper text, char counter, prefix/postfix slots.

**Props**
| Name              | Type                                                            | Default     | Description                                |
|-------------------|-----------------------------------------------------------------|-------------|--------------------------------------------|
| `testId`          | `string`                                                        | `undefined` | Test id for the inner `<input>`.           |
| `themeColor`      | `ColorRole \| ColorName`                                        | `"primary"` | Border/focus color.                        |
| `color`           | `ColorRole \| ColorName`                                        | `undefined` | Text color.                                |
| `backgroundColor` | `string`                                                        | `undefined` | Background color override.                 |
| `size`            | `Size`                                                          | `"md"`      | Sizing token.                              |
| `fontFamilyGroup` | `FontFamilyGroup`                                               | `"sans"`    | Font family group.                         |
| `fontWeight`      | `FontWeight`                                                    | `"normal"`  | Font weight.                               |
| `width`           | `string`                                                        | `undefined` | Width override.                            |
| `label`           | `string \| undefined`                                           | `undefined` | Floating/top label.                        |
| `helperText`      | `string \| undefined`                                           | `undefined` | Helper / error message under field.        |
| `name`            | `string \| undefined`                                           | `undefined` | Native `name` attribute.                   |
| `type`            | `"text" \| "number" \| "password" \| "email" \| "tel" \| "url"` | `"text"`    | Native input type.                         |
| `value`           | `string \| undefined`                                           | `undefined` | Controlled value.                          |
| `placeholder`     | `string \| undefined`                                           | `undefined` | Placeholder text.                          |
| `status`          | `"error" \| "success" \| undefined`                             | `undefined` | Status decoration.                         |
| `disabled`        | `boolean`                                                       | `false`     | Disabled state.                            |
| `hidden`          | `boolean`                                                       | `false`     | Skip rendering.                            |
| `error`           | `boolean`                                                       | `false`     | Force error styling.                       |
| `limit`           | `number \| undefined`                                           | `undefined` | maxlength + character counter.             |
| `showLimit`       | `boolean`                                                       | `false`     | Show `(used/limit)` counter.               |
| `required`        | `boolean`                                                       | `false`     | Append red `*` to label.                   |
| `autoComplete`    | `"on" \| "off"`                                                 | `"on"`      | Native `autocomplete`.                     |

**Events**
- `input` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires on every keystroke.
- `change` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires on commit/blur.

**Slots**
- `label` — custom label content (replaces `label` prop when provided).
- `prefix` — leading addon (e.g. `<ssk-input-addon>` with currency).
- `postfix` — trailing addon (icon, button, …).

---

### `<ssk-input-addon>` (class `InputAddon`)
Side decoration to drop into an `<ssk-input>` `slot="prefix"` or `slot="postfix"`. Inherits theme tokens but does not own its border.

**Props**
| Name              | Type                                                            | Default     | Description                              |
|-------------------|-----------------------------------------------------------------|-------------|------------------------------------------|
| `testId`          | `string`                                                        | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`                                        | `undefined` | Background color role.                   |
| `color`           | `ColorRole \| ColorName`                                        | `"inherit"` | Text color.                              |
| `size`            | `Size`                                                          | `"md"`      | Sizing token.                            |
| `fontFamilyGroup` | `FontFamilyGroup`                                               | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`                                                    | `"normal"`  | Font weight.                             |
| `width`           | `string`                                                        | `undefined` | Width override.                          |
| `label`           | `string \| undefined`                                           | `undefined` | Label (rarely used).                     |
| `helperText`      | `string \| undefined`                                           | `undefined` | Helper text (rarely used).               |
| `name`            | `string \| undefined`                                           | `undefined` | Native name.                             |
| `type`            | `"text" \| "number" \| "password" \| "email" \| "tel" \| "url"` | `"text"`    | Native type (rarely used).               |
| `value`           | `string \| undefined`                                           | `undefined` | Value (rarely used).                     |
| `placeholder`     | `string \| undefined`                                           | `undefined` | Placeholder (rarely used).               |
| `disabled`        | `boolean`                                                       | `false`     | Disabled state.                          |
| `hidden`          | `boolean`                                                       | `false`     | Skip rendering.                          |

**Slots**
- default — addon content (`<ssk-icon>`, text, …).

---

### `<ssk-input-range>` (class `InputRange`)
Two inputs side-by-side for "from"/"to" ranges (numbers, dates as strings, etc.).

**Props**
| Name              | Type                                                            | Default     | Description                              |
|-------------------|-----------------------------------------------------------------|-------------|------------------------------------------|
| `testId`          | `string`                                                        | `undefined` | Test id for both inputs.                 |
| `themeColor`      | `ColorRole \| ColorName`                                        | `"primary"` | Focus color.                             |
| `color`           | `ColorRole \| ColorName`                                        | `undefined` | Text color.                              |
| `backgroundColor` | `string`                                                        | `undefined` | Background override.                     |
| `size`            | `Size`                                                          | `"md"`      | Sizing token.                            |
| `fontFamilyGroup` | `FontFamilyGroup`                                               | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`                                                    | `"normal"`  | Font weight.                             |
| `width`           | `string`                                                        | `undefined` | Width override.                          |
| `label`           | `string \| undefined`                                           | `undefined` | Top label.                                |
| `helperText`      | `string \| undefined`                                           | `undefined` | Helper text.                              |
| `name`            | `string \| undefined`                                           | `undefined` | Native name attribute shared by both.    |
| `placeholderFrom` | `string \| undefined`                                           | `undefined` | Placeholder for "from" input.            |
| `placeholderTo`   | `string \| undefined`                                           | `undefined` | Placeholder for "to" input.              |
| `hidden`          | `boolean`                                                       | `false`     | Skip rendering.                          |
| `limit`           | `number`                                                        | `undefined` | maxlength.                                |
| `type`            | `"text" \| "number" \| "password" \| "email" \| "tel" \| "url"` | `"text"`    | Native input type.                       |
| `error`           | `boolean`                                                       | `false`     | Force error styling.                     |
| `required`        | `boolean`                                                       | `false`     | Append red `*` to label.                  |
| `disabled`        | `boolean`                                                       | `false`     | Disabled state.                          |
| `minHeight`       | `string`                                                        | `undefined` | Min height override.                     |
| `minWidth`        | `string`                                                        | `undefined` | Min width override.                      |
| `valueFrom`       | `string \| undefined`                                           | `undefined` | "From" value.                            |
| `valueTo`         | `string \| undefined`                                           | `undefined` | "To" value.                              |

**Events**
- `value-from-input` — `CustomEvent<{ originalEvent: Event }>` — input event on "from".
- `value-from-change` — `CustomEvent<{ originalEvent: Event }>` — change event on "from".
- `input-from-click` — `CustomEvent<{ originalEvent: Event }>` — click on "from".
- `value-to-input` — `CustomEvent<{ originalEvent: Event }>` — input event on "to".
- `value-to-change` — `CustomEvent<{ originalEvent: Event }>` — change event on "to".
- `input-to-click` — `CustomEvent<{ originalEvent: Event }>` — click on "to".

**Slots**
- `prefix` — leading addon.
- `center` — separator between the two inputs (e.g. an em-dash).
- `postfix` — trailing addon.

---

### `<ssk-input-tag>` (class `Inputtag`)
Tag input — type-then-Enter adds a chip, click X removes. Supports a character limit and multi-line wrapping.

**Props**
| Name              | Type                            | Default     | Description                                |
|-------------------|---------------------------------|-------------|--------------------------------------------|
| `testId`          | `string`                        | `undefined` | Test id.                                   |
| `themeColor`      | `ColorRole \| ColorName`        | `"primary"` | Tag chip color.                            |
| `color`           | `ColorRole \| ColorName`        | `undefined` | Text color.                                |
| `backgroundColor` | `string`                        | `undefined` | Background override.                       |
| `size`            | `Size`                          | `"md"`      | Sizing token.                              |
| `fontFamilyGroup` | `FontFamilyGroup`               | `"sans"`    | Font family group.                         |
| `fontWeight`      | `FontWeight`                    | `"normal"`  | Font weight.                               |
| `width`           | `string`                        | `undefined` | Width override.                            |
| `label`           | `string \| undefined`           | `undefined` | Top label.                                  |
| `helperText`      | `string \| undefined`           | `undefined` | Helper text.                                |
| `name`            | `string \| undefined`           | `undefined` | Native name.                               |
| `placeholder`     | `string \| undefined`           | `undefined` | Placeholder.                               |
| `hidden`          | `boolean`                       | `false`     | Skip rendering.                            |
| `limit`           | `number`                        | `undefined` | Total characters allowed across all tags.  |
| `required`        | `boolean`                       | `false`     | Append red `*`.                            |
| `minHeight`       | `string`                        | `undefined` | Min height override.                       |
| `minWidth`        | `string`                        | `undefined` | Min width override.                        |
| `tags`            | `string[]`                      | `[]`        | Current tag list.                          |
| `multiline`       | `boolean`                       | `false`     | Wrap tags onto multiple lines.             |
| `maxTagLength`    | `number`                        | `undefined` | Max characters per individual tag.         |
| `value`           | `string`                        | `""`        | Current pending input text (not yet added).|

**Events**
- `change` — `CustomEvent<string[]>` — fires when a tag is added (Enter) or removed (X).
- `input` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — input typing.

---

### `<ssk-textarea>` (class `Textarea`)
Multi-line textarea with label, helper text, char counter, and resize handle.

**Props**
| Name              | Type                                              | Default     | Description                              |
|-------------------|---------------------------------------------------|-------------|------------------------------------------|
| `testId`          | `string`                                          | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`                          | `"primary"` | Focus color.                             |
| `color`           | `ColorRole \| ColorName`                          | `undefined` | Text color.                              |
| `backgroundColor` | `string`                                          | `undefined` | Background override.                     |
| `size`            | `Size`                                            | `"md"`      | Sizing token.                            |
| `fontFamilyGroup` | `FontFamilyGroup`                                 | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`                                      | `"normal"`  | Font weight.                             |
| `width`           | `string`                                          | `undefined` | Width override.                          |
| `label`           | `string \| undefined`                             | `undefined` | Top label.                               |
| `helperText`      | `string \| undefined`                             | `undefined` | Helper text.                             |
| `name`            | `string \| undefined`                             | `undefined` | Native name.                             |
| `value`           | `string \| undefined`                             | `undefined` | Current value.                           |
| `placeholder`     | `string \| undefined`                             | `undefined` | Placeholder.                             |
| `status`          | `"error" \| "success" \| undefined`               | `undefined` | Status decoration.                       |
| `disabled`        | `boolean`                                         | `false`     | Disabled state.                          |
| `hidden`          | `boolean`                                         | `false`     | Skip rendering.                          |
| `rows`            | `number`                                          | `2`         | Visible row count.                       |
| `limit`           | `number`                                          | `undefined` | maxlength + counter.                     |
| `error`           | `boolean`                                         | `false`     | Force error styling.                     |
| `required`        | `boolean`                                         | `false`     | Append red `*`.                          |
| `minHeight`       | `string`                                          | `undefined` | Min height override.                     |
| `minWidth`        | `string`                                          | `undefined` | Min width override.                      |
| `resize`          | `"none" \| "both" \| "horizontal" \| "vertical"`  | `"both"`    | Native resize behaviour.                 |

**Events**
- `input` — `CustomEvent<{ originalEvent: Event }>` — fires on keystroke.
- `change` — `CustomEvent<{ originalEvent: Event }>` — fires on commit/blur.

---

### `<ssk-checkbox>` (class `Checkbox`)
Single checkbox or a group of checkboxes via the `group` prop (with optional default-checked list + indeterminate parent).

**Props**
| Name              | Type                          | Default        | Description                                |
|-------------------|-------------------------------|----------------|--------------------------------------------|
| `testId`          | `string`                      | `undefined`    | Test id.                                   |
| `themeColor`      | `ColorRole \| ColorName`      | `"primary"`    | Active fill color.                         |
| `color`           | `ColorRole \| ColorName`      | `""`           | Label text color.                          |
| `backgroundColor` | `string`                      | `"transparent"`| Background override.                       |
| `borderColor`     | `string`                      | `undefined`    | Border color override.                     |
| `size`            | `Size`                        | `"md"`         | Sizing token.                              |
| `fontSize`        | `string`                      | `undefined`    | Font size override.                        |
| `gap`             | `string`                      | `undefined`    | Spacing between checkbox and label.        |
| `rounded`         | `string`                      | `undefined`    | Border radius (default ~20%).              |
| `hidden`          | `boolean`                     | `false`        | Skip rendering.                            |
| `label`           | `string`                      | `undefined`    | Label text.                                 |
| `checked`         | `boolean`                     | `false`        | Checked state (reflects to attribute).      |
| `indeterminate`   | `boolean`                     | `false`        | Indeterminate visual state.                |
| `disabled`        | `boolean`                     | `false`        | Disabled state.                            |
| `group`           | `GroupCheckbox \| undefined`  | `undefined`    | Renders a group of checkboxes.             |

```ts
export type checkboxOptions = { label: string; checked?: boolean; disabled?: boolean; value: string };
export type GroupCheckbox = { defaultValue?: string[]; options: checkboxOptions[] };
```

**Events**
- `change` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires on toggle.

---

### `<ssk-toggle>` (class `Toggle`)
On/off switch styled like an iOS toggle. Wraps a native `<input type="checkbox">`.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `testId`          | `string`                   | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"` | Active background color.                 |
| `color`           | `ColorRole \| ColorName`   | `"white"`   | Knob color.                              |
| `backgroundColor` | `string`                   | `undefined` | Active background override.              |
| `size`            | `Size`                     | `"md"`      | Sizing token.                            |
| `fontSize`        | `string`                   | `undefined` | Font size override (affects knob/track). |
| `margin`          | `string`                   | `undefined` | Margin override.                         |
| `disabled`        | `boolean`                  | `false`     | Disabled state.                          |
| `hidden`          | `boolean`                  | `false`     | Skip rendering.                          |
| `checked`         | `boolean`                  | `false`     | On/off state.                            |

**Events**
- `input` — `CustomEvent<{ originalEvent: Event }>` — fires on user input.
- `change` — `CustomEvent<{ originalEvent: Event }>` — fires on commit.
- `click` — `CustomEvent<{ originalEvent: Event }>` — fires on click.

---

### `<ssk-radio>` / `<ssk-radio-group>` (radio family)

#### `<ssk-radio>` (class `Radio`)
Single radio button. Use directly for one-off cases; for a set of options, prefer `<ssk-radio-group>`.

**Props**
| Name              | Type                       | Default        | Description                              |
|-------------------|----------------------------|----------------|------------------------------------------|
| `testId`          | `string`                   | `undefined`    | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"`    | Active fill color.                       |
| `color`           | `ColorRole \| ColorName`   | `""`           | Label text color.                        |
| `backgroundColor` | `string`                   | `"transparent"`| Background override.                     |
| `borderColor`     | `string`                   | `undefined`    | Border color override.                   |
| `size`            | `Size`                     | `"md"`         | Sizing token.                            |
| `fontSize`        | `string`                   | `undefined`    | Font size override.                      |
| `gap`             | `string`                   | `undefined`    | Spacing between radio and label.         |
| `rounded`         | `string`                   | `undefined`    | Border radius (default 50%).             |
| `width`           | `string`                   | `undefined`    | Width override.                          |
| `height`          | `string`                   | `undefined`    | Height override.                         |
| `hidden`          | `boolean`                  | `false`        | Skip rendering.                          |
| `label`           | `string`                   | `undefined`    | Label text.                              |
| `checked`         | `boolean`                  | `false`        | Selected state.                          |
| `indeterminate`   | `boolean`                  | `false`        | Indeterminate visual state.              |
| `disabled`        | `boolean`                  | `false`        | Disabled state.                          |

**Events**
- `change` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires on selection.

**Slots**
- `label` — custom label content (replaces `label` prop when provided).

#### `<ssk-radio-group>` (class `RadioGroup`)
Group of radio buttons driven by a `group` config object. Enforces exclusive selection.

**Props**
| Name              | Type                       | Default        | Description                              |
|-------------------|----------------------------|----------------|------------------------------------------|
| `testId`          | `string`                   | `undefined`    | Test id base.                            |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"`    | Active fill color.                       |
| `color`           | `ColorRole \| ColorName`   | `""`           | Label text color.                        |
| `backgroundColor` | `string`                   | `"transparent"`| Background override.                     |
| `borderColor`     | `string`                   | `undefined`    | Border color override.                   |
| `size`            | `Size`                     | `"md"`         | Sizing token.                            |
| `fontSize`        | `string`                   | `undefined`    | Font size override.                      |
| `gap`             | `string`                   | `undefined`    | Spacing override.                        |
| `rounded`         | `string`                   | `undefined`    | Border radius override.                  |
| `width`           | `string`                   | `undefined`    | Width override.                          |
| `height`          | `string`                   | `undefined`    | Height override.                         |
| `hidden`          | `boolean`                  | `false`        | Skip rendering.                          |
| `label`           | `string`                   | `undefined`    | Group label.                             |
| `checked`         | `boolean`                  | `false`        | Group-level checked flag (rarely used).  |
| `indeterminate`   | `boolean`                  | `false`        | Indeterminate visual state.              |
| `disabled`        | `boolean`                  | `false`        | Disable entire group.                    |
| `group`           | `GroupRadio \| undefined`  | `undefined`    | Group config (options + default).        |
| `inline`          | `boolean`                  | `false`        | Render options inline (horizontally).    |

```ts
export type radioOptions = { label: string; checked?: boolean; disabled?: boolean; value: string };
export type GroupRadio = { defaultValue?: string[]; options: radioOptions[] };
```

**Events**
- `change` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires when the selection changes.

---

### `<ssk-pin-code>` (class `PinCode`)
N-digit OTP/PIN input — focus auto-advances between cells, supports paste of the whole code.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `testId`          | `string`                   | `undefined` | Test id (applied to every cell).         |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"` | Focus color.                             |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `backgroundColor` | `string`                   | `undefined` | Background override.                     |
| `size`            | `Size`                     | `"md"`      | Sizing token.                            |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`  | Font weight.                             |
| `width`           | `string`                   | `undefined` | Per-cell width override.                 |
| `height`          | `string`                   | `undefined` | Per-cell height override.                |
| `length`          | `number`                   | `3`         | Number of cells.                         |
| `type`            | `"text" \| "number"`       | `"number"`  | Allowed character class.                 |
| `value`           | `string`                   | `""`        | Current concatenated value.              |
| `placeholder`     | `string \| undefined`      | `undefined` | Placeholder for each cell.               |
| `disabled`        | `boolean`                  | `false`     | Disabled state.                          |
| `hidden`          | `boolean`                  | `false`     | Skip rendering.                          |
| `error`           | `boolean`                  | `false`     | Force error styling on all cells.        |

**Events**
- `change` — `CustomEvent<string>` — fires with the full concatenated value whenever a cell changes.

---

### `<ssk-card-select>` / `<ssk-card-group>` (card-select family)

#### `<ssk-card-select>` (class `CardSelect`)
Single selectable card used inside `<ssk-card-group>`. Renders a checkmark when selected.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `testId`          | `string`                   | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"` | Active border color.                     |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `size`            | `Size`                     | `"md"`      | Sizing token (font sizing).              |
| `rounded`         | `string`                   | `undefined` | Border radius.                           |
| `cardSize`        | `CardSize`                 | `"md"`      | Card box size variant (`"md" \| "sm"`).  |
| `disabled`        | `boolean`                  | `false`     | Disabled state.                          |
| `selected`        | `boolean`                  | `false`     | Selected state.                          |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`  | Font weight.                             |
| `width`           | `string`                   | `undefined` | Width override.                          |
| `hidden`          | `boolean`                  | `false`     | Skip rendering.                          |
| `index`           | `number`                   | `0`         | Index passed back in `card-click` event. |

**Events**
- `card-click` — `CustomEvent<{ index: number }>` — fires when the card is clicked (not when disabled).

**Slots**
- default — card body content (icon, label, support text).

#### `<ssk-card-group>` (class `CardGroup`)
Renders a flex-wrapped grid of `<ssk-card-select>` from an array. Tracks single-select state.

**Props**
| Name    | Type      | Default | Description                                   |
|---------|-----------|---------|-----------------------------------------------|
| `cards` | `Card[]`  | `[]`    | Card definitions (label, icon, supportText…). |

```ts
interface Card {
  id: number;
  label: string;
  supportText: string;
  cardSize: string;
  selected: boolean;
  disabled: boolean;
  icon: string;
}
```

**Behavior**
- Listens for `card-click` from children and updates `selectedCardIndex` so only one card is selected at a time.

---

### 2.2 Typography

### `<ssk-heading>` (class `Heading`)
Renders `<h1>` … `<h5>` depending on `level`. Maps level to a default size scale (1 → 4xl, 2 → 3xl, …).

**Props**
| Name              | Type                                                | Default            | Description                              |
|-------------------|-----------------------------------------------------|--------------------|------------------------------------------|
| `themeColor`      | `ColorRole \| ColorName`                            | `""`               | Fallback color role.                     |
| `color`           | `ColorRole \| ColorName`                            | `"background.900"` | Text color.                              |
| `size`            | `Size`                                              | `"md"`             | Overrides level→size mapping.            |
| `padding`         | `Size`                                              | `undefined`        | Padding scale.                           |
| `fontSize`        | `string`                                            | `undefined`        | Font size override.                      |
| `lineHeight`      | `string`                                            | `undefined`        | Line height override.                    |
| `margin`          | `string`                                            | `undefined`        | Margin override.                         |
| `fontFamilyGroup` | `FontFamilyGroup`                                   | `"sans"`           | Font family group.                       |
| `fontWeight`      | `FontWeight`                                        | `"normal"`         | Font weight.                             |
| `hidden`          | `boolean`                                           | `false`            | Skip rendering.                          |
| `italic`          | `boolean`                                           | `false`            | Italic style.                            |
| `underline`       | `boolean`                                           | `false`            | Underline decoration.                    |
| `strike`          | `boolean`                                           | `false`            | Line-through decoration.                 |
| `align`           | `"left" \| "center" \| "right" \| "justify"`        | `undefined`        | Text alignment.                          |
| `transform`       | `"uppercase" \| "lowercase" \| "capitalize"`        | `undefined`        | Text transform.                          |
| `level`           | `1 \| 2 \| 3 \| 4 \| 5`                             | `1`                | Heading level.                           |

**Slots**
- default — heading text.

---

### `<ssk-text>` (class `Text`)
Paragraph-level text wrapper with theme-aware colour, weight, and decoration.

**Props**
| Name              | Type                                          | Default            | Description                              |
|-------------------|-----------------------------------------------|--------------------|------------------------------------------|
| `themeColor`      | `ColorRole \| ColorName`                      | `""`               | Fallback color role.                     |
| `color`           | `ColorRole \| ColorName`                      | `"background.900"` | Text color.                              |
| `size`            | `Size`                                        | `"md"`             | Sizing token.                            |
| `padding`         | `Size`                                        | `undefined`        | Padding scale.                           |
| `fontSize`        | `string`                                      | `undefined`        | Font size override.                      |
| `lineHeight`      | `string`                                      | `undefined`        | Line height override.                    |
| `margin`          | `string`                                      | `undefined`        | Margin override.                         |
| `fontFamilyGroup` | `FontFamilyGroup`                             | `"sans"`           | Font family group.                       |
| `fontWeight`      | `FontWeight`                                  | `"normal"`         | Font weight.                             |
| `hidden`          | `boolean`                                     | `false`            | Skip rendering.                          |
| `italic`          | `boolean`                                     | `false`            | Italic style.                            |
| `underline`       | `boolean`                                     | `false`            | Underline decoration.                    |
| `strike`          | `boolean`                                     | `false`            | Line-through decoration.                 |
| `align`           | `"left" \| "center" \| "right" \| "justify"`  | `undefined`        | Text alignment.                          |
| `transform`       | `"uppercase" \| "lowercase" \| "capitalize"`  | `undefined`        | Text transform.                          |

**Slots**
- default — body text.

---

### 2.3 Indicators

### `<ssk-alert>` (class `Alert`)
Non-modal callout for info/success/warning/error messages, with optional close button and action slots.

**Props**
| Name              | Type              | Default     | Description                                       |
|-------------------|-------------------|-------------|---------------------------------------------------|
| `size`            | `Size`            | `"md"`      | Sizing token.                                     |
| `margin`          | `string`          | `undefined` | Margin override.                                  |
| `padding`         | `Size`            | `undefined` | Padding scale.                                    |
| `rounded`         | `string`          | `undefined` | Border radius.                                    |
| `width`           | `string`          | `"auto"`    | Width.                                            |
| `fontFamilyGroup` | `FontFamilyGroup` | `"sans"`    | Font family group.                                |
| `fontSize`        | `string`          | `undefined` | Font size override.                               |
| `hidden`          | `boolean`         | `false`     | Skip rendering.                                   |
| `type`            | `Type`            | `"default"` | `"default" \| "info" \| "error" \| "warning" \| "success"`. |
| `message`         | `string`          | `undefined` | Body message.                                     |
| `topic`           | `string`          | `undefined` | Title.                                            |
| `hideCloseButton` | `boolean`         | `false`     | Hide the X close icon.                            |

**Events**
- `close` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires when the close icon is clicked.

**Slots**
- `icon-slot` — leading icon area.
- `close-button-slot` — replace the default close button row.
- `ok-button-slot` — confirm action button row.

---

### `<ssk-badge>` (class `Badge`)
Small status pill (e.g. for counts, labels). Three visual variants: `solid`, `outline`, `subtle`.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `testId`          | `string`                   | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"` | Background palette role.                 |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `size`            | `Size`                     | `"md"`      | Font size scale.                         |
| `rounded`         | `string`                   | `undefined` | Border radius (default 9999px).          |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`  | Font weight.                             |
| `width`           | `string`                   | `undefined` | Width override.                          |
| `variant`         | `BadgeVariants`            | `"solid"`   | `"solid" \| "outline" \| "subtle"`.      |
| `hidden`          | `boolean`                  | `false`     | Skip rendering.                          |

**Slots**
- default — badge content (text + optional `<ssk-icon>`).

---

### `<ssk-tag>` (class `Tag`)
Like `<ssk-badge>` but with a square 8px radius. Same three variants.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `testId`          | `string`                   | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"` | Background palette role.                 |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `size`            | `Size`                     | `"md"`      | Font size scale.                         |
| `rounded`         | `string`                   | `undefined` | Border radius (default 8px).             |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`  | Font weight.                             |
| `width`           | `string`                   | `undefined` | Width override.                          |
| `variant`         | `BadgeVariants`            | `"solid"`   | `"solid" \| "outline" \| "subtle"`.      |
| `hidden`          | `boolean`                  | `false`     | Skip rendering.                          |
| `cursor`          | `string`                   | `undefined` | CSS cursor (e.g. `"pointer"`).           |

**Slots**
- default — tag content.

---

### `<ssk-spinner>` (class `Spinner`)
Indeterminate spinner — animated SVG arc.

**Props**
| Name     | Type                       | Default     | Description              |
|----------|----------------------------|-------------|--------------------------|
| `testId` | `string`                   | `undefined` | Test id.                 |
| `color`  | `ColorRole \| ColorName`   | `"primary"` | Spinner color.           |
| `size`   | `Size`                     | `"md"`      | Width/height token.      |
| `hidden` | `boolean`                  | `false`     | Skip rendering.          |

---

### `<ssk-skeleton>` (class `Skeleton`)
Animated placeholder block for loading states. Three shapes (capsule, circle, square) and a configurable shimmer duration.

**Props**
| Name                | Type                                      | Default     | Description                              |
|---------------------|-------------------------------------------|-------------|------------------------------------------|
| `testId`            | `string`                                  | `undefined` | Test id.                                 |
| `skeletonShape`     | `"capsule" \| "circle" \| "square"`       | `"capsule"` | Shape preset.                            |
| `size`              | `Size`                                    | `undefined` | Maps to fixed px width/height.           |
| `width`             | `string`                                  | `undefined` | Width override.                          |
| `height`            | `string`                                  | `undefined` | Height override.                         |
| `animationDuration` | `number`                                  | `800`       | Shimmer duration in milliseconds.        |

---

### `<ssk-progress-bar>` (class `ProgressBar`)
Linear progress indicator with status colors (in-progress / success / error), a label, and an optional percentage badge.

**Props**
| Name              | Type                                            | Default            | Description                              |
|-------------------|-------------------------------------------------|--------------------|------------------------------------------|
| `themeColor`      | `ColorRole \| ColorName`                        | `""`               | Bar fill color role.                     |
| `color`           | `ColorRole \| ColorName`                        | `undefined`        | Label text color.                        |
| `size`            | `Size`                                          | `"md"`             | Sizing token.                            |
| `width`           | `string`                                        | `undefined`        | Bar width override.                      |
| `value`           | `number`                                        | `0`                | Progress percentage (0–100).             |
| `labelPosition`   | `"top" \| "bottom" \| "right"`                  | `"bottom"`         | Where to render the label/percentage.    |
| `status`          | `"in-progress" \| "error" \| "success"`         | `"in-progress"`    | Bar status color.                        |
| `styleOfProgress` | `"text" \| "icon"`                              | `"text"`           | Render percent as text or check icon.    |
| `label`           | `string`                                        | `"Loading Data..."` | Label shown next to the bar.            |

---

### 2.4 Media

### `<ssk-avatar>` (class `Avatar`)
Image or initials-based avatar. Falls back to `?` when no `label` is provided.

**Props**
| Name              | Type                                                                   | Default     | Description                              |
|-------------------|------------------------------------------------------------------------|-------------|------------------------------------------|
| `size`            | `Size`                                                                 | `"md"`      | Sizing token.                            |
| `themeColor`      | `string`                                                               | `"primary"` | Background color when no image.          |
| `color`           | `string`                                                               | `"white"`   | Initials text color.                     |
| `padding`         | `Size`                                                                 | `undefined` | Padding token.                           |
| `boxsize`         | `Size`                                                                 | `undefined` | Explicit width/height token.             |
| `hidden`          | `boolean`                                                              | `false`     | Skip rendering.                          |
| `fontFamilyGroup` | `FontFamilyGroup`                                                      | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`                                                           | `"normal"`  | Font weight for initials.                |
| `fontSize`        | `string`                                                               | `undefined` | Font size override.                      |
| `src`             | `string`                                                               | `undefined` | Image source URL.                        |
| `label`           | `string`                                                               | `undefined` | Name (used for initials when no image).  |
| `alt`             | `string`                                                               | `undefined` | Image alt text.                          |
| `shape`           | `"circle" \| "rounded"`                                                | `"rounded"` | Border-radius preset.                    |
| `objectFit`       | `"fill" \| "contain" \| "cover" \| "none" \| "scale-down"`             | `undefined` | CSS object-fit for the image.            |

---

### `<ssk-image>` (class `Image`)
Themed `<img>` wrapper with size/border/object-fit props and a `fallbackSrc` for graceful errors.

**Props**
| Name              | Type                                                              | Default     | Description                              |
|-------------------|-------------------------------------------------------------------|-------------|------------------------------------------|
| `themeColor`      | `ColorRole \| ColorName`                                          | `""`        | Fallback color role.                     |
| `color`           | `ColorRole \| ColorName`                                          | `undefined` | Text color (for alt fallback).           |
| `backgroundColor` | `string`                                                          | `undefined` | Background override.                     |
| `borderColor`     | `string`                                                          | `undefined` | Border color override.                   |
| `size`            | `Size`                                                            | `"md"`      | Sizing token.                            |
| `padding`         | `Size`                                                            | `undefined` | Padding scale.                           |
| `fontSize`        | `string`                                                          | `undefined` | Font size override.                      |
| `lineHeight`      | `string`                                                          | `undefined` | Line height override.                    |
| `gap`             | `string`                                                          | `undefined` | Gap override.                            |
| `rounded`         | `string`                                                          | `undefined` | Border radius.                           |
| `margin`          | `string`                                                          | `undefined` | Margin override.                         |
| `fontFamilyGroup` | `FontFamilyGroup`                                                 | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`                                                      | `"normal"`  | Font weight.                             |
| `borderWidth`     | `string`                                                          | `undefined` | Border width override.                   |
| `borderStyle`     | `"solid" \| "dashed" \| "dotted" \| "double" \| "groove" \| "ridge" \| "inset" \| "outset" \| "none" \| "hidden"` | `undefined` | Border style.        |
| `boxShadow`       | `string`                                                          | `undefined` | Box shadow override.                     |
| `dropShadow`      | `string`                                                          | `undefined` | Drop shadow override.                    |
| `width`           | `string`                                                          | `undefined` | Width override.                          |
| `height`          | `string`                                                          | `undefined` | Height override.                         |
| `minWidth`        | `string`                                                          | `undefined` | Min width override.                      |
| `minHeight`       | `string`                                                          | `undefined` | Min height override.                     |
| `maxWidth`        | `string`                                                          | `undefined` | Max width override.                      |
| `maxHeight`       | `string`                                                          | `undefined` | Max height override.                     |
| `hidden`          | `boolean`                                                         | `false`     | Skip rendering.                          |
| `alt`             | `string`                                                          | `undefined` | Image alt text.                          |
| `src`             | `string`                                                          | `undefined` | Image source URL.                        |
| `fallbackSrc`     | `string`                                                          | `undefined` | Used when `src` fails to load.           |
| `boxSize`         | `string`                                                          | `undefined` | Explicit box size.                       |
| `objectFit`       | `"fill" \| "contain" \| "cover" \| "none" \| "scale-down"`        | `undefined` | CSS object-fit.                          |

---

### `<ssk-icon>` (class `Icon`)
Inline SVG icon. The full icon set is generated by `npm run generate:icon`; pass the icon's `name` (e.g. `"solid-x-mark"`, `"outline-check-circle"`).

**Props**
| Name         | Type                       | Default     | Description                                |
|--------------|----------------------------|-------------|--------------------------------------------|
| `themeColor` | `ColorRole \| ColorName`   | `undefined` | Background or accent color.                |
| `color`      | `ColorRole \| ColorName`   | `undefined` | Icon fill color (via `currentColor`).      |
| `size`       | `Size`                     | `"md"`      | Width/height token.                        |
| `padding`    | `Size`                     | `undefined` | Padding scale.                             |
| `margin`     | `string`                   | `undefined` | Margin override.                           |
| `width`      | `string`                   | `undefined` | Width override.                            |
| `height`     | `string`                   | `undefined` | Height override.                           |
| `hidden`     | `boolean`                  | `false`     | Skip rendering.                            |
| `cursor`     | `string`                   | `undefined` | CSS cursor.                                |
| `onClick`    | `() => void`               | `undefined` | Click handler (legacy prop — prefer `@click`). |
| `name`       | `string`                   | `""`        | Icon name from the generated catalogue.    |
| `iconName`   | `string`                   | `""`        | Alias for `name` (legacy).                 |

**Notes**
- This file is generated by `npm run generate:icon` — don't edit manually.

---

### `<ssk-country-icon>` (class `CountryIcon`)
ISO-3166 country flag icon. Pass a 3-letter `code` (e.g. `"THA"`, `"USA"`, `"VNM"`).

**Props**
| Name       | Type      | Default     | Description                              |
|------------|-----------|-------------|------------------------------------------|
| `size`     | `Size`    | `"md"`      | Width/height token.                      |
| `padding`  | `Size`    | `undefined` | Padding scale.                           |
| `margin`   | `string`  | `undefined` | Margin override.                         |
| `width`    | `string`  | `undefined` | Width override.                          |
| `height`   | `string`  | `undefined` | Height override.                         |
| `hidden`   | `boolean` | `false`     | Skip rendering.                          |
| `cursor`   | `string`  | `undefined` | CSS cursor.                              |
| `onClick`  | `() => void` | `undefined` | Click handler (legacy).               |
| `code`     | `string`  | `""`        | ISO-3166 alpha-3 country code.           |
| `iconName` | `string`  | `""`        | Legacy alias.                            |

**Notes**
- Generated file — don't edit manually.

---

### `<ssk-logo>` (class `Logo`)
Brand logo wrapper. Set `fullLogo` to render the logo + wordmark pair, otherwise renders just the mark.

**Props**
| Name           | Type      | Default     | Description                              |
|----------------|-----------|-------------|------------------------------------------|
| `size`         | `Size`    | `"md"`      | Sizing token.                            |
| `themeColor`   | `string`  | `"primary"` | Theme color (rarely visual).             |
| `borderColor`  | `string`  | `undefined` | Border color override.                   |
| `margin`       | `string`  | `undefined` | Margin override.                         |
| `borderWidth`  | `string`  | `undefined` | Border width override.                   |
| `width`        | `string`  | `undefined` | Width override.                          |
| `height`       | `string`  | `undefined` | Height override.                         |
| `gap`          | `string`  | `"0.2em"`   | Gap between mark and wordmark.           |
| `boxSize`      | `string`  | `undefined` | Explicit box size.                       |
| `hidden`       | `boolean` | `false`     | Skip rendering.                          |
| `fullLogo`     | `boolean` | `false`     | If true, render mark + wordmark.         |
| `srcLogo`      | `string`  | `undefined` | URL for the mark image.                  |
| `altLogo`      | `string`  | `undefined` | Alt text for the mark.                   |
| `srcLogoName`  | `string`  | `undefined` | URL for the wordmark image.              |
| `altLogoName`  | `string`  | `undefined` | Alt text for the wordmark.               |

---

### `<ssk-code-block>` (class `CodeBlock`)
Syntax-highlighted code block backed by PrismJS. Set `language` to load the appropriate Prism grammar on demand.

**Props**
| Name              | Type                              | Default        | Description                              |
|-------------------|-----------------------------------|----------------|------------------------------------------|
| `testId`          | `string`                          | `undefined`    | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`          | `"background"` | Background palette role.                 |
| `color`           | `ColorRole \| ColorName`          | `undefined`    | Text color.                              |
| `backgroundColor` | `ColorRole \| ColorName`          | `undefined`    | Background override.                     |
| `size`            | `Size`                            | `"md"`         | Font size scale.                         |
| `rounded`         | `string`                          | `undefined`    | Border radius (default 8px).             |
| `borderWidth`     | `string`                          | `undefined`    | Border width override.                   |
| `borderColor`     | `ColorRole \| ColorName`          | `undefined`    | Border color.                            |
| `borderStyle`     | `string`                          | `undefined`    | Border style.                            |
| `fontFamilyGroup` | `FontFamilyGroup`                 | `"sans"`       | Font family group (use `"mono"`).        |
| `fontWeight`      | `FontWeight`                      | `"normal"`     | Font weight.                             |
| `width`           | `string`                          | `undefined`    | Width override.                          |
| `height`          | `string`                          | `undefined`    | Height override.                         |
| `padding`         | `Size`                            | `undefined`    | Padding scale.                           |
| `variant`         | `BadgeVariants`                   | `"solid"`      | Visual variant.                          |
| `hidden`          | `boolean`                         | `false`        | Skip rendering.                          |
| `language`        | `string`                          | `undefined`    | PrismJS language id (`"ts"`, `"json"`…). |
| `copyButton`      | `boolean`                         | `false`        | Show a copy-to-clipboard button.         |
| `code`            | `string`                          | `""`           | Source code to highlight.                |

**Behavior**
- Dynamically imports `prismjs/components/prism-<language>.min.js` the first time a language is used; gracefully falls back to plain text on import failure.

---

### `<ssk-date-display>` (class `DateDisplay`)
Formats a date string using `dayjs` with the active locale (`th`/`en`/`fr`/`de`). Renders date + time on two lines.

**Props**
| Name         | Type                       | Default     | Description                              |
|--------------|----------------------------|-------------|------------------------------------------|
| `testId`     | `string`                   | `undefined` | Test id.                                 |
| `themeColor` | `ColorRole \| ColorName`   | `"primary"` | Theme color (rarely visual).             |
| `color`      | `ColorRole \| ColorName`   | `"gray.500"`| Text color.                              |
| `size`       | `Size`                     | `"md"`      | Top-line size; second line is one step smaller. |
| `hidden`     | `boolean`                  | `false`     | Skip rendering.                          |
| `date`       | `string`                   | `undefined` | ISO date string (parsed by dayjs).       |
| `locale`     | `string`                   | `"th"`      | Locale code (`"th"` uses Buddhist era).  |
| `dateFormat` | `string`                   | `undefined` | Override locale's date format.           |
| `timeFormat` | `string`                   | `undefined` | Override locale's time format.           |

---

### 2.5 Layout

### `<ssk-container>` (class `Container`)
Themed `<div>` with background, border, and font tokens — useful as a card/section wrapper without composing the full `<ssk-card>`.

**Props**
| Name              | Type                              | Default        | Description                              |
|-------------------|-----------------------------------|----------------|------------------------------------------|
| `testId`          | `string`                          | `undefined`    | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`          | `"background"` | Background palette role.                 |
| `color`           | `ColorRole \| ColorName`          | `undefined`    | Text color.                              |
| `backgroundColor` | `ColorRole \| ColorName`          | `undefined`    | Background override.                     |
| `size`            | `Size`                            | `"md"`         | Sizing token.                            |
| `rounded`         | `string`                          | `undefined`    | Border radius (default 8px).             |
| `borderWidth`     | `string`                          | `undefined`    | Border width (default 1px).              |
| `borderColor`     | `ColorRole \| ColorName`          | `undefined`    | Border color.                            |
| `borderStyle`     | `string`                          | `undefined`    | Border style (default `"solid"`).        |
| `fontFamilyGroup` | `FontFamilyGroup`                 | `"sans"`       | Font family group.                       |
| `fontWeight`      | `FontWeight`                      | `"normal"`     | Font weight.                             |
| `width`           | `string`                          | `undefined`    | Width override.                          |
| `height`          | `string`                          | `undefined`    | Height override.                         |
| `padding`         | `Size`                            | `undefined`    | Padding scale.                           |
| `variant`         | `BadgeVariants`                   | `"solid"`      | Visual variant (rarely used).            |
| `hidden`          | `boolean`                         | `false`        | Skip rendering.                          |
| `cursor`          | `string`                          | `undefined`    | CSS cursor.                              |
| `align`           | `"center" \| "start" \| "end"`    | `"center"`     | Align contents.                          |
| `gap`             | `string`                          | `undefined`    | Gap between children.                    |

**Slots**
- default — container content.

---

### `<ssk-divider>` (class `Divider`)
Horizontal or vertical rule with an optional inline label.

**Props**
| Name              | Type                              | Default       | Description                              |
|-------------------|-----------------------------------|---------------|------------------------------------------|
| `themeColor`      | `ColorRole \| ColorName`          | `"gray"`      | Line color role.                         |
| `color`           | `ColorRole \| ColorName`          | `undefined`   | Line color override.                     |
| `backgroundColor` | `string`                          | `undefined`   | Background override.                     |
| `borderColor`     | `string`                          | `undefined`   | Border color override.                   |
| `size`            | `Size`                            | `"md"`        | Sizing token (drives padding/font-size). |
| `padding`         | `Size`                            | `undefined`   | Padding scale.                           |
| `fontSize`        | `string`                          | `undefined`   | Label font size override.                |
| `lineHeight`      | `string`                          | `undefined`   | Line height override.                    |
| `gap`             | `string`                          | `undefined`   | Gap between line and label.              |
| `margin`          | `string`                          | `undefined`   | Margin override.                         |
| `fontFamilyGroup` | `FontFamilyGroup`                 | `"sans"`      | Label font family group.                 |
| `fontWeight`      | `FontWeight`                      | `"normal"`    | Label font weight.                       |
| `hidden`          | `boolean`                         | `false`       | Skip rendering.                          |
| `orientation`     | `"horizontal" \| "vertical"`      | `"horizontal"`| Line orientation.                        |
| `label`           | `string`                          | `undefined`   | Label rendered inline with the line.     |

---

### `<ssk-accordion>` / `<ssk-accordion-item>` (accordion family)

#### `<ssk-accordion>` (class `Accordion`)
Container that coordinates open/close behaviour for its `<ssk-accordion-item>` children. Supports single or multi-open modes and clean/bordered visual variants.

**Props**
| Name              | Type                                | Default          | Description                              |
|-------------------|-------------------------------------|------------------|------------------------------------------|
| `testId`          | `string`                            | `undefined`      | Test id base for child items.            |
| `themeColor`      | `ColorRole \| ColorName`            | `"primary"`      | Accent color.                            |
| `size`            | `Size`                              | `"md"`           | Sizing token.                            |
| `fontSize`        | `string`                            | `undefined`      | Font size override.                      |
| `fontFamilyGroup` | `FontFamilyGroup`                   | `"sans"`         | Font family group.                       |
| `fontWeight`      | `FontWeight`                        | `"normal"`       | Font weight.                             |
| `backgroundColor` | `string`                            | `undefined`      | Header background override.              |
| `color`           | `ColorRole \| ColorName`            | `"primary.500"`  | Header text color.                       |
| `mode`            | `"single" \| "multiple"`            | `"single"`       | Allow one or many items open at once.    |
| `align`           | `"left" \| "center" \| "right"`     | `"left"`         | Header text alignment.                   |
| `variant`         | `"clean" \| "bordered"`             | `"clean"`        | Visual variant.                          |

**Events**
- `change` — `CustomEvent<{ openItems: string[] }>` — fires after any toggle with the ids of currently open items.

**Slots**
- default — one or more `<ssk-accordion-item>` children.

#### `<ssk-accordion-item>` (class `AccordionItem`)
Single expandable panel inside `<ssk-accordion>`.

**Props**
| Name    | Type                                   | Default  | Description                                  |
|---------|----------------------------------------|----------|----------------------------------------------|
| `id`    | `string`                               | `""`     | Item identifier used by parent for tracking. |
| `title` | `string`                               | `""`     | Header text (falls back to `slot="title"`).  |
| `open`  | `boolean`                              | `false`  | Open state (reflects to attribute).          |
| `align` | `"left" \| "center" \| "right"`        | `"left"` | Header text alignment.                       |

**Events**
- `accordion-toggle` — `CustomEvent<{ id: string }>` — bubbles up to `<ssk-accordion>` on header click.

**Slots**
- default — body content shown when `open`.
- `title` — replace the header text.
- `icon-open` — icon shown when item is open.
- `icon-close` — icon shown when item is closed.

---

### 2.6 Navigation

### `<ssk-tab-header>` / `<ssk-tab-button>` (tab-header family)

#### `<ssk-tab-header>` (class `TabHeader`)
Layout wrapper for a row of `<ssk-tab-button>` children. Choose between inline (underline) and button (pill) variants.

**Props**
| Name      | Type                              | Default          | Description                              |
|-----------|-----------------------------------|------------------|------------------------------------------|
| `testId`  | `string`                          | `undefined`      | Test id.                                 |
| `variant` | `"inline" \| "button"`            | `"inline"`       | Visual variant.                          |
| `align`   | `"left" \| "center" \| "right"`   | `"left"`         | Alignment of the row.                    |
| `size`    | `"sm" \| "md"`                    | `"md"`           | Tab size.                                |
| `color`   | `ColorRole \| ColorName`          | `"primary.500"`  | Active indicator color.                  |

**Slots**
- default — `<ssk-tab-button>` children.

#### `<ssk-tab-button>` (class `TabButton`)
Single tab within `<ssk-tab-header>`. Toggle the `active` attribute to highlight it.

**Props**
| Name      | Type                              | Default          | Description                              |
|-----------|-----------------------------------|------------------|------------------------------------------|
| `testId`  | `string`                          | `undefined`      | Test id.                                 |
| `variant` | `"inline" \| "button"`            | `"inline"`       | Visual variant (match parent).           |
| `size`    | `"sm" \| "md"`                    | `"md"`           | Tab size.                                |
| `width`   | `string`                          | `undefined`      | Width override.                          |
| `color`   | `ColorRole \| ColorName`          | `"primary.500"`  | Active indicator color.                  |
| `active`  | `boolean`                         | `false`          | Highlight the tab.                       |

**Slots**
- default — tab label.

---

### `<ssk-top-navbar>` (class `TopNavbar`)
Three-column layout (left/center/right) typically used as the page header.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `size`            | `Size`                     | `"md"`      | Sizing token.                            |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `margin`          | `string`                   | `undefined` | Margin override.                         |
| `padding`         | `Size`                     | `undefined` | Padding scale.                           |
| `gap`             | `string`                   | `"md"`      | Gap between sections.                    |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`  | Font weight.                             |
| `fontSize`        | `string`                   | `undefined` | Font size override.                      |

**Slots**
- `left` — left-aligned content (logo, menu button, …).
- default — center content (typically the page title).
- `right` — right-aligned content (user menu, actions).

---

### `<ssk-menu-items>` / `<ssk-menu-group>` (menu family)

#### `<ssk-menu-items>` (class `MenuItems`)
Single row inside a menu (e.g. inside a `<ssk-menu-group>` or sidebar list). Composable with prefix/postfix slots.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `testId`          | `string`                   | `undefined` | Test id.                                 |
| `size`            | `Size`                     | `"md"`      | Sizing token.                            |
| `themeColor`      | `string`                   | `"primary"` | Hover/active background role.            |
| `margin`          | `string`                   | `undefined` | Margin override.                         |
| `width`           | `string`                   | `undefined` | Width override.                          |
| `height`          | `string`                   | `undefined` | Height override.                         |
| `gap`             | `string`                   | `undefined` | Gap between prefix/label/postfix.        |
| `rounded`         | `string`                   | `undefined` | Border radius.                           |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `fontSize`        | `string`                   | `undefined` | Font size override.                      |
| `padding`         | `string`                   | `undefined` | Padding override.                        |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`  | Font weight.                             |
| `variant`         | `MenuVariants`             | `"solid"`   | Visual variant.                          |
| `hidden`          | `boolean`                  | `false`     | Skip rendering.                          |
| `label`           | `string`                   | `undefined` | Inline label.                            |
| `disabled`        | `boolean`                  | `false`     | Disabled state.                          |
| `active`          | `boolean`                  | `false`     | Active highlight state.                  |
| `min`             | `boolean`                  | `false`     | Compact mode (icon-only).                |

**Events**
- `click` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires when clicked.

**Slots**
- default — label content (when `label` prop isn't used).
- `prefix` — leading icon.
- `postfix` — trailing icon.

#### `<ssk-menu-group>` (class `MenuGroup`)
Collapsible group of menu items with a header label and chevron.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `testId`          | `string`                   | `undefined` | Test id.                                 |
| `size`            | `Size`                     | `"md"`      | Sizing token.                            |
| `themeColor`      | `string`                   | `"primary"` | Accent color.                            |
| `margin`          | `string`                   | `undefined` | Margin override.                         |
| `width`           | `string`                   | `undefined` | Width override.                          |
| `height`          | `string`                   | `undefined` | Height override.                         |
| `gap`             | `string`                   | `undefined` | Gap.                                     |
| `rounded`         | `string`                   | `undefined` | Border radius.                           |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `fontSize`        | `string`                   | `undefined` | Font size override.                      |
| `padding`         | `string`                   | `undefined` | Padding override.                        |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`  | Font weight.                             |
| `hidden`          | `boolean`                  | `false`     | Skip rendering.                          |
| `header`          | `string`                   | `undefined` | Group header label.                      |
| `isOpen`          | `boolean`                  | `false`     | Open state.                              |
| `min`             | `boolean`                  | `false`     | Compact mode (collapses to icon).        |
| `hiddenIcon`      | `boolean`                  | `false`     | Hide the chevron.                        |

**Events**
- Re-dispatches child clicks via `redispatchEvents`.

**Slots**
- default — `<ssk-menu-items>` children. Visible only when `isOpen`.

---

### 2.7 Widgets

Generic dashboard widgets used inside `<ssk-widget-grid>`. They share a common `widgetWidth`/`widgetHeight` API (in grid cells).

### `<ssk-widget-example>` (class `WidgetExample`)
Reference 2x2 widget — useful as a template when authoring new widgets.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `size`            | `Size`                     | `"md"`      | Sizing token.                            |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `margin`          | `string`                   | `undefined` | Margin override.                         |
| `padding`         | `Size`                     | `undefined` | Padding scale.                           |
| `gap`             | `string`                   | `"md"`      | Gap override.                            |
| `testId`          | `string`                   | `undefined` | Test id.                                 |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`  | Font weight.                             |
| `fontSize`        | `string`                   | `undefined` | Font size override.                      |
| `widgetWidth`     | `string`                   | `"2"`       | Grid columns spanned.                    |
| `widgetHeight`    | `string`                   | `"2"`       | Grid rows spanned.                       |

---

### `<ssk-widget-matric>` (class `WidgetMatric`)
KPI/metric widget — label + sub-text, with optional leading image/icon and trailing badge/button.

**Props**
| Name              | Type                       | Default                                | Description                              |
|-------------------|----------------------------|----------------------------------------|------------------------------------------|
| `size`            | `Size`                     | `"md"`                                 | Sizing token.                            |
| `color`           | `ColorRole \| ColorName`   | `undefined`                            | Text color.                              |
| `margin`          | `string`                   | `undefined`                            | Margin override.                         |
| `padding`         | `Size`                     | `undefined`                            | Padding scale.                           |
| `gap`             | `string`                   | `"md"`                                 | Gap override.                            |
| `testId`          | `string`                   | `undefined`                            | Test id.                                 |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`                               | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`                             | Font weight.                             |
| `fontSize`        | `string`                   | `undefined`                            | Font size override.                      |
| `widgetWidth`     | `string`                   | `"4"`                                  | Grid columns (3/4/6 supported).          |
| `widgetHeight`    | `string`                   | `"2"`                                  | Grid rows.                               |
| `label`           | `string`                   | `"Label"`                              | Main label.                              |
| `subText`         | `string`                   | `"subText"`                            | Sub label.                               |
| `badgeText`       | `string`                   | `"3.25%"`                              | Trailing badge text.                     |
| `badgeColor`      | `string`                   | `"success"`                            | Badge color role.                        |
| `badgeIcon`       | `string`                   | `"solid-arrow-up-right"`               | Badge icon name.                         |
| `iconLeftColor`   | `string`                   | `"gray"`                               | Left misc-icon color.                    |
| `iconLeft`        | `string`                   | `"outline-ellipsis-horizontal-circle"` | Left misc-icon name.                     |
| `imgUrl`          | `string`                   | (sample picsum URL)                    | Image URL when `showImage`.              |
| `buttonColor`     | `string`                   | `"primary"`                            | Trailing button color.                   |
| `buttonVariant`   | `string`                   | `"outline"`                            | Trailing button variant.                 |
| `buttonIcon`      | `string`                   | `"solid-arrow-right-circle"`           | Trailing button icon name.               |
| `iconRightColor`  | `string`                   | `"gray"`                               | Right misc-icon color.                   |
| `iconRight`       | `string`                   | `"outline-ellipsis-horizontal-circle"` | Right misc-icon name.                    |
| `showSubtext`     | `boolean`                  | `true`                                 | Toggle sub-text visibility.              |
| `showImage`       | `boolean`                  | `false`                                | Show image instead of icon.              |
| `showIconLeft`    | `boolean`                  | `false`                                | Show the left icon.                      |
| `showButtonIcon`  | `boolean`                  | `false`                                | Show the trailing button.                |
| `showBadge`       | `boolean`                  | `false`                                | Show the trailing badge.                 |
| `showIconRight`   | `boolean`                  | `false`                                | Show the right icon.                     |

**Events**
- `click` — `CustomEvent` — fires when the trailing button is clicked.

---

### `<ssk-widget-table>` (class `WidgetTable`)
Widget containing a title row + `<ssk-table>` + optional action button. Wires sorting and pagination into bubbling events.

**Props** *(common widget props omitted — same as `<ssk-widget-example>`; the table-specific ones are listed below)*
| Name                    | Type      | Default       | Description                                       |
|-------------------------|-----------|---------------|---------------------------------------------------|
| `widgetWidth`           | `string`  | `"8"`         | Grid columns (8 or 12).                           |
| `widgetHeight`          | `string`  | `"8"`         | Grid rows.                                        |
| `label`                 | `string`  | `""`          | Widget title.                                     |
| `description`           | `string`  | `""`          | Widget subtitle.                                  |
| `badgeText`             | `string`  | `""`          | Trailing badge label.                             |
| `badgeColor`            | `string`  | `"success"`   | Badge color role.                                 |
| `badgeIcon`             | `string`  | `""`          | Badge icon name.                                  |
| `showBadge`             | `boolean` | `false`       | Show the title-row badge.                         |
| `showDescription`       | `boolean` | `false`       | Show the description line.                        |
| `buttonColor`           | `string`  | `"primary"`   | Action button color.                              |
| `buttonVariant`         | `string`  | `"outline"`   | Action button variant.                            |
| `buttonIcon`            | `string`  | `""`          | Action button icon name.                          |
| `buttonText`            | `string`  | `""`          | Action button label.                              |
| `disabledButton`        | `boolean` | `false`       | Disable the action button.                        |
| `showButtonIcon`        | `boolean` | `false`       | Show the action button.                           |
| `tableColumns`          | `any[]`   | `[]`          | Forwarded to `<ssk-table>`.                       |
| `tableData`             | `any[]`   | `[]`          | Forwarded to `<ssk-table>`.                       |
| `totalItems`            | `number`  | `0`           | Total rows for pagination.                        |
| `currentPage`           | `number`  | `1`           | Current page.                                     |
| `rowsPerPage`           | `number`  | `10`          | Rows per page.                                    |
| `emptyImage`            | `string`  | `''`          | URL for empty-state illustration.                 |
| `maxVisiblePageButtons` | `number`  | `0`           | Cap on page-button count.                         |

**Events**
- `button-click` — `CustomEvent` — fires when the action button is clicked.
- `action-click` — `CustomEvent<{ record: any; rowIndex: any }>` — fires when an `action-icon` cell is clicked.
- `table-sort` — `CustomEvent<{ dataIndex: string; direction: "asc" \| "desc" }>` — fires on column sort.
- `load-data` — `CustomEvent<{ page: number; rowsPerPage: number }>` — fires when pagination changes.

---

### `<ssk-widget-title>` (class `WidgetTitle`)
Title-bar widget with optional trailing button or dropdown action.

**Props** *(common widget props omitted)*
| Name              | Type                                   | Default                          | Description                            |
|-------------------|----------------------------------------|----------------------------------|----------------------------------------|
| `widgetWidth`     | `string`                               | `"6"`                            | Grid columns (6/8/12).                 |
| `widgetHeight`    | `string`                               | `"1"`                            | Grid rows.                             |
| `titleText`       | `string`                               | `"title"`                        | Title text.                            |
| `subText`         | `string`                               | `"subText"`                      | Subtitle text.                         |
| `buttonText`      | `string`                               | `"buttonText"`                   | Action button label (clamped to 15 chars). |
| `buttonColor`     | `string`                               | `"primary"`                      | Action button color.                   |
| `buttonVariant`   | `string`                               | `"outline"`                      | Action button variant.                 |
| `buttonIcon`      | `string`                               | `"solid-arrow-right-circle"`     | Action button icon.                    |
| `dropdownOptions` | `DropdownItem[]`                       | `[]`                             | Options when `actionType="dropdown"`.  |
| `showSubtext`     | `boolean`                              | `true`                           | Show subtitle.                         |
| `showButtonText`  | `boolean`                              | `true`                           | Show button label.                     |
| `showButtonIcon`  | `boolean`                              | `true`                           | Show button icon.                      |
| `actionType`      | `"none" \| "button" \| "dropdown"`     | `"none"`                         | Trailing action type.                  |
| `disabledButton`  | `boolean`                              | `false`                          | Disable the action button.             |

```ts
export interface DropdownItem { label: string; value: string }
```

**Events**
- `click-button` — `CustomEvent` — fires when the action button is clicked.
- `click-dropdown` — `CustomEvent<DropdownItem>` — fires when a dropdown option is selected.

---

### `<ssk-widget-user-detail>` (class `WidgetUserDetail`)
User profile widget — avatar, label/sub-text, plus a vertical list of small action rows.

**Props** *(common widget props omitted)*
| Name                   | Type                | Default                          | Description                              |
|------------------------|---------------------|----------------------------------|------------------------------------------|
| `widgetWidth`          | `string`            | `"4"`                            | Grid columns.                            |
| `widgetHeight`         | `string`            | `"3"`                            | Grid rows (3/4/6).                       |
| `label`                | `string`            | `""`                             | Title.                                   |
| `subText`              | `string`            | `""`                             | Subtitle.                                |
| `buttonColor`          | `string`            | `"primary"`                      | Main action button color.                |
| `buttonVariant`        | `string`            | `"ghost"`                        | Main action button variant.              |
| `buttonIcon`           | `string`            | `"solid-arrow-right-circle"`     | Main action button icon.                 |
| `buttonText`           | `string`            | `""`                             | Main action button label.                |
| `imgUrl`               | `string`            | `""`                             | Avatar image URL.                        |
| `imageShape`           | `string`            | `"circle"`                       | Avatar shape.                            |
| `showSubtext`          | `boolean`           | `true`                           | Show subtitle.                           |
| `showImage`            | `boolean`           | `false`                          | Show avatar.                             |
| `showButtonIcon`       | `boolean`           | `true`                           | Show the main action button.             |
| `showButtonTooltip`    | `boolean`           | `false`                          | Wrap button in a tooltip.                |
| `buttonTooltipText`    | `string`            | `'More details'`                 | Tooltip text.                            |
| `disabledButton`       | `boolean`           | `false`                          | Disable the action button.               |
| `rowItems`             | `sectionItem[]`     | `[]`                             | Small row items rendered below.          |

```ts
export interface sectionItem {
  id: string | number;
  label: string;
  description: string;
  showButton?: boolean;
  buttonIcon?: string;
  buttonColor?: string;
  showTooltip?: boolean;
  tooltipText?: string;
  disabledButton?: boolean;
}
```

**Events**
- `click-button` — `CustomEvent` — fires when the main action button is clicked.
- `click-row-icon` — `CustomEvent<{ item: sectionItem }>` — fires when a row's action icon is clicked.

---

## 3. Components (composed widgets)

Higher-level UI that composes §2 elements and may own a small state machine.

### 3.1 Overlay

### `<ssk-modal>` (class `Modal`)
Centered modal dialog with backdrop and optional close button. Requires `<ssk-toast-provider>` only if consumer toasts are dispatched from inside.

**Props**
| Name              | Type      | Default     | Description                              |
|-------------------|-----------|-------------|------------------------------------------|
| `testId`          | `string`  | `undefined` | Test id.                                 |
| `width`           | `string`  | `undefined` | Modal width (default 100%).              |
| `show`            | `boolean` | `false`     | Visibility.                              |
| `hideCloseButton` | `boolean` | `false`     | Hide the X close button.                 |
| `hideDivider`     | `boolean` | `true`      | Hide the header/footer dividers.         |

**Events**
- `close` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires when X is clicked.

**Slots**
- `header` — modal header content.
- `body` — modal body content.
- `footer` — modal footer (typically action buttons).

---

### `<ssk-drawer>` (class `Drawer`)
Side drawer that slides in from `left` or `right`. Clicking the backdrop closes it.

**Props**
| Name            | Type                 | Default   | Description                              |
|-----------------|----------------------|-----------|------------------------------------------|
| `testId`        | `string`             | `undefined`| Test id.                                |
| `width`         | `string`             | `"480px"` | Drawer width.                            |
| `headerPadding` | `string`             | `"24px"`  | Header padding.                          |
| `bodyPadding`   | `string`             | `"24px"`  | Body padding.                            |
| `side`          | `"left" \| "right"`  | `"left"`  | Slide-in direction.                      |
| `show`          | `boolean`            | `false`   | Visibility.                              |
| `hideDivider`   | `boolean`            | `false`   | Hide the divider between header/body.    |

**Events**
- `close` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched) — fires when the backdrop is clicked.

**Slots**
- `header` — drawer header.
- `body` — drawer body content.
- `footer` — drawer footer (actions).

---

### `<ssk-drawer-header>` (class `DrawerHeader`)
Pre-built header to drop into `<ssk-drawer slot="header">` — renders title, description, optional actions, and a close button.

**Props**
| Name              | Type      | Default | Description                              |
|-------------------|-----------|---------|------------------------------------------|
| `title`           | `string`  | `""`    | Header title.                            |
| `description`     | `string`  | `""`    | Sub-description under the title.         |
| `hideCloseButton` | `boolean` | `false` | Hide the X close icon.                   |

**Events**
- `close` — `CustomEvent` — fires when the close icon is clicked.

**Slots**
- default — action buttons placed between the title and the close icon.

---

### `<ssk-tooltip>` (class `Tooltip`)
Floating tooltip with hover or click trigger, 12 placement options, and an arrow.

**Props**
| Name              | Type                       | Default          | Description                              |
|-------------------|----------------------------|------------------|------------------------------------------|
| `testId`          | `string`                   | `undefined`      | Test id.                                 |
| `size`            | `Size`                     | `"md"`           | Sizing token.                            |
| `themeColor`      | `string`                   | `"primary"`      | Tooltip background color role.           |
| `color`           | `ColorRole \| ColorName`   | `"white"`        | Tooltip text color.                      |
| `hidden`          | `boolean`                  | `false`          | Skip rendering.                          |
| `placement`       | `Placement`                | `"top"`          | One of 12 placement options.             |
| `hideArrow`       | `boolean`                  | `false`          | Hide the pointer arrow.                  |
| `hideCloseButton` | `boolean`                  | `false`          | Hide the close X (click trigger only).   |
| `trigger`         | `Trigger`                  | `"hover"`        | `"hover"` or `"click"`.                  |
| `label`           | `string`                   | `""`             | Static text content (alternative to slot).|
| `areaPosition`    | `string`                   | `"100%"`         | Anchor area sizing.                      |
| `maxWidth`        | `string`                   | `"max-content"`  | Tooltip max width.                       |

```ts
export type Placement =
  | "top" | "bottom" | "left" | "right"
  | "topleft" | "topright" | "bottomleft" | "bottomright"
  | "lefttop" | "leftbottom" | "righttop" | "rightbottom";
export type Trigger = "hover" | "click";
```

**Slots**
- default — the anchor element the tooltip attaches to.
- `content` — the tooltip's content.

---

### 3.2 Data display

### `<ssk-table>` / `<ssk-table-row>` / `<ssk-table-cell>` / `<ssk-header-cell>` (table family)

#### `<ssk-table>` (class `Table`)
High-level table built from `columns` + `data` props. Supports sorting, server- or client-side pagination, row selection, and a `customCell` map for cell renderers.

**Props**
| Name                    | Type                              | Default     | Description                                       |
|-------------------------|-----------------------------------|-------------|---------------------------------------------------|
| `testId`                | `string`                          | `undefined` | Test id.                                          |
| `themeColor`            | `ColorRole \| ColorName`          | `"primary"` | Accent color.                                     |
| `color`                 | `ColorRole \| ColorName`          | `undefined` | Text color.                                       |
| `backgroundColor`       | `string`                          | `undefined` | Background override.                              |
| `size`                  | `Size`                            | `"md"`      | Sizing token.                                     |
| `padding`               | `Size`                            | `undefined` | Padding scale.                                    |
| `fontSize`              | `string`                          | `undefined` | Font size override.                               |
| `gap`                   | `string`                          | `undefined` | Gap override.                                     |
| `rounded`               | `string`                          | `undefined` | Border radius.                                    |
| `margin`                | `string`                          | `undefined` | Margin override.                                  |
| `fontFamilyGroup`       | `FontFamilyGroup`                 | `"sans"`    | Font family group.                                |
| `fontWeight`            | `FontWeight`                      | `"normal"`  | Font weight.                                      |
| `borderWidth`           | `string`                          | `undefined` | Border width override.                            |
| `height`                | `string`                          | `undefined` | Table viewport height.                            |
| `columns`               | `Column[]`                        | `[]`        | Column definitions (title, dataIndex, sortable…). |
| `data`                  | `RowData[]`                       | `[]`        | Row data.                                         |
| `showPaginationFooter`  | `boolean`                         | `false`     | Show the pagination footer.                       |
| `selectedRows`          | `number[]`                        | `[]`        | Indices of selected rows.                         |
| `showCheckbox`          | `boolean`                         | `false`     | Show row-select checkboxes.                       |
| `selectAll`             | `boolean`                         | `false`     | Header "select all" state.                        |
| `rowsPerPage`           | `number`                          | `10`        | Rows per page.                                    |
| `currentPage`           | `number`                          | `1`         | Current page.                                     |
| `showPageNavigation`    | `boolean`                         | `false`     | Show prev/next page buttons.                      |
| `showRowsPerPageSelector` | `boolean`                       | `false`     | Show the rows-per-page dropdown.                  |
| `showPageButtons`       | `boolean`                         | `false`     | Show numbered page buttons.                       |
| `showGoToPageInput`     | `boolean`                         | `false`     | Show the "go to page" input.                      |
| `totalPaginationPages`  | `number`                          | `0`         | Server-side total (use `data.length` if 0).       |
| `maxVisiblePageButtons` | `number`                          | `0`         | Cap on number of page buttons.                    |
| `min`                   | `boolean`                         | `false`     | Compact pagination footer.                        |
| `customCell`            | `Record<string, CellRenderer>`    | `{}`        | Per-column render/onClick/onChange overrides.     |

```ts
interface Column {
  title: string;
  dataIndex?: string;
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  sortDirection?: "asc" | "desc";
  onSort?: (direction: "asc" | "desc") => void;
  sortIcons?: { asc: string; desc: string; neutral: string; color: string };
}

type CellRenderer = {
  render: (value: any, record: any, rowIndex: number) => string;
  onClick?: (value: any, record: any, rowIndex: number) => void;
  onChange?: (value: any, record: any, rowIndex: number) => void;
};
```

**Events**
- `load-data` — `CustomEvent<{ page: number; rowsPerPage: number }>` — fires when page or page-size changes.
- `cell-click` — `CustomEvent<{ cellValue: any; row: any; rowIndex: number }>` — fires when a custom cell with `onClick` is clicked.
- `cell-change` — `CustomEvent<{ newValue: any; row: any; rowIndex: number }>` — fires when a custom cell input changes.

**Slots**
- `empty-content` — replaces the default empty state when `data` is empty.

#### `<ssk-dynamic-table>` (class `DynamicTable`)
Lower-level grid-based table for fully custom layouts — provides a `dynamicTableContext` to child `<ssk-table-row>`/`<ssk-table-cell>`/`<ssk-header-cell>`. Use when `<ssk-table>` is too opinionated.

**Props**
| Name                      | Type        | Default     | Description                                       |
|---------------------------|-------------|-------------|---------------------------------------------------|
| `testId`                  | `string`    | `undefined` | Test id.                                          |
| `hidden`                  | `boolean`   | `false`     | Skip rendering.                                   |
| `height`                  | `string`    | `undefined` | Table viewport height.                            |
| `columnsWidth`            | `string[]`  | `undefined` | Per-column CSS widths (auto-calculates if absent).|
| `backgroundColor`         | `string`    | `undefined` | Row background color.                             |
| `stripedBackgroundColor`  | `string`    | `undefined` | Striped row background color.                     |

**Events**
- `scrollend` — `CustomEvent` (bubbles) — fires when the scrollable region is fully scrolled to the bottom.

**Slots**
- `headers` — header-cell row.
- default — `<ssk-table-row>` / `<ssk-table-cell>` children.
- `placeholder` — empty-state content.
- `footer` — footer area.

#### `<ssk-header-cell>` (class `HeaderCell`)
Header cell used inside `<ssk-dynamic-table>`. Supports sort-icon toggle.

**Props**
| Name            | Type                              | Default    | Description                              |
|-----------------|-----------------------------------|------------|------------------------------------------|
| `align`         | `"left" \| "center" \| "right"`   | `"center"` | Horizontal alignment.                    |
| `sortable`      | `boolean`                         | `false`    | Show the sort icon.                      |
| `sortDirection` | `"asc" \| "desc"`                 | `undefined`| Current sort direction.                  |

**Events**
- `sort-changed` — `CustomEvent<{ sortDirection: "asc" \| "desc" }>` — fires when the sort icon is clicked.

**Slots**
- default — column title.

#### `<ssk-table-row>` (class `TableRow`)
Row wrapper inside `<ssk-dynamic-table>`. The `expanded` attribute hides the row when explicitly `"false"`.

**Props**
| Name           | Type      | Default     | Description                              |
|----------------|-----------|-------------|------------------------------------------|
| `padding`      | `Size`    | `undefined` | Padding scale.                           |
| `borderBottom` | `string`  | `undefined` | Bottom-border CSS.                       |
| `expanded`     | `boolean` | `undefined` | Reflect as attribute; `false` hides row. |

**Slots**
- default — `<ssk-table-cell>` children.

#### `<ssk-table-cell>` (class `TableCell`)
Single cell inside `<ssk-table-row>`.

**Props**
| Name    | Type                              | Default    | Description                  |
|---------|-----------------------------------|------------|------------------------------|
| `align` | `"left" \| "center" \| "right"`   | `"center"` | Horizontal alignment.        |

**Slots**
- default — cell content.

---

### `<ssk-pagination>` (class `Pagination`)
Standalone pagination control. Used internally by `<ssk-table>` but can be mounted directly above/below a custom list.

**Props**
| Name              | Type                       | Default                | Description                              |
|-------------------|----------------------------|------------------------|------------------------------------------|
| `testId`          | `string`                   | `undefined`            | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"`            | Active page color.                       |
| `color`           | `string`                   | `"white"`              | Active page text color.                  |
| `backgroundColor` | `string`                   | `undefined`            | Background override.                     |
| `size`            | `Size`                     | `"sm"`                 | Button sizing.                           |
| `padding`         | `Size`                     | `undefined`            | Padding scale.                           |
| `fontSize`        | `string`                   | `undefined`            | Font size override.                      |
| `gap`             | `string`                   | `undefined`            | Gap between controls.                    |
| `rounded`         | `string`                   | `undefined`            | Border radius.                           |
| `margin`          | `string`                   | `undefined`            | Margin override.                         |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`               | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `"normal"`             | Font weight.                             |
| `borderWidth`     | `string`                   | `undefined`            | Border width override.                   |
| `height`          | `string`                   | `undefined`            | Height override.                         |
| `currentPage`     | `number`                   | `1`                    | Active page.                             |
| `totalPages`      | `number`                   | `1`                    | Total page count.                        |
| `rowsPerPage`     | `number`                   | `10`                   | Rows-per-page selector value.            |
| `startItems`      | `number`                   | `1`                    | First item index on current page.        |
| `endItems`        | `number`                   | `10`                   | Last item index on current page.         |
| `allItems`        | `number`                   | `100`                  | Total item count.                        |
| `selectedItems`   | `number[]`                 | `[10, 20, 50, 100]`    | Rows-per-page options.                   |
| `showRowsPage`    | `boolean`                  | `false`                | Show "X of Y" rows label.                |
| `showRowsPerPage` | `boolean`                  | `false`                | Show rows-per-page dropdown.             |
| `showGoToPage`    | `boolean`                  | `false`                | Show go-to-page input.                   |
| `showBtnPage`     | `boolean`                  | `false`                | Show numbered page buttons.              |
| `min`             | `boolean`                  | `false`                | Compact layout.                          |
| `fullWidth`       | `boolean`                  | `false`                | Stretch to full width.                   |
| `dropdownAnchor`  | `"top" \| "bottom"`        | `"bottom"`             | Rows-per-page dropdown anchor.           |

**Events**
- `page-changed` — `CustomEvent<{ page: number }>` — fires when the page changes.
- `rows-per-page-changed` — `CustomEvent<{ rowsPerPage: number }>` — fires when rows-per-page changes.

---

### `<ssk-timeline>` (class `Timeline`)
Vertical or horizontal timeline driven by an `Items` array with status colors.

**Props**
| Name              | Type                              | Default       | Description                              |
|-------------------|-----------------------------------|---------------|------------------------------------------|
| `testId`          | `string`                          | `undefined`   | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`          | `"primary"`   | Accent color.                            |
| `color`           | `ColorRole \| ColorName`          | `undefined`   | Text color.                              |
| `backgroundColor` | `string`                          | `undefined`   | Background override.                     |
| `size`            | `Size`                            | `"md"`        | Sizing token.                            |
| `padding`         | `Size`                            | `undefined`   | Padding scale.                           |
| `fontSize`        | `string`                          | `undefined`   | Font size override.                      |
| `gap`             | `string`                          | `undefined`   | Gap override.                            |
| `rounded`         | `string`                          | `undefined`   | Border radius.                           |
| `margin`          | `string`                          | `undefined`   | Margin override.                         |
| `fontFamilyGroup` | `FontFamilyGroup`                 | `"sans"`      | Font family group.                       |
| `fontWeight`      | `FontWeight`                      | `"normal"`    | Font weight.                             |
| `Items`           | `TimelineItem[]`                  | `[]`          | Timeline entries.                        |
| `hidden`          | `boolean`                         | `false`       | Skip rendering.                          |
| `display`         | `"vertical" \| "horizontal"`      | `"vertical"`  | Layout direction.                        |

```ts
export interface TimelineItem {
  title: string;
  description: string;
  subTitle: string;
  status: "completed" | "in-progress" | "pending";
}
```

---

### `<ssk-stepper>` (class `Stepper`)
Multi-step progress indicator with circular progress around each step.

**Props**
| Name              | Type                              | Default     | Description                              |
|-------------------|-----------------------------------|-------------|------------------------------------------|
| `testId`          | `string`                          | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`          | `"primary"` | Accent color.                            |
| `color`           | `ColorRole \| ColorName`          | `undefined` | Text color.                              |
| `backgroundColor` | `string`                          | `undefined` | Background override.                     |
| `size`            | `Size`                            | `"md"`      | Sizing token.                            |
| `padding`         | `Size`                            | `undefined` | Padding scale.                           |
| `fontSize`        | `string`                          | `undefined` | Font size override.                      |
| `gap`             | `string`                          | `undefined` | Gap override.                            |
| `rounded`         | `string`                          | `undefined` | Border radius.                           |
| `margin`          | `string`                          | `undefined` | Margin override.                         |
| `fontFamilyGroup` | `FontFamilyGroup`                 | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`                      | `"normal"`  | Font weight.                             |
| `steps`           | `Step[]`                          | `[]`        | Step definitions.                        |
| `currentStep`     | `number`                          | `0`         | Index of the active step.                |
| `activeIndex`     | `number`                          | `0`         | Highlighted step (alias).                |
| `errorStep`       | `string`                          | `"error"`   | Value used to mark a step as errored.    |
| `hidden`          | `boolean`                         | `false`     | Skip rendering.                          |
| `percent`         | `number`                          | `undefined` | Override the progress percent.           |

```ts
interface Step {
  title: string;
  description: string;
  status: "finish" | "process" | "wait" | "error";
  progress?: number;
  icon?: string;
}
```

---

### 3.3 Pickers

### `<ssk-dropdown>` (dropdown family)

#### `<ssk-dropdown>` (class `Dropdown`)
Dropdown / select component. Provides a `valueContext` to `<ssk-dropdown-button>` / `<ssk-dropdown-option>` / `<ssk-dropdown-preview>` children.

**Props**
| Name                  | Type                                       | Default     | Description                                       |
|-----------------------|--------------------------------------------|-------------|---------------------------------------------------|
| `testId`              | `string`                                   | `undefined` | Test id.                                          |
| `themeColor`          | `ColorRole \| ColorName`                   | `"info"`    | Accent color.                                     |
| `size`                | `Size`                                     | `"md"`      | Sizing token.                                     |
| `fontFamilyGroup`     | `FontFamilyGroup`                          | `"sans"`    | Font family group.                                |
| `fontWeight`          | `FontWeight`                               | `undefined` | Font weight.                                      |
| `width`               | `string`                                   | `undefined` | Width override.                                   |
| `label`               | `string`                                   | `undefined` | Top label.                                        |
| `helperText`          | `string`                                   | `undefined` | Helper text.                                      |
| `name`                | `string`                                   | `undefined` | Native name (for forms).                          |
| `value`               | `string \| string[]`                       | `""`        | Selected value (array when `multiSelect`).        |
| `status`              | `"error" \| "success" \| undefined`        | `undefined` | Status decoration.                                |
| `disabled`            | `boolean`                                  | `false`     | Disabled state.                                   |
| `hidden`              | `boolean`                                  | `false`     | Skip rendering.                                   |
| `error`               | `boolean`                                  | `false`     | Force error styling.                              |
| `success`             | `boolean`                                  | `false`     | Force success styling.                            |
| `loading`             | `boolean`                                  | `false`     | Show loading spinner.                             |
| `search`              | `boolean`                                  | `false`     | Enable inline search.                             |
| `optionsAnchor`       | `"top" \| "bottom" \| "left" \| "right"`   | `"bottom"`  | Where to anchor the options panel.                |
| `optionsAlign`        | `"left" \| "right"`                        | `"right"`   | Alignment of options panel.                       |
| `optionsWidth`        | `"auto" \| "fit"`                          | `"fit"`     | Width matching strategy.                          |
| `required`            | `boolean`                                  | `false`     | Append red `*` to label.                          |
| `maxOptionsHeight`    | `number`                                   | `248`       | Max scroll height of options.                     |
| `multiSelect`         | `boolean`                                  | `false`     | Allow multi-select.                               |
| `isSelected`          | `string[]`                                 | `[]`        | Externally provided selection (multi).            |
| `clearValue`          | `boolean`                                  | `false`     | Reflect-attribute clear trigger.                  |
| `allowUnselect`       | `boolean`                                  | `false`     | Allow toggling off the current selection.         |
| `hideCheckIcon`       | `boolean`                                  | `false`     | Hide the check icon on selected options.          |
| `hideErrorIcon`       | `boolean`                                  | `false`     | Hide the error icon.                              |
| `hideSuccessIcon`     | `boolean`                                  | `false`     | Hide the success icon.                            |

**Events**
- `change` — `CustomEvent<string | string[]>` — fires with the new value (string for single-select, array for multi-select).

**Slots**
- `selected` — anchor button (use `<ssk-dropdown-button>` with `<ssk-dropdown-preview>` inside).
- default — `<ssk-dropdown-option>` children.

#### `<ssk-dropdown-button>` (class `DropdownButton`)
Default button used as the `slot="selected"` anchor for `<ssk-dropdown>`. Renders the current preview plus state icons (check/error/chevron).

**Props**
| Name           | Type      | Default     | Description                              |
|----------------|-----------|-------------|------------------------------------------|
| `testId`       | `string`  | `undefined` | Test id.                                 |
| `size`         | `Size`    | `"md"`      | Sizing token (inherits from dropdown).   |
| `hideChevron`  | `boolean` | `false`     | Hide the trailing chevron.               |

**Slots**
- default — preview content (typically `<ssk-dropdown-preview>`).

#### `<ssk-dropdown-option>` (class `DropdownOption`)
Single option inside `<ssk-dropdown>`. Clicking it calls `state.setValue` on the dropdown context.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `testId`          | `string`                   | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"` | Accent.                                  |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `size`            | `Size`                     | `"md"`      | Sizing token.                            |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `undefined` | Font weight.                             |
| `value`           | `string`                   | `""`        | The value this option represents.        |
| `disabled`        | `boolean`                  | `false`     | Disabled state (reflects to attribute).  |

**Events**
- `click` — `MouseEvent` (re-dispatched) — fires on click.

**Slots**
- default — option label.
- `prefix` — leading icon.
- `postfix` — trailing icon (default: check on selected).

#### `<ssk-dropdown-preview>` (class `DropdownPreview`)
Displays the current selection inside `<ssk-dropdown-button>`.

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `testId`          | `string`                   | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"` | Accent.                                  |
| `color`           | `ColorRole \| ColorName`   | `undefined` | Text color.                              |
| `size`            | `Size`                     | `"md"`      | Sizing token (reflects to attribute).    |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`               | `undefined` | Font weight.                             |
| `value`           | `string`                   | `""`        | The displayed value.                     |
| `disabled`        | `boolean`                  | `false`     | Disabled state.                          |

**Slots**
- default — preview content.
- `prefix` — leading icon.
- `postfix` — trailing icon.

---

### `<ssk-date-picker>` (class `DatePicker`)
Single-date picker with optional time selection. Localized to `th` (Buddhist era), `en`, or `fr`. Pair with `<ssk-i18n-provider>` for consistent locale.

**Props**
| Name             | Type                                          | Default        | Description                              |
|------------------|-----------------------------------------------|----------------|------------------------------------------|
| `themeColor`     | `ColorRole \| ColorName`                      | `"primary"`    | Accent.                                  |
| `color`          | `ColorRole \| ColorName`                      | `undefined`    | Text color.                              |
| `testId`         | `string`                                      | `undefined`    | Test id.                                 |
| `size`           | `Size`                                        | `"md"`         | Sizing token.                            |
| `label`          | `string`                                      | `undefined`    | Field label.                             |
| `placeholder`    | `string`                                      | `undefined`    | Placeholder.                             |
| `helperText`     | `string`                                      | `undefined`    | Helper text.                             |
| `error`          | `boolean`                                     | `false`        | Force error styling.                     |
| `name`           | `string`                                      | `undefined`    | Native name attribute.                   |
| `hidden`         | `boolean`                                     | `false`        | Skip rendering.                          |
| `value`          | `Date`                                        | `undefined`    | Selected date.                           |
| `rangeDate`      | `boolean`                                     | `false`        | (Use `<ssk-range-date-picker>` instead.) |
| `format`         | `string`                                      | `"dd/MM/yyyy"` | `date-fns` format string.                |
| `displayGoToday` | `boolean`                                     | `false`        | Show "today" shortcut in footer.         |
| `displayOk`      | `boolean`                                     | `false`        | Show OK button in footer.                |
| `showTime`       | `boolean`                                     | `false`        | Include time picker.                     |
| `timeFormat`     | `"hms" \| "hm" \| "timeEvery30"`              | `"hms"`        | Time precision.                          |
| `locale`         | `"en" \| "fr" \| "th"`                        | `"th"`         | Locale.                                  |
| `alignCalendar`  | `"left" \| "right"`                           | `"left"`       | Popup alignment.                         |
| `widthCalendar`  | `string`                                      | `"fit-content"`| Popup width.                             |
| `disabledDate`   | `(date: number) => boolean`                   | `undefined`    | Disable arbitrary dates.                 |
| `disabledYears`  | `number[]`                                    | `undefined`    | Disable specific years.                  |
| `minYear`        | `number`                                      | `undefined`    | Min selectable year.                     |
| `maxYear`        | `number`                                      | `undefined`    | Max selectable year.                     |

**Events**
- `change` — `CustomEvent<{ valueFrom: Date | undefined }>` — fires when the selected date or time changes.

**Slots**
- `footer` — replace the default calendar footer.

---

### `<ssk-range-date-picker>` (class `RangeDatePicker`)
Two-date range picker. Same locale/formatting options as `<ssk-date-picker>`.

**Props**
| Name              | Type                                          | Default        | Description                              |
|-------------------|-----------------------------------------------|----------------|------------------------------------------|
| `themeColor`      | `ColorRole \| ColorName`                      | `"primary"`    | Accent.                                  |
| `color`           | `ColorRole \| ColorName`                      | `undefined`    | Text color.                              |
| `testId`          | `string`                                      | `undefined`    | Test id.                                 |
| `size`            | `Size`                                        | `"md"`         | Sizing token.                            |
| `label`           | `string`                                      | `undefined`    | Field label.                             |
| `placeholderFrom` | `string`                                      | `undefined`    | "From" placeholder.                      |
| `placeholderTo`   | `string`                                      | `undefined`    | "To" placeholder.                        |
| `helperText`      | `string`                                      | `undefined`    | Helper text.                             |
| `error`           | `boolean`                                     | `false`        | Force error styling.                     |
| `name`            | `string`                                      | `undefined`    | Native name attribute.                   |
| `hidden`          | `boolean`                                     | `false`        | Skip rendering.                          |
| `valueFrom`       | `Date`                                        | `undefined`    | Start of range.                          |
| `valueTo`         | `Date`                                        | `undefined`    | End of range.                            |
| `format`          | `string`                                      | `"dd/MM/yyyy"` | `date-fns` format string.                |
| `displayGoToday`  | `boolean`                                     | `false`        | Show "today" shortcut.                   |
| `displayOk`       | `boolean`                                     | `false`        | Show OK button.                          |
| `showTime`        | `boolean`                                     | `false`        | Include time picker.                     |
| `timeFormat`      | `"hms" \| "hm" \| "timeEvery30"`              | `"hms"`        | Time precision.                          |
| `locale`          | `"en" \| "fr" \| "th"`                        | `"th"`         | Locale.                                  |
| `alignCalendar`   | `"left" \| "right"`                           | `"left"`       | Popup alignment.                         |
| `widthCalendar`   | `string`                                      | `"fit-content"`| Popup width.                             |
| `disabledDate`    | `(date: number) => boolean`                   | `undefined`    | Disable arbitrary dates.                 |
| `disabledYears`   | `number[]`                                    | `undefined`    | Disable specific years.                  |
| `minYear`         | `number`                                      | `undefined`    | Min selectable year.                     |
| `maxYear`         | `number`                                      | `undefined`    | Max selectable year.                     |

**Events**
- `change` — `CustomEvent<{ valueFrom: Date | undefined; valueTo: Date | undefined }>` — fires when the range or time changes.

**Slots**
- `footer` — replace the default calendar footer.

---

### `<ssk-calendar>` (class `Calendar`)
Lower-level calendar grid used by both date pickers. You can mount it directly when you need a fully inline picker.

**Props**
| Name                  | Type                                            | Default     | Description                              |
|-----------------------|-------------------------------------------------|-------------|------------------------------------------|
| `testId`              | `string`                                        | `undefined` | Test id.                                 |
| `themeColor`          | `ColorRole \| ColorName`                        | `"primary"` | Accent.                                  |
| `color`               | `string`                                        | `"white"`   | Selected-day text color.                 |
| `backgroundColor`     | `string`                                        | `undefined` | Background override.                     |
| `size`                | `Size`                                          | `"md"`      | Sizing token.                            |
| `padding`             | `Size`                                          | `undefined` | Padding scale.                           |
| `rounded`             | `string`                                        | `undefined` | Border radius.                           |
| `month`               | `string`                                        | `""`        | Currently displayed month.               |
| `year`                | `string`                                        | `""`        | Currently displayed year.                |
| `locale`              | `"en" \| "fr" \| "th"`                          | `"th"`      | Locale.                                  |
| `todayText`           | `string`                                        | `"ตอนนี้"`  | Label for the "today" button.            |
| `okText`              | `string`                                        | `"ตกลง"`    | Label for the OK button.                 |
| `footerStyle`         | `"between" \| "middle" \| "right"`              | `"between"` | Footer layout.                           |
| `rangeDate`           | `boolean`                                       | `false`     | Range mode.                              |
| `disableYearChange`   | `boolean`                                       | `false`     | Disable year switcher.                   |
| `disableMonthChange`  | `boolean`                                       | `false`     | Disable month switcher.                  |
| `displayGoToday`      | `boolean`                                       | `false`     | Show "today" shortcut.                   |
| `displayOk`           | `boolean`                                       | `false`     | Show OK button.                          |
| `disabledPrev`        | `boolean`                                       | `false`     | Disable prev arrow.                      |
| `disabledNext`        | `boolean`                                       | `false`     | Disable next arrow.                      |
| `dateTo`              | `number`                                        | `undefined` | End-of-range timestamp.                  |
| `dateFrom`            | `number`                                        | `undefined` | Start-of-range timestamp.                |

**Events**
- `date-changed` — `CustomEvent<{ dateFrom: number | undefined, dateTo: number | undefined }>` — fires when a day is clicked (timestamps in ms).
- `hovered-date-changed` — `CustomEvent<{ value: number | undefined }>` — fires when hovering a day in range mode.
- `time-updated` — `CustomEvent<{ timeFrom: number, timeTo: number, dateFrom: number, dateTo: number }>` — fires when the embedded time picker updates.
- `next-year` — `CustomEvent<{ value: string }>` — fires when year increments.
- `next-month` — `CustomEvent<{ value: string }>` — fires when month increments.
- `prev-year` — `CustomEvent<{ value: string }>` — fires when year decrements.
- `prev-month` — `CustomEvent<{ value: string }>` — fires when month decrements.

**Slots**
- `footer` — replace the default footer.

---

### `<ssk-cell>` (class `Cell`)
Single day cell inside `<ssk-calendar>`. Rarely used directly.

**Props**
| Name            | Type                       | Default     | Description                              |
|-----------------|----------------------------|-------------|------------------------------------------|
| `testId`        | `string`                   | `undefined` | Test id.                                 |
| `size`          | `Size`                     | `"sm"`      | Sizing token.                            |
| `themeColor`    | `ColorRole \| ColorName`   | `"primary"` | Accent.                                  |
| `day`           | `{ title: number; date: number }` | `undefined` | Day descriptor.                  |
| `selected`      | `boolean`                  | `false`     | Selected state.                          |
| `hovered`       | `boolean`                  | `false`     | Hover (range preview) state.             |
| `disabled`      | `boolean`                  | `false`     | Disabled state.                          |
| `isCurrentDate` | `boolean`                  | `false`     | Highlights "today".                      |
| `dateTo`        | `number`                   | `undefined` | End-of-range timestamp.                  |
| `dateFrom`      | `number`                   | `undefined` | Start-of-range timestamp.                |
| `hoveredDate`   | `number`                   | `undefined` | Currently hovered date.                  |
| `month`         | `string`                   | `undefined` | Owning month (for cross-month logic).    |

**Events**
- `date-is-selected` — `CustomEvent<{ date: number }>` — fires on tap (unless disabled).

---

### `<ssk-time>` (class `Time`)
Time picker (hour / minute / second columns). Used inside the calendar when `showTime` is true; can be mounted standalone.

**Props**
| Name              | Type                                              | Default     | Description                              |
|-------------------|---------------------------------------------------|-------------|------------------------------------------|
| `testId`          | `string`                                          | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`                          | `"primary"` | Accent.                                  |
| `color`           | `string`                                          | `"white"`   | Selected-cell text color.                |
| `backgroundColor` | `string`                                          | `undefined` | Background override.                     |
| `size`            | `Size`                                            | `"md"`      | Sizing token.                            |
| `padding`         | `Size`                                            | `undefined` | Padding scale.                           |
| `rounded`         | `string`                                          | `undefined` | Border radius.                           |
| `locale`          | `"en" \| "fr" \| "th"`                            | `"th"`      | Locale (drives timezone).                |
| `nowText`         | `string`                                          | `"ตอนนี้"`  | "Now" button label.                      |
| `okText`          | `string`                                          | `"ตกลง"`    | OK button label.                         |
| `footerStyle`     | `"between" \| "middle" \| "right" \| "left"`      | `"between"` | Footer layout.                           |
| `displayGoNow`    | `boolean`                                         | `false`     | Show "now" shortcut.                     |
| `displayOk`       | `boolean`                                         | `false`     | Show OK button.                          |
| `value`           | `number`                                          | `undefined` | Timestamp value.                         |
| `hidden`          | `boolean`                                         | `false`     | Skip rendering.                          |
| `maxHeight`       | `string`                                          | `"320px"`   | Column max height.                       |
| `format`          | `"hms" \| "hm" \| "timeEvery30"`                  | `"hms"`     | Time precision.                          |

**Events**
- `time-changed` — `CustomEvent<{ value: number }>` — fires when any unit is selected (`value` is a Unix timestamp in ms for the selected H/M/S, zoned to `locale`).

---

### `<ssk-addon-phone-country>` (class `AddonPhoneCountry`)
Country selector for phone-input prefixes. Built on `<ssk-dropdown>` and the generated country list.

**Props**
| Name               | Type                                                                       | Default               | Description                              |
|--------------------|----------------------------------------------------------------------------|-----------------------|------------------------------------------|
| `testId`           | `string`                                                                   | `undefined`           | Test id.                                 |
| `size`             | `Size`                                                                     | `"md"`                | Sizing token.                            |
| `disabled`         | `boolean`                                                                  | `false`               | Disabled state.                          |
| `countries`        | `{ code: string; name?: string; phoneCode?: string }[]`                    | `[]`                  | Full country list (generated).           |
| `allowedCountries` | `string[]`                                                                 | `[]`                  | Restrict selectable countries by code.   |
| `value`            | `string`                                                                   | `""`                  | Selected country code.                   |
| `placeholder`      | `string`                                                                   | `"Select a country"`  | Placeholder.                             |

**Events**
- `change` — `CustomEvent<{ value: string; country: { code: string; name?: string; phoneCode?: string } }>` — fires when a country is picked.

---

### 3.4 Layout

### `<ssk-tabs>` (class `Tabs`)
Renders a single labels array + an active-index based tabset. For full control over per-tab content, prefer `<ssk-tab-header>` + `<ssk-tab-button>`.

**Props**
| Name              | Type                              | Default     | Description                              |
|-------------------|-----------------------------------|-------------|------------------------------------------|
| `activeIndex`     | `number`                          | `0`         | Index of the active tab.                 |
| `testId`          | `string`                          | `undefined` | Test id.                                 |
| `themeColor`      | `ColorRole \| ColorName`          | `"primary"` | Accent color.                            |
| `color`           | `ColorRole \| ColorName`          | `undefined` | Text color.                              |
| `backgroundColor` | `string`                          | `undefined` | Background override.                     |
| `size`            | `Size`                            | `"md"`      | Sizing token.                            |
| `padding`         | `Size`                            | `undefined` | Padding scale.                           |
| `fontSize`        | `string`                          | `undefined` | Font size override.                      |
| `gap`             | `string`                          | `undefined` | Gap override.                            |
| `rounded`         | `string`                          | `undefined` | Border radius.                           |
| `margin`          | `string`                          | `undefined` | Margin override.                         |
| `fontFamilyGroup` | `FontFamilyGroup`                 | `"sans"`    | Font family group.                       |
| `fontWeight`      | `FontWeight`                      | `"normal"`  | Font weight.                             |
| `borderWidth`     | `string`                          | `undefined` | Border width override.                   |
| `height`          | `string`                          | `undefined` | Height override.                         |
| `labels`          | `string[]`                        | `[]`        | Tab labels.                              |
| `variant`         | `TabVariants`                     | `"inline"`  | `"inline" \| "button"`.                  |
| `widthTab`        | `TabWidth`                        | `"false"`   | `"true"` for full-width tabs.            |
| `tabSize`         | `TabSize`                         | `"md"`      | `"sm" \| "md"`.                          |
| `min`             | `boolean`                         | `false`     | Compact layout.                          |
| `fullWidth`       | `boolean`                         | `false`     | Stretch row to full width.               |

**Events**
- `change` — `CustomEvent<{ index: number }>` — fires when a tab is clicked.

**Slots**
- default — tab panels (matched by index).
- `badge-slot-<index>` — badge displayed alongside tab `<index>`.

---

### `<ssk-card>` (class `Card`)
Themed card with stacked or horizontal layout, optional media image, title/subtitle/description, and content/footer/icon slots. Supports a skeleton loading state.

**Props**
| Name          | Type                                                       | Default                  | Description                              |
|---------------|------------------------------------------------------------|--------------------------|------------------------------------------|
| `testId`      | `string`                                                   | `undefined`              | Test id.                                 |
| `color`       | `ColorRole \| ColorName`                                   | `"aerospace-orange.500"` | Subtitle color.                          |
| `title`       | `string`                                                   | `""`                     | Title text.                              |
| `subtitle`    | `string`                                                   | `undefined`              | Subtitle text.                           |
| `description` | `string`                                                   | `undefined`              | Description text.                        |
| `image`       | `string`                                                   | `undefined`              | Media image URL.                         |
| `type`        | `TypeCard`                                                 | `"stacked"`              | `"stacked" \| "horizontal"`.             |
| `variant`     | `VariantCard`                                              | `"outlined"`             | `"outlined" \| "elevated"`.              |
| `width`       | `string`                                                   | `""`                     | Width override.                          |
| `loading`     | `boolean`                                                  | `false`                  | Show skeleton placeholders.              |

**Slots**
- `content` — extra body content under title/subtitle.
- `icon` — leading icon (horizontal layout).
- `footer` — footer row (horizontal layout).

---

### `<ssk-expandable-card>` (class `ExpandableCard`)
Card with a collapsible body — either expanded from the header (chevron) or from a footer "View more / less" link.

**Props**
| Name          | Type                                            | Default        | Description                              |
|---------------|-------------------------------------------------|----------------|------------------------------------------|
| `testId`      | `string`                                        | `undefined`    | Test id.                                 |
| `color`       | `ColorRole \| ColorName`                        | `undefined`    | Text color.                              |
| `themeColor`  | `ColorRole \| ColorName`                        | `"primary"`    | Accent.                                  |
| `variant`     | `"outlined" \| "elevated"`                      | `"outlined"`   | Visual variant.                          |
| `type`        | `"expand-header" \| "expand-footer"`            | `"expand-header"` | Toggle location.                      |
| `loading`     | `boolean`                                       | `false`        | Show skeleton.                           |
| `hideToggle`  | `boolean`                                       | `false`        | Hide the chevron toggle.                 |
| `hideText`    | `boolean`                                       | `false`        | Hide "View more / less" label.           |
| `expanded`    | `boolean`                                       | `false`        | Expanded state (reflects to attribute).  |
| `title`       | `string`                                        | `""`           | Title.                                   |
| `subtitle`    | `string`                                        | `""`           | Subtitle.                                |
| `width`       | `string`                                        | `"366px"`      | Card width.                              |
| `height`      | `string`                                        | `"auto"`       | Card height.                             |
| `radius`      | `string`                                        | `"8px"`        | Border radius.                           |
| `lazy`        | `boolean`                                       | `true`         | Defer rendering expandable contents until open. |
| `moreLabel`   | `string` (attr `more-label`)                    | `"View more"`  | Footer "expand" label.                   |
| `lessLabel`   | `string` (attr `less-label`)                    | `"View less"`  | Footer "collapse" label.                 |

**Events**
- `expanded-changed` — `CustomEvent<{ expanded: boolean }>` — fires when expand state toggles.

**Slots**
- `header` — custom header content.
- `content` — always-visible card body.
- `expand` — body content rendered only when expanded.
- `footer` — footer area (used by `expand-footer` type).
- `toggle-icon` — replace the default chevron icon.

---

### `<ssk-sidebar>` / `<ssk-sidebar-header>` / `<ssk-sidebar-group>` / `<ssk-sidebar-item>` / `<ssk-sidebar-list>` (sidebar family)

#### `<ssk-sidebar>` (class `Sidebar`)
Top-level sidebar that provides a `stateContext` to its descendants (expansion, selected items, expanded groups).

**Props**
| Name              | Type                       | Default     | Description                              |
|-------------------|----------------------------|-------------|------------------------------------------|
| `size`            | `Size`                     | `"md"`      | Sizing token.                            |
| `themeColor`      | `ColorRole \| ColorName`   | `"primary"` | Accent.                                  |
| `padding`         | `Size`                     | `undefined` | Padding scale.                           |
| `expanded`        | `boolean`                  | `false`     | Sidebar expanded (shows labels).         |
| `selectedItems`   | `string[]`                 | `[]`        | Keys of currently selected items.        |
| `expandedGroups`  | `string[]`                 | `[]`        | Keys of currently expanded groups.       |
| `width`           | `string`                   | `"256px"`   | Expanded width.                          |

**Events**
- `expanded-changed` — `CustomEvent<boolean>` — fires when the user toggles the sidebar.
- `selected-items-changed` — `CustomEvent<{ key: string; selected: boolean }>` — fires when an item is clicked.
- `expanded-groups-changed` — `CustomEvent<{ key: string; expanded: boolean }>` — fires when a group is toggled.

**Slots**
- `header` — top section.
- default — body (`<ssk-sidebar-list>` etc.).
- `footer` — bottom section.

#### `<ssk-sidebar-header>` (class `SidebarHeader`)
Header inside `<ssk-sidebar>`. Shows different content when the sidebar is expanded vs. collapsed.

**Props**
| Name     | Type     | Default     | Description |
|----------|----------|-------------|-------------|
| `testId` | `string` | `undefined` | Test id.    |

**Slots**
- default — content shown when the sidebar is expanded.
- `mini` — content shown when the sidebar is collapsed.

#### `<ssk-sidebar-group>` (class `SidebarGroup`)
Collapsible group of `<ssk-sidebar-item>` children.

**Props**
| Name       | Type      | Default     | Description                                       |
|------------|-----------|-------------|---------------------------------------------------|
| `testId`   | `string`  | `undefined` | Test id.                                          |
| `key`      | `string`  | `""`        | Group key (used by parent state).                 |
| `label`    | `string`  | `undefined` | Group label (only shown when sidebar expanded).   |
| `expanded` | `boolean` | `undefined` | Override the context-tracked expanded state.      |

**Slots**
- default — `<ssk-sidebar-item>` children.

#### `<ssk-sidebar-item>` (class `SidebarItems`)
Single clickable item inside a sidebar list/group.

**Props**
| Name       | Type      | Default     | Description                                       |
|------------|-----------|-------------|---------------------------------------------------|
| `testId`   | `string`  | `undefined` | Test id.                                          |
| `key`      | `string`  | `""`        | Item key (matched against parent `selectedItems`).|
| `label`    | `string`  | `undefined` | Label text.                                       |
| `disabled` | `boolean` | `false`     | Disabled state.                                   |
| `actived`  | `boolean` | `undefined` | Force-active flag overriding context.             |

**Slots**
- default — label content (shown when sidebar expanded).
- `prefix` — leading icon.

#### `<ssk-sidebar-list>` (class `SidebarList`)
Plain vertical list wrapper for sidebar items/groups.

**Props**
| Name     | Type     | Default     | Description |
|----------|----------|-------------|-------------|
| `testId` | `string` | `undefined` | Test id.    |

**Slots**
- default — items.

---

### 3.5 Media

### `<ssk-image-cropper>` (class `ImageCropper`)
Circle/square image cropper backed by `Croppie`. Render in the light DOM so Croppie's stylesheet can take effect.

**Props**
| Name            | Type      | Default     | Description                                       |
|-----------------|-----------|-------------|---------------------------------------------------|
| `src`           | `string`  | `""`        | Image source URL.                                 |
| `maskSize`      | `number`  | `200`       | Mask diameter (px).                               |
| `maskPadding`   | `number`  | `20`        | Padding around the mask.                          |
| `maxExportSize` | `number`  | `undefined` | Resize the output to fit within this dimension.   |
| `fitToMask`     | `boolean` | `false`     | Auto-zoom so the image fills the mask.            |

**Behavior**
- Re-initialises Croppie on every `updated()` cycle, destroying any previous instance.
- Exposes `crop(format?)` as a public async method that returns a base64 string.
- Uses light DOM (`createRenderRoot` returns `this`).

---

### `<ssk-wave-icon>` (class `WaveIcon`)
Decorative icon surrounded by expanding concentric "wave" circles (e.g. notification pulse). Composes `<ssk-misc-icon>` inside.

**Props**
| Name         | Type      | Default                          | Description                              |
|--------------|-----------|----------------------------------|------------------------------------------|
| `hidden`     | `boolean` | `false`                          | Skip rendering.                          |
| `iconName`   | `string`  | `"outline-question-mark-circle"` | Inner icon name.                         |
| `themeColor` | `string`  | `"black"`                        | Wave + icon background color.            |
| `iconColor`  | `string`  | `undefined`                      | Icon foreground color.                   |
| `waveColor`  | `string`  | `undefined`                      | Override wave color.                     |
| `size`       | `string`  | `"xl"`                           | One of `"sm" \| "md" \| "lg" \| "xl"`.   |

**Slots**
- default — optional label rendered below the icon.

---

### `<ssk-misc-icon>` (class `MiscIcon`)
Square icon tile with solid / light / outline background variants.

**Props**
| Name         | Type                                     | Default                            | Description                              |
|--------------|------------------------------------------|------------------------------------|------------------------------------------|
| `hidden`     | `boolean`                                | `false`                            | Skip rendering.                          |
| `variant`    | `"solid" \| "light" \| "outline"`        | `"solid"`                          | Visual variant.                          |
| `iconName`   | `string`                                 | `"outline-question-mark-circle"`   | Icon name.                               |
| `size`       | `string`                                 | `"md"`                             | Sizing token.                            |
| `themeColor` | `string`                                 | `"black"`                          | Tile color.                              |
| `iconColor`  | `string`                                 | `undefined`                        | Icon foreground color.                   |

---

### 3.6 Files

### `<ssk-download-file>` (class `DownloadFile`)
Inline "file row" with leading icon, label, optional trailing actions, and a footer slot for a progress bar.

**Props**
| Name              | Type                       | Default       | Description                              |
|-------------------|----------------------------|---------------|------------------------------------------|
| `themeColor`      | `ColorRole \| ColorName`   | `""`          | Accent.                                  |
| `color`           | `ColorRole \| ColorName`   | `undefined`   | Text color.                              |
| `size`            | `Size`                     | `"md"`        | Sizing token.                            |
| `margin`          | `string`                   | `undefined`   | Margin override.                         |
| `padding`         | `Size`                     | `undefined`   | Padding scale.                           |
| `rounded`         | `string`                   | `undefined`   | Border radius.                           |
| `width`           | `string`                   | `"100%"`      | Width override.                          |
| `fontFamilyGroup` | `FontFamilyGroup`          | `"sans"`      | Font family group.                       |
| `fontSize`        | `string`                   | `undefined`   | Font size override.                      |
| `hidden`          | `boolean`                  | `false`       | Skip rendering.                          |
| `label`           | `string`                   | `"File Name"` | Default label text.                      |
| `hideCloseButton` | `boolean`                  | `false`       | Hide the X close button.                 |

**Events**
- `click` — `CustomEvent<{ originalEvent: Event }>` (re-dispatched from the X icon) — fires when the close icon is clicked.

**Slots**
- `icon-slot-prefix` — leading icon (e.g. document icon).
- `label-name` — file name content.
- `icon-slot-postfix` — extra trailing actions before the close icon.
- `footer` — progress bar or status text.

---

### 3.7 Dashboards

### `<ssk-widget-grid>` (class `Grid`)
Drag-and-drop dashboard grid built on `GridStack`. Pass `<ssk-widget-*>` children — the grid reads their `getSize()` (Widget interface) to lay them out.

**Props**
| Name           | Type      | Default | Description                                          |
|----------------|-----------|---------|------------------------------------------------------|
| `testId`       | `string`  | `undefined` | Test id.                                         |
| `draggable`    | `boolean` | `true`  | Allow dragging widgets around.                       |
| `gap`          | `string`  | `"16px"`| Gap between cells.                                   |
| `gridItemSize` | `number`  | `88`    | Base cell size (px) — multiplied by widget width/height. |
| `maxColumns`   | `number`  | `12`    | Grid column count.                                   |
| `items`        | `GridItem[]` | `[]` | Optional declarative items (typically pass children instead). |

```ts
export interface GridItem { id: number; x: number; y: number; w?: number; h?: number; content?: string }
```

**Behavior**
- Snapshots the initial light-DOM children in the constructor, then re-parents them into `.grid-stack-item-content` wrappers on `firstUpdated`.
- Calls `grid.enable() / disable()` when `draggable` changes.

---

## How to read this file

- The catalog is **derived** — every prop, event, and slot here traces to a line in `src/`. If you suspect drift, run `/sync-skill` in the design-system repo.
- The `Default` column reflects the **field initializer in source**. A field with no initializer is reported as `undefined` (not blank).
- The `Type` column is the TS type as written in source, normalised to the unions listed at the top of this file. Where the source type is a complex object (e.g. `DropdownOption[]`), the full shape is given in a code fence under the same `### <ssk-tag>` block.
- Events listed are **bubbling + composed by default** (the element library enforces this for custom events). DOM-native events are re-dispatched as `CustomEvent<{ originalEvent: Event }>` — listen for them with the same name as the native event (`input`, `change`, `click`, `focus`, `blur`).
- Slot names match the markup — `slot="header"` in markup ↔ `<slot name="header">` in source.
