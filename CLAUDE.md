# CLAUDE.md - grid-kit

## Project Overview

grid-kit is an NPM package that provides React hooks and components for querying The Grid's GraphQL API (Hasura-backed, at `tgs.thegrid.id/v1/graphql`).

## Tech Stack

| Concern                   | Tool                                    |
| ------------------------- | --------------------------------------- |
| Runtime / Package Manager | Bun                                     |
| Bundler                   | tsup (esbuild-based, library-optimized) |
| GraphQL Client            | Graffle                                 |
| Data Caching / State      | @tanstack/react-query v5                |
| Component Testing         | Storybook                               |
| Language                  | TypeScript (strict)                     |

## Architecture

```
src/
  index.ts                    -- top-level barrel re-export
  core/                       -- framework-agnostic layer
    index.ts
    client.ts                 -- Graffle client factory
    query-keys.ts             -- query key factory (gridKeys)
    types.ts                  -- shared types
  hooks/                      -- React hooks (TanStack Query wrappers)
    index.ts
    useGridQuery.ts           -- generic: accepts raw GraphQL strings
    useGridProfile.ts         -- pre-built profile data hook
    useGridSearch.ts          -- pre-built search hook
    usePrefetchGridProfile.ts -- prefetch on hover
    useInvalidateGrid.ts      -- cache invalidation utilities
  components/                 -- React components
    index.ts
    GridProvider.tsx           -- config context (endpoint, auth)
    ThumbnailHoverCard.tsx    -- profile info hover card
  generated/                  -- Graffle-generated types (gitignored)
    graffle/
```

### Key Architecture Decisions

- **Layered**: `core/` is framework-agnostic. `hooks/` and `components/` depend on React.
- **No QueryClientProvider**: The consumer provides their own. grid-kit hooks use the consumer's QueryClient.
- **GridProvider**: Separate React context for grid-kit config (endpoint URL, API key, headers). Required wrapper.
- **peerDependencies**: react, react-dom, @tanstack/react-query (consumer provides these)
- **dependencies**: graffle (consumer unlikely to have this)
- **Evaluate**: axios may be unnecessary if Graffle handles all HTTP transport

### Entry Points (package.json exports)

```
grid-kit          -- everything (re-exports hooks + components)
grid-kit/core     -- framework-agnostic (Graffle client, types, query keys)
grid-kit/hooks    -- React hooks only
grid-kit/components -- React components only
```

## Build & Dev Commands

```bash
bun install          # install dependencies
bun run build        # tsup build (ESM + CJS + .d.ts)
bun run dev          # tsup --watch
bun run storybook    # storybook dev -p 6006
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run test         # bun test
```

## GraphQL Schema

- Schema Endpoint: `https://tgs.thegrid.id/v1/graphql` (Hasura)
- GraphQL Endpoint: `https://beta.node.thegrid.id/graphql`
- Introspection enabled
- Key entities: `products`, `assets` (both have name, type, status fields)
- Hasura patterns: `where` clauses with `_eq`, `_ilike`, `_in`; `order_by`; `limit`/`offset`; `_by_pk` for single lookups; `_aggregate` for aggregations
- Type generation: `npx graffle generate` (reads from endpoint, outputs to `src/generated/graffle/`)

## Graffle Usage

Two query approaches:

1. **Raw strings** (copy/paste from Hasura console): `client.gql\`query { ... }\`.send(vars)`
2. **Schema-driven** (typed builder): `client.query.products({ $: { limit: 10 }, id: true, name: true })`

The `useGridQuery` hook wraps approach #1 for the "paste from Hasura" workflow.

## TanStack Query Patterns

- Query keys namespaced under `['grid', ...]` via `gridKeys` factory
- Default `staleTime`: 5 min for entities, 1 min for lists
- Export `queryOptions()` factories for SSR prefetching
- Export `gridKeys` so consumers can invalidate cache
- Use `enabled` pattern for conditional fetching

## Package Publishing

- `"type": "module"` + `"sideEffects": false`
- Dual ESM + CJS output via tsup
- `"files": ["dist", "README.md"]`
- Pre-publish checks: `npm pack --dry-run`, `publint`, `attw --pack`, `size-limit`
- Types condition must be FIRST in each exports block

## MCP Tools (for development/research)

- `mcp__grid__query` -- run arbitrary GraphQL against The Grid
- `mcp__grid__find` -- convenience search for products/assets

## Testing

- Storybook for visual component testing
- bun test for unit tests
- TanStack Query test utilities with `renderHook` + custom wrapper providing QueryClient + GridProvider
- Playground app at root for e2e manual testing (`bun run dev`)
