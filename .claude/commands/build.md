# Build for Production

Run TypeScript type checking and Vite production build.

## Steps
1. Run `bun run build` (runs `tsc -b && vite build`)
2. If TypeScript errors occur, list them and suggest fixes
3. If build succeeds, report the output size from `dist/`
