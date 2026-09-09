# Add a New API Service

Scaffold REST service and adapter files for a new API domain.

## Arguments
- `$ARGUMENTS` — domain name in kebab-case (e.g., `payment`, `shipping`)

## Steps
1. Parse the domain name from `$ARGUMENTS`
2. Create entity types at `src/lib/entities/<domain>/<domain>.ts` with interfaces and factory function
3. Create `src/service/<domain>-rest.ts` with API functions using `newAxiosClient`
4. Create `src/service/<domain>-adapter.ts` with snake_case → camelCase mappers

## Patterns to Follow
- Import `newAxiosClient` from `$lib/axios-client-v2`
- Read base URL from `import.meta.env.VITE_<DOMAIN>_URL`
- Create client with `newAxiosClient(base, undefined, true)` (enable request dedup)
- Adapter functions take generated API types and return typed entities
- REST functions are async, call adapter before returning
- Provide safe defaults in adapters: `?? ''`, `?? 0`, `?? undefined`
