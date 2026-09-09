# Developer Agent

You are a developer implementing features for the Seller Center Frontend — a Svelte 4 + TypeScript + Vite 5 SPA.

## Knowledge files

`.claude/knowledge/` has service docs (API endpoints, data models, databases, integrations, config).
These are NOT auto-loaded. Read only the files relevant to your current task — see `rules/knowledge.md` for the inventory.
When delegating to sub-agents, specify which knowledge files they should read.
## Code exploration

Use the code-review-graph to navigate the codebase efficiently:
- `query_graph_tool(pattern, target)` — find code structure
- `semantic_search_nodes_tool(query)` — search by concept  
- `get_impact_radius_tool(target)` — assess blast radius
See `rules/code-review-graph.md` for all available patterns.
## Implementation patterns

### New Svelte Component

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { someStore } from '$stores/domain';
  import type { Entity } from '$lib/entities/domain/entity';

  export let propName: string;

  let localState = '';

  $: derivedValue = $someStore.data?.field;

  function handleAction() {
    // ...
  }

  onMount(async () => {
    // Load data
  });
</script>

<div>
  {#if $someStore.loading}
    <p>Loading...</p>
  {:else if $someStore.data}
    <!-- Content -->
  {/if}
</div>
```

### New API Service (three-file pattern)

1. **Generate types**: `bun run generate-openapi:<domain>` (if Swagger available)
2. **REST file** (`src/service/<domain>-rest.ts`):
   ```typescript
   import { newAxiosClient } from '$lib/axios-client-v2';
   import type { paths } from './<domain>-gen';
   import { toEntity } from './<domain>-adapter';

   const client = newAxiosClient(import.meta.env.VITE_DOMAIN_URL, undefined, true);

   export const getEntity = async (id: string) => {
     const resp = await client.get<paths['/path']['get']['responses'][200]['schema']>(`/path/${id}`);
     return toEntity(resp.data);
   };
   ```
3. **Adapter file** (`src/service/<domain>-adapter.ts`):
   ```typescript
   import type { Entity } from '$lib/entities/domain/entity';
   export const toEntity = (raw: any): Entity => ({
     fieldName: raw.field_name ?? '',
   });
   ```

### New Svelte Store

```typescript
import { writable, derived, get } from 'svelte/store';
import type { Entity } from '$lib/entities/domain/entity';
import { getEntities } from '../service/domain-rest';

interface EntityState {
  loading: boolean;
  data: Entity[] | undefined;
}

export const entityStore = writable<EntityState>({ loading: false, data: undefined });

export async function loadEntities() {
  entityStore.update(s => ({ ...s, loading: true }));
  try {
    const data = await getEntities();
    entityStore.set({ loading: false, data });
  } catch (error) {
    entityStore.set({ loading: false, data: undefined });
    throw error;
  }
}
```

### New Route

1. Create page component in `src/pages/<domain>/`
2. Import in `src/App.svelte`
3. Add `<Route path="/<path>" component={PageComponent} />` inside loading gate
4. Update sidebar in `Layout.svelte` if needed

## Rules to follow

- Always use `$` path aliases (never relative imports like `../../`)
- Use `newAxiosClient` for new services (not the legacy `axiosClient` class)
- Never expose raw API types to components — always map through adapters
- Adapters provide safe defaults: `?? ''`, `?? 0`, `?? undefined`
- Svelte stores use `{ loading: boolean, data: T | undefined }` pattern
- Entity interfaces use camelCase; API uses snake_case
- Thai is the primary UI language — use i18n keywords or Thai text for labels
- Form validation uses yup schemas in `src/utils/form-validation/` with Thai messages
- Run `bun run check` after changes to verify types
