# Scaffold a Full Feature

End-to-end scaffolding for a new feature: entity types, API service, store, components, page, and route.

## Arguments
- Feature name (e.g., "payment", "customer", "shipping")

## Steps
1. **Entity types** — Create `src/lib/entities/<feature>/<feature>.ts` with TypeScript interfaces + factory function
2. **API adapter** — Create `src/service/<feature>-adapter.ts` with snake_case → camelCase mappers
3. **API service** — Create `src/service/<feature>-rest.ts` with CRUD functions using `newAxiosClient`
4. **Store** — Create `src/stores/<feature>/<feature>.ts` with writable store + load function
5. **List page** — Create `src/pages/<feature>/List.svelte` with data loading and list rendering
6. **Detail page** — Create `src/pages/<feature>/View.svelte` with detail display
7. **Routes** — Add routes to `src/App.svelte` inside the loading gate block
8. **Sidebar** — Add nav item to `sidebarGroups` in `src/components/Layout.svelte`
9. **Build check** — Run `bun run check && bun run build` to verify no errors

## Checklist
- [ ] Entity types defined with factory function
- [ ] API service + adapter created (three-file pattern)
- [ ] Svelte store with loading state pattern
- [ ] List and detail pages created as `.svelte` files
- [ ] Routes added to App.svelte
- [ ] Sidebar nav updated
- [ ] Build passes
