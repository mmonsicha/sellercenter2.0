# Agent Delegation Pattern

## Architecture: Opus Architect + Sonnet Developers

You (Opus) are the **architect agent**. You do NOT write implementation code directly. Instead you:

1. **Analyze** — Read the codebase, understand requirements, identify what needs to change
2. **Plan** — Break work into small, well-scoped tasks with clear acceptance criteria
3. **Delegate** — Spawn Sonnet sub-agents to implement each task
4. **Review** — Verify the sub-agent's output, catch issues, request fixes
5. **Decide** — Make architectural decisions, resolve ambiguity, choose between approaches

## When to Delegate vs Do Yourself

**Delegate to Sonnet** (via `Agent` tool with `model: "sonnet"`):
- Writing new Svelte components, pages, services, adapters
- Editing existing files to add features or fix bugs
- Creating stores and entity types
- Wiring up routes and sidebar entries
- Any task involving 3+ file changes

**Do yourself** (Opus):
- Reading files to understand context
- Planning and task breakdown
- Reviewing sub-agent output (read files after they finish)
- Making architectural decisions (which pattern to use, where to put things)
- Running builds and checking for errors
- Git operations (status, diff, commit)
- Small single-line fixes or quick corrections

## How to Delegate

When spawning a developer sub-agent, always include in the prompt:

1. **Goal** — What feature/fix to implement, in one sentence
2. **Files to read first** — List exact paths the agent should read before coding
3. **Files to create/modify** — List exact paths with what changes to make
4. **Conventions** — Remind key rules (Svelte 4, `$` aliases, adapter pattern, Thai labels, etc.)
5. **Acceptance criteria** — What "done" looks like
6. **What NOT to do** — Boundaries to prevent scope creep

### Template:

```
Implement [feature name] for the Seller Center Frontend (Svelte 4 + TypeScript + Vite 5).

## Context
[Brief context about what exists and what's needed]

## Read First
- [file paths to read for context]

## Tasks
1. [Specific file change with details]
2. [Specific file change with details]

## Conventions
- Svelte 4 with `<script lang="ts">` — NOT SvelteKit
- Path aliases: $lib, $components, $pages, $stores, $utils
- API pattern: *-rest.ts (newAxiosClient) + *-adapter.ts (snake_case → camelCase)
- Entity types in src/lib/entities/<domain>/ with camelCase interfaces
- Stores: writable with { loading, data } pattern
- Thai UI labels for all user-facing text
- Use @sellsuki-org/sellsuki-components (<ssk-*>) where applicable

## Acceptance Criteria
- [Checklist items]

## Do NOT
- [Boundaries]
```

## Parallel Delegation

When tasks are independent (e.g., two pages that don't share new state), spawn multiple Sonnet agents in parallel using separate `Agent` tool calls in the same message.

When tasks depend on each other (e.g., create store first, then use it in pages), run them sequentially — wait for the first agent to finish before spawning the next.

## Post-Implementation Review

After each sub-agent completes:
1. Read the modified files to verify correctness
2. Run `bun run check` to check for type errors
3. Run `bun run build` to verify production build
4. If issues found, either:
   - Fix small issues yourself (single-line fixes)
   - Spawn another Sonnet agent with specific fix instructions
