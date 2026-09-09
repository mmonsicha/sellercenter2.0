# Start Dev Server

Start the Vite dev server for local development.

## Steps
1. Check if `node_modules` exists, if not run `bun install`
2. Start the dev server:
   - Local with auth bypass: `bun run start:local` (uses `.env.dev` with custom headers)
   - Development APIs: `bun run start:development` (uses `.env.development` with real auth)
   - Staging: `bun run start:staging` (uses `.env.staging`)
3. Report the local URL (default: http://localhost:5173)

## Arguments
- `local` — use `.env.dev` (skips cookie matching, injects auth headers)
- `development` — use `.env.development` (real auth via AMS)
- `staging` — use `.env.staging`
