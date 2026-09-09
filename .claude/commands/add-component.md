# Add a New Component

Scaffold a reusable Svelte component.

## Arguments
- `$ARGUMENTS` — component path (e.g., `modal/ConfirmDelete`, `form/ShippingForm`, `payment/QRCode`)

## Steps
1. Parse the component path from `$ARGUMENTS`
2. Create `src/components/<path>.svelte` with TypeScript script block
3. Use `@sellsuki-org/sellsuki-components` (`<ssk-*>`) where applicable
4. Add scoped `<style>` block with CSS custom properties from `main.css`
5. If it's a form component, add Yup validation schema in `src/utils/form-validation/`
6. Use `$` path aliases for all imports
