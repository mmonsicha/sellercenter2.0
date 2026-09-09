# Debug API Integration

Systematic debugging for API connection issues between the Seller Center frontend and backend services.

## Steps
1. Check the current env mode and relevant `VITE_*_URL` values in the active `.env.*` file
2. Verify the axios client setup in the relevant `*-rest.ts` file
3. Check if using `newAxiosClient` (preferred) or `axiosClient` (legacy)
4. Check browser console / network for CORS or auth errors
5. If 401 errors:
   - Verify `VITE_DISABLE_COOKIE_MATCHING` is set in `.env.dev` for local dev
   - Verify `VITE_ADDITIONS_HEADERS` has valid JSON with `X-User-Id` and `X-User-Kind`
   - Check `shouldRedirectToLogin()` in `src/utils/auth-redirect.ts`
   - Verify the URL is not in `skipAuthRedirectPaths` if it should redirect
6. If network errors:
   - Verify `withCredentials` behavior in the axios client
   - Check if `VITE_ADDITIONS_HEADERS` presence toggles `withCredentials: false`
   - Verify the base URL env variable is set correctly
7. If data mapping errors:
   - Check the adapter file for the domain (`src/service/*-adapter.ts`)
   - Verify snake_case → camelCase mapping matches actual API response
   - Check if using OpenAPI v2 (`definitions[...]`) or v3 (`components['schemas'][...]`) types
8. If request deduplication issues:
   - Check if `singleRequestPerPath = true` on `newAxiosClient` is cancelling needed requests
   - Verify the full URL (including query params) is unique for concurrent requests
