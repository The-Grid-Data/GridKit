# grid-kit Implementation Plan

8 sequential tasks. Each is a testable deliverable. Clear context between tasks and re-read only the files listed.

**Always read before each task:** `CLAUDE.md`, `SKILLS.md`

- [x] Task 1
- [x] Task 2
- [ ] Task 3
- [ ] Task 4
- [ ] Task 5
- [ ] Task 6
- [ ] Task 7
- [ ] Task 8

---

## Task 1: Scaffold project

**Goal:** Empty buildable package with correct structure.

**Read:** `docs/research/npm_package_best_practices.md`

**Do:**

- `bun init` + configure package.json (name, type:module, sideEffects:false, exports map, peerDeps, deps)
- tsconfig.json (strict, jsx react-jsx, moduleResolution bundler)
- tsup.config.ts (4 entry points: index, core/index, hooks/index, components/index)
- .gitignore (node_modules, dist, .env, src/generated)
- Create empty barrel files: `src/index.ts`, `src/core/index.ts`, `src/hooks/index.ts`, `src/components/index.ts`
- `bun install`

**Test:** `bun run build` succeeds with no errors.

---

## Task 2: Core layer -- GridProvider + Graffle client factory

**Goal:** Framework-agnostic core + React config context. No hooks yet.

**Read:** `docs/research/graffle_docs.md`, `docs/research/thegrid_tgs_schema.md`

**Do:**

- `src/core/types.ts` -- GridConfig interface (endpoint, apiKey?, headers?)
- `src/core/client.ts` -- createGridClient(config) using Graffle.create
- `src/core/query-keys.ts` -- gridKeys factory (all, graphql, companies, company, searches, search)
- `src/core/index.ts` -- re-export all core
- `src/components/GridProvider.tsx` -- GridContext + GridProvider + useGridConfig hook
- `src/components/index.ts` -- re-export GridProvider, useGridConfig
- Wire up barrel exports in `src/index.ts`

**Test:** `bun run build` + `bun run typecheck` pass.

---

## Task 3: useGridQuery hook -- raw GraphQL strings

**Goal:** The primary hook. Devs copy/paste queries from Hasura console, get data back.

**Read:** `docs/research/graffle_docs.md`, `docs/research/tanstack_query_v5_best_practices.md`

**Do:**

- `src/hooks/useGridQuery.ts` -- accepts raw GraphQL string + variables, uses useGridConfig, executes via Graffle gql, wraps in useQuery with gridKeys.graphql key
- Helper: extractOperationName(query) to parse op name from query string for cache keys
- `src/hooks/index.ts` -- re-export
- Wire into `src/index.ts`

**Test:** `bun run build` + `bun run typecheck` pass.

---

## Task 4: Playground app -- manual e2e testing

**Goal:** Simple React app for manual testing. Runs on `bun run dev`.

**Read:** `docs/research/thegrid_tgs_schema.md`, `docs/research/thegrid_mcp.md`

**Do:**

- `playground/index.html`, `playground/main.tsx`, `playground/App.tsx`
- Wraps with QueryClientProvider + GridProvider pointing at tgs.thegrid.id
- Simple UI: textarea for GraphQL query, variables input, submit button, JSON result display
- Uses useGridQuery to execute
- Add `"dev"` script to root package.json (vite or bun serve)

**Test:** `bun run dev` opens browser. Paste `query { products(limit: 5) { id name } }`, see results.

---

## Task 5: Pre-built hooks -- useGridCompany, useGridSearch

**Goal:** Domain-specific convenience hooks on top of the core.

**Read:** `docs/research/tanstack_query_v5_best_practices.md`, `docs/research/thegrid_tgs_schema.md`

**Do:**

- `src/hooks/useGridCompany.ts` -- fetch single company by ID, staleTime 5min, supports enabled pattern
- `src/hooks/useGridSearch.ts` -- search products/assets by text, staleTime 1min
- `src/hooks/useInvalidateGrid.ts` -- cache invalidation utility using gridKeys
- `src/hooks/usePrefetchGridCompany.ts` -- prefetch on hover using queryOptions factory
- Export queryOptions factories for SSR (gridCompanyQueryOptions)
- Re-export from `hooks/index.ts`

**Test:** Build passes. Test in playground with real company IDs from The Grid (use MCP `mcp__grid__find` to discover valid IDs).

---

## Task 6: ThumbnailHoverCard component

**Goal:** Hover card that shows company info. Uses the hooks from task 5.

**Read:** `docs/research/tanstack_query_v5_best_practices.md` (prefetch section)

**Do:**

- `src/components/ThumbnailHoverCard.tsx` -- accepts companyId, shows thumbnail/name, prefetches on mouseenter, shows details on hover
- Uses useGridCompany + usePrefetchGridCompany
- Minimal styles (inline or CSS module, zero external CSS deps)
- Add to playground for manual testing

**Test:** Visible in playground. Hover triggers data fetch, card displays company info.

---

## Task 7: Storybook setup + stories

**Goal:** Visual component testing environment.

**Read:** (no research doc needed -- standard Storybook React/Vite setup)

**Do:**

- Install `@storybook/react-vite` + deps
- `.storybook/main.ts`, `.storybook/preview.tsx` (wrap with QueryClientProvider + GridProvider, mock data or MSW)
- `src/components/ThumbnailHoverCard.stories.tsx` (loading, loaded, error states)
- Add `"storybook"` script: `storybook dev -p 6006`

**Test:** `bun run storybook` opens and renders stories with all states visible.

---

## Task 8: Publish readiness -- validation + size check

**Goal:** Package is ready for `npm publish`.

**Read:** `docs/research/npm_package_best_practices.md`

**Do:**

- `npm pack --dry-run` -- verify tarball contents
- Add publint, @arethetypeswrong/cli, size-limit as devDeps
- size-limit config targeting < 15KB gzipped
- Add prepublishOnly script: typecheck + build + publint + attw
- Verify all 4 export paths resolve correctly (`.`, `./core`, `./hooks`, `./components`)

**Test:** All validation commands pass. Tarball contains only dist/ + README.md.
