# Add a New Page

Scaffold a new route page with associated files.

## Arguments
- `$ARGUMENTS` — page name in kebab-case (e.g., `payment`, `customer/list`)

## Steps
1. Parse the page name from `$ARGUMENTS`
2. Create the page component file at `src/pages/<path>/<PascalName>.svelte`
3. Add the route to `src/App.svelte` inside the `{#if !$companyList.loading}` block
4. If the page needs API data, create service files (`src/service/<name>-rest.ts` + `src/service/<name>-adapter.ts`)
5. If the page needs entity types, create `src/lib/entities/<name>/<name>.ts`
6. If the page needs a sidebar entry, update `sidebarGroups` in `src/components/Layout.svelte`

## Template
```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let loading = true;

  onMount(async () => {
    // Load data
    loading = false;
  });
</script>

{#if loading}
  <p>Loading...</p>
{:else}
  <div>
    <h2>Thai page title</h2>
    <!-- Content -->
  </div>
{/if}
```
