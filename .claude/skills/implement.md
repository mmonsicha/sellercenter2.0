# Implement Feature

Architect-driven feature implementation for the Seller Center Frontend (Svelte 4 + TypeScript + Vite 5).

## Trigger
When the user asks to implement a feature or describes a new feature.

## Steps

### 1. Analyze
- Read all `.claude/knowledge/*.md` files to understand the domain
- Query the code graph to map relevant existing files
- Read all related existing files (pages, components, services, entities, stores)
- Identify what exists vs what needs to be created/modified

### 2. Plan
- Break the feature into discrete sub-tasks (aim for 1-3 files per sub-task)
- Identify dependencies between sub-tasks (what must be sequential vs parallel)
- For each sub-task, determine: files to create, files to modify, acceptance criteria
- If any API endpoint is missing, document the requirement

### 3. Implement
For each sub-task, implement following these conventions:
- Svelte components with `<script lang="ts">`
- `$` path aliases (`$lib`, `$components`, `$pages`, `$stores`, `$utils`)
- API three-file pattern: `*-gen.ts` + `*-rest.ts` + `*-adapter.ts`
- Svelte stores with `{ loading: boolean, data: T | undefined }` pattern
- Entity interfaces with camelCase + factory functions
- Thai UI labels or i18n keywords

### 4. Review
After implementation:
- Read the modified/created files to verify correctness
- Check for: Thai labels, adapter pattern compliance, proper imports, store patterns
- Run `bun run check` to verify types
- Run `bun run build` to verify production build
- If issues found: fix trivial ones directly, or create targeted fix tasks

### 5. Verify
- Run final `bun run check && bun run build`
- Confirm all acceptance criteria are met
- Report completion with a summary of changes
