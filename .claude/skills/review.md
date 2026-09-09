# Review and Fix

Post-implementation review cycle. Architect reads code, finds issues, delegates fixes.

## Trigger
After a feature is implemented, or when the user asks to review recent changes.

## Steps

### 1. Identify Changed Files
- Run `git diff --name-only` to see what changed
- Run `git diff --stat` for a high-level overview

### 2. Review Each File
For each changed file, check:
- **TypeScript**: Correct types, no `any` leaks, proper imports with `$` aliases
- **Svelte**: `<script lang="ts">`, `export let` for props, `$:` for reactivity, proper store subscriptions
- **Styling**: Scoped `<style>` blocks or `@sellsuki-org/sellsuki-components` usage
- **Thai**: All user-facing text is in Thai or uses i18n keywords
- **API pattern**: REST files use `newAxiosClient`, adapters map snake_case → camelCase
- **No hardcoded values**: storeId, URLs, etc. should come from stores or env
- **No unused imports or variables**

### 3. Build Check
- Run `bun run check` (svelte-check)
- Run `bun run build` (production build)
- If errors, categorize them (type errors, unused vars, missing imports)

### 4. Fix Issues
- For trivial fixes (1-2 lines): fix directly
- For larger fixes: spawn a developer agent with specific fix instructions
- Re-run build after fixes

### 5. Report
- List all issues found and fixed
- List any remaining concerns or TODOs
- Confirm build passes
