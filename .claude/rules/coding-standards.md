# Coding Standards

## TypeScript
- `<script lang="ts">` in all `.svelte` files
- Use `type` imports for type-only imports: `import type { Foo } from '...'`
- Prefer interfaces over type aliases for object shapes
- Use `$` path aliases for all imports (`$lib`, `$components`, `$pages`, `$stores`, `$utils`)

## Svelte 4
- Props via `export let propName: Type`
- Reactive declarations: `$: derivedValue = expression`
- Store subscriptions in templates: `$storeName`
- Lifecycle: `onMount`, `onDestroy` from `svelte`
- Context: `setContext('key', value)` / `getContext<Type>('key')`
- Event forwarding: `on:click`, `createEventDispatcher()`
- Conditional rendering: `{#if}`, `{:else if}`, `{:else}`, `{/if}`
- List rendering: `{#each items as item (item.id)}`, `{/each}`
- Await blocks: `{#await promise}`, `{:then value}`, `{:catch error}`, `{/await}`

## Styling
- Scoped `<style>` blocks in `.svelte` files (Svelte's built-in scoping)
- `@sellsuki-org/sellsuki-components` for design system elements (`<ssk-*>`)
- CSS custom properties from `main.css` for colors/spacing
- No Tailwind, no CSS-in-JS, no CSS Modules

## File Naming
- Components: `PascalCase.svelte`
- Stores: `kebab-case.ts` (e.g., `current-company.ts`, `cart-item.ts`)
- Services: `kebab-case-rest.ts` + `kebab-case-adapter.ts` + `kebab-case-gen.ts`
- Entities: `kebab-case.ts` inside domain subdirectory
- Utils: `kebab-case.ts`
- Event handlers: `kebab-case.ts` (e.g., `orderHandler.ts`, `filterHandler.ts`)

## Forms
- `svelte-forms-lib` for form state management
- Yup schemas in `src/utils/form-validation/`
- Schema type inference: `type FormType = yup.InferType<typeof schema>`
- Thai validation messages (กรุณากรอก..., ไม่ถูกต้อง, etc.)

## Store Conventions
- Use `writable<T>()` for mutable state
- Use `derived()` for computed state
- Use `get()` for one-time reads outside reactive context
- State shape: `{ loading: boolean, data: T | undefined }`
- Export load functions alongside stores: `export async function loadEntity()`
- Never use default exports for stores
