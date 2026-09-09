# API Integration Patterns

## Three-File Pattern

Every API domain follows a strict three-file pattern:

```
src/service/
  <domain>-gen.ts       # Auto-generated OpenAPI types (NEVER edit manually)
  <domain>-rest.ts      # API functions — HTTP calls + response typing
  <domain>-adapter.ts   # Data mapping — snake_case API → camelCase entity
```

### Generating OpenAPI Types

```bash
bun run generate-openapi:<domain>
```

Available generators (defined in package.json):
- `generate-openapi:management` — Management backend
- `generate-openapi:customer-book-v2` — Customer Book v2
- `generate-openapi:pis` — Product Information System
- `generate-openapi:central-configuration` — Central Configuration System
- `generate-openapi:i18n` — i18n Management
- `generate-openapi:paper` — Paper/printing templates
- `generate-openapi:doms` — DOMS (delivery/shipping)

## Axios Clients

### `newAxiosClient` (preferred — use for new services)

```typescript
import { newAxiosClient } from '$lib/axios-client-v2';

const client = newAxiosClient(baseURL, headers?, singleRequestPerPath?);
// Returns a standard Axios instance
// singleRequestPerPath = true → cancels duplicate in-flight requests to same URL
```

Features:
- Functional factory (not a class)
- Request deduplication via AbortController when `singleRequestPerPath = true`
- Auto-redirect to login on 401/unauthenticated via response interceptor
- `withCredentials: true` unless `VITE_ADDITIONS_HEADERS` is set (dev mode)

### `axiosClient` (legacy — used by central-configuration, i18n)

```typescript
import { axiosClient } from '$lib/axios.client';

const client = new axiosClient(baseURL);
client.get<T>(path, query?)
client.post<T>(path, data?, query?)
client.put<T>(path, data, query?)
client.del<T>(path, query?)
```

**For new services, always use `newAxiosClient`.**

## REST File Pattern

```typescript
import { newAxiosClient } from '$lib/axios-client-v2';
import type { Entity } from '$lib/entities/domain/entity';
import type { paths } from './domain-gen';       // OpenAPI v2 (Swagger)
import type { operations } from './domain-gen';   // OpenAPI v3
import { toEntity, toEntityRequest } from './domain-adapter';

const env = import.meta.env;
const base = env.VITE_DOMAIN_URL;
const client = newAxiosClient(base, undefined, true);

// GET with typed response
export const getEntity = async (id: string): Promise<Entity> => {
  const resp = await client.get<paths['/entity/{id}']['get']['responses'][200]['schema']>(
    `/entity/${id}`
  );
  return toEntity(resp.data);
};

// POST with request adapter
export const createEntity = async (entity: Entity): Promise<string> => {
  return (
    await client.post<paths['/entity']['post']['responses'][200]['schema']>(
      '/entity',
      toEntityRequest(entity)
    )
  ).data;
};

// LIST with pagination
export const listEntities = async (offset = 0, limit = 10) => {
  const resp = await client.get<paths['/entities']['get']['responses'][200]['schema']>(
    '/entities',
    { params: { offset, limit } }
  );
  return { data: resp.data?.data?.map(toEntity), total: resp.data.total ?? 0 };
};
```

### OpenAPI v2 vs v3 type patterns

- **v2 (Swagger)**: Uses `paths[...]['responses'][200]['schema']` and `definitions['model.Name']`
  - Services: management, pis
- **v3**: Uses `operations['OpName']['responses'][200]['content']['application/json']` and `components['schemas']['Name']`
  - Services: customer-book-v2, central-configuration, i18n

## Adapter File Pattern

```typescript
import type { Entity } from '$lib/entities/domain/entity';
import type { definitions } from './domain-gen';

// API response → Entity (snake_case → camelCase)
export const toEntity = (raw: definitions['model.EntityResponse']): Entity => {
  return {
    id: raw.id ?? '',
    entityName: raw.entity_name ?? '',
    createdAt: raw.created_at ?? undefined,
  };
};

// Entity → API request (camelCase → snake_case)
export const toEntityRequest = (e: Entity): definitions['model.EntityRequest'] => {
  return {
    entity_name: e.entityName,
  };
};
```

**Rules:**
- Adapters always provide safe defaults (`?? ''`, `?? 0`, `?? undefined`)
- Never return raw API types to components — always map through adapter
- Keep adapters pure (no side effects, no async)

## Backend API Domains

| Domain | Env Var | Base URL Pattern | Client |
|--------|---------|-----------------|--------|
| Management | `VITE_MANAGEMENT_URL` | `api.{env}.patona.online/management` | `newAxiosClient` |
| Customer Book v2 | `VITE_CUSTOMER_BOOK_V2_URL` | `api.{env}.patona.online/v2-customer-book/v1` | `newAxiosClient` |
| PIS (Products) | `VITE_PIS_URL` | `api.{env}.sellsuki.com/pis` | `newAxiosClient` |
| Central Config | `VITE_CENTRAL_CONFIGURATION_SYSTEM_URL` | `api.{env}.sellsuki.com/central-configuration-system/v1` | `axiosClient` (legacy) |
| i18n | `VITE_I18N_URL` | `api.{env}.sellsuki.com/i18n-management/v1` | `axiosClient` (legacy) |
| AMS (Auth) | `VITE_AMS_URL` | `accounts.{domain}` | `fetch` (no axios) |

## Permission Checking

Both Management and Customer Book backends expose `/checkpermission/each` endpoints:

```typescript
export const checkPermissionsEach = async (kind: string, id: string, permissions: string[]) => {
  const resp = await client.get('/checkpermission/each', {
    params: { kind, id, permissions: permissions.join(',') }
  });
  return resp.data.status;
};
```

## Error Handling

- HTTP 401 + unauthenticated body → auto-redirect to login (handled by axios interceptor)
- Certain paths skip auth redirect: `/user/profile`, `/public/countries`, `/public/languages`, `/public/keywords/`
- HTTP 500 with auth error body → also redirects to login
- All other errors: `throw error` to let caller handle
