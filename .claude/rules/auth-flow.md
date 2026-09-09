# Authentication Flow

## Overview

Seller Center uses **cookie-based authentication** via the AMS (Account Management System) at `accounts.sellsuki.com` (prod) or `accounts.revette.io` (dev). There is no JWT or token-based auth — sessions are maintained via HTTP cookies.

## Cookie Matching Flow

On app startup (`loadProfile()` in `src/stores/profile.ts`):

1. **Check cookie matching**: If `VITE_DISABLE_COOKIE_MATCHING` is not set, redirect to AMS `/cookie-matching` endpoint
2. AMS sets cross-domain cookies and redirects back with `?cookie_matched` query param
3. App strips the `cookie_matched` param from URL
4. **Load profile**: `GET /user/profile` via management API
5. If profile is null → navigate to `/` (home — shows login prompt)
6. If profile exists → load companies, configuration, continue to app

### Dev Mode Auth Bypass

In `.env.dev`, set:

```
VITE_DISABLE_COOKIE_MATCHING=true
VITE_ADDITIONS_HEADERS={"X-User-Id":"<user-uuid>","X-User-Kind":"sellsuki.user"}
```

When `VITE_ADDITIONS_HEADERS` is set:

- Axios clients set `withCredentials: false` (no cookies needed)
- Custom headers are injected into every request
- This simulates a logged-in user without AMS

## Auth Redirect Logic (`src/utils/auth-redirect.ts`)

The function `shouldRedirectToLogin(status, data, url)` determines when to redirect:

1. **Skip paths**: `/user/profile`, `/public/countries`, `/public/languages`, `/public/keywords/` — never redirect for these
2. **Status check**: Only process 401 or 500 responses
3. **Body check**: Look for auth error indicators:
   - `error: "unauthorized"` or `"unauthenticated"`
   - `error_code: "unauthorized"` or `"unauthenticated"`
   - `error.code: 401`
   - `error.status: "Unauthorized"`

## Navigation Functions (`src/utils/navigate.ts`)

| Function                 | Destination                                                     | When                     |
| ------------------------ | --------------------------------------------------------------- | ------------------------ |
| `navigateToLogin(path?)` | `{AMS}/login?return_to={path}&theme=patona`                     | 401 redirect             |
| `navigateToLogout()`     | `{AMS}/logout?return_to={origin}&theme=patona`                  | User clicks logout       |
| `navigateToRegister()`   | `{AMS}/registration?return_to={href}&theme=patona`              | New user                 |
| `navigateToSettings()`   | `{AMS}/settings?return_to={href}&theme=patona`                  | Profile settings         |
| `navigateToSyncLogin()`  | `{AMS}/cookie?destination_accounts_url={patona}&referer={href}` | Cross-domain sync        |
| `navigateToCCSCompany()` | `{CCS_3}`                                                       | Admin company management |

All navigation uses `window.location.href` (full page redirect), not client-side routing.

## Session State

- `profileInfo` store (`src/stores/profile.ts`): `{ loading: boolean, data: Profile | undefined }`
- `isMember` derived store: `true` when profile data exists
- Profile fields: `id`, `firstName`, `lastName`, `email`, `phone`, `avatar`, `gender`, `verified`

## Company & Store Selection

After profile loads:

1. Load user's companies via `listUserCompany()`
2. Load user configuration via `getBulkConfigs()` (central config system)
3. If no `selectedCompanyId` + `selectedStoreId` in config → auto-select via `setCurrentCompany()`
4. If zero companies → redirect to `/company/new`
5. Company/store selection persisted via central configuration system

## Identity Headers

- `X-User-Id` — user UUID (set by AMS cookie or dev headers)
- `X-User-Kind` — always `"sellsuki.user"` for seller center
- `VITE_PROVIDER_CODE` — always `"patona,sellsuki,any"` (multi-tenant provider identifier)

## Microsoft Clarity Integration

When profile loads, identity is set for analytics:

```typescript
window.clarity('set', 'identity_email', profile.data?.email);
```
