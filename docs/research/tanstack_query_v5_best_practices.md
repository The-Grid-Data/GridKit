# TanStack Query v5 -- Best Practices for Building an NPM Package

Research document for grid-kit: an NPM package providing data-fetching hooks
backed by TanStack Query and GraphQL (via Graffle).

---

## Table of Contents

1. [Caching Strategies](#1-caching-strategies)
2. [Cache Invalidation](#2-cache-invalidation)
3. [Best Practices for Library Authors](#3-best-practices-for-library-authors)
4. [Integration with GraphQL](#4-integration-with-graphql)
5. [Prefetching and SSR](#5-prefetching-and-ssr)
6. [Bundle Size Impact](#6-bundle-size-impact)
7. [Actionable Recommendations for grid-kit](#7-actionable-recommendations-for-grid-kit)

---

## 1. Caching Strategies

### 1.1 Important Defaults (TanStack Query v5)

TanStack Query ships with aggressive defaults designed for interactive apps.
Library authors must understand these to set appropriate overrides.

| Option                   | Default Value | What It Does |
|--------------------------|---------------|--------------|
| `staleTime`              | `0`           | Data is considered stale immediately after fetching. Any component mounting with the same query key triggers a background refetch. |
| `gcTime`                 | `5 * 60 * 1000` (5 min) | Inactive query data is garbage-collected after 5 minutes. Renamed from `cacheTime` in v5. |
| `refetchOnWindowFocus`   | `true`        | Refetches stale queries when the browser tab regains focus. |
| `refetchOnMount`         | `true`        | Refetches stale queries every time a component using that query mounts. |
| `refetchOnReconnect`     | `true`        | Refetches stale queries when network reconnects. |
| `retry`                  | `3`           | Failed queries retry 3 times with exponential backoff. |
| `retryDelay`             | Exponential backoff: `Math.min(1000 * 2 ** attempt, 30000)` | |
| `structuralSharing`      | `true`        | Referentially stable data -- only changed parts get new references. Enables efficient React re-renders. |

### 1.2 staleTime Strategy

**Key insight**: `staleTime: 0` (default) is correct for user-facing apps where
data freshness matters. For a **library**, you want to give consumers control but
provide sensible defaults.

```typescript
// RECOMMENDED: Library hook with a sensible default staleTime
// that consumers can override
export function useGridCompany(id: string, options?: { staleTime?: number }) {
  return useQuery({
    queryKey: ['grid', 'company', id],
    queryFn: () => fetchCompany(id),
    staleTime: options?.staleTime ?? 30_000, // 30 seconds default
    // Let consumers override but don't use 0 -- it causes excessive
    // refetching which is unfriendly for a library
  });
}
```

**Recommended staleTime values by data type**:

| Data Category | Recommended staleTime | Rationale |
|---------------|----------------------|-----------|
| Rarely changing (company profiles, metadata) | `5 * 60 * 1000` (5 min) | Company data doesn't change frequently |
| Moderately changing (lists, search results) | `60 * 1000` (1 min) | Balance freshness vs. network cost |
| Frequently changing (real-time metrics) | `0` to `10_000` | Needs to be fresh |
| Static/reference data (enums, schemas) | `Infinity` | Never refetch automatically |

### 1.3 gcTime Strategy

`gcTime` controls how long inactive (no observers/mounted components) query data
stays in the cache before garbage collection.

- **Default 5 minutes** is reasonable for most cases.
- For a library: keep the default. Don't set it too high or you'll bloat the
  consumer's memory.
- Setting `gcTime: 0` means data is removed the instant the last component
  unmounts -- bad for navigation-heavy apps.
- `gcTime` must always be >= `staleTime`, otherwise data gets garbage-collected
  while still considered "fresh" (nonsensical).

### 1.4 refetchOnWindowFocus and refetchOnMount

For a **library package**, these should generally be left at their defaults (`true`)
so consumer applications get automatic refresing. However, the library should
allow consumers to override:

```typescript
// Let defaults flow through from the consumer's QueryClient
// Don't hardcode refetchOnWindowFocus: false in library hooks
export function useGridQuery<T>(options: UseGridQueryOptions<T>) {
  return useQuery({
    ...options,
    // Only set what the library needs to control
    queryKey: ['grid', ...options.queryKey],
    // Leave refetchOnWindowFocus, refetchOnMount to consumer's
    // QueryClient defaultOptions
  });
}
```

---

## 2. Cache Invalidation

### 2.1 Query Key Patterns

TanStack Query v5 uses **query key factories** as the recommended pattern.
Query keys are arrays, and invalidation works on prefix matching.

```typescript
// query-keys.ts -- Export this from the library so consumers
// can use it for custom invalidation

export const gridKeys = {
  all: ['grid'] as const,
  companies: () => [...gridKeys.all, 'company'] as const,
  company: (id: string) => [...gridKeys.companies(), id] as const,
  companyDetail: (id: string) => [...gridKeys.company(id), 'detail'] as const,
  companyMetrics: (id: string) => [...gridKeys.company(id), 'metrics'] as const,

  searches: () => [...gridKeys.all, 'search'] as const,
  search: (query: string, filters?: Record<string, unknown>) =>
    [...gridKeys.searches(), query, filters] as const,

  // For GraphQL: include the operation name and variables
  graphql: (operationName: string, variables?: Record<string, unknown>) =>
    [...gridKeys.all, 'graphql', operationName, variables] as const,
} as const;
```

**Why this pattern matters**:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { gridKeys } from '@thegrid/grid-kit';

const queryClient = useQueryClient();

// Invalidate ALL grid-kit queries
queryClient.invalidateQueries({ queryKey: gridKeys.all });

// Invalidate all company queries
queryClient.invalidateQueries({ queryKey: gridKeys.companies() });

// Invalidate a specific company
queryClient.invalidateQueries({ queryKey: gridKeys.company('abc-123') });
```

### 2.2 invalidateQueries

`invalidateQueries` marks matching queries as stale and triggers a refetch for
any that are currently mounted. Key behaviors:

- **Prefix matching by default**: `queryKey: ['grid']` invalidates `['grid', 'company', '123']`.
- **exact: true** option disables prefix matching.
- Returns a Promise that resolves when all active queries finish refetching.

```typescript
// Exported utility for consumers
export function useInvalidateGrid() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () =>
      queryClient.invalidateQueries({ queryKey: gridKeys.all }),
    invalidateCompany: (id: string) =>
      queryClient.invalidateQueries({ queryKey: gridKeys.company(id) }),
  };
}
```

### 2.3 Optimistic Updates

For mutations that affect cached data, TanStack Query supports optimistic
updates via `onMutate`, `onError`, and `onSettled`:

```typescript
export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string; updates: Partial<Company> }) =>
      updateCompany(data.id, data.updates),

    onMutate: async (data) => {
      // Cancel any outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({
        queryKey: gridKeys.company(data.id),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData(gridKeys.companyDetail(data.id));

      // Optimistically update
      queryClient.setQueryData(
        gridKeys.companyDetail(data.id),
        (old: Company) => ({ ...old, ...data.updates })
      );

      return { previous };
    },

    onError: (_err, data, context) => {
      // Roll back on error
      if (context?.previous) {
        queryClient.setQueryData(
          gridKeys.companyDetail(data.id),
          context.previous
        );
      }
    },

    onSettled: (_data, _err, variables) => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({
        queryKey: gridKeys.company(variables.id),
      });
    },
  });
}
```

**Recommendation for grid-kit**: If the library is primarily read-only (querying
The Grid's GraphQL endpoint), optimistic updates are less relevant. Focus on
cache invalidation and staleTime instead. Only add mutation hooks if consumers
need to write data back.

---

## 3. Best Practices for Library Authors

### 3.1 QueryClientProvider: Library vs. Consumer Responsibility

**The library should NOT provide its own QueryClientProvider.**

This is the single most important architectural decision. Here is why:

1. **Shared cache**: If each library creates its own QueryClient, there's no
   shared cache. Consumers can't invalidate library queries or coordinate
   cache across multiple libraries.

2. **Configuration control**: The consumer needs to control global defaults
   like `retry`, `staleTime`, `refetchOnWindowFocus` for their entire
   application.

3. **DevTools**: React Query DevTools only inspect one QueryClient. Multiple
   clients fragment the debugging experience.

4. **SSR**: Server-side rendering requires specific QueryClient setup
   (dehydration/hydration). The consumer's framework (Next.js, Remix)
   handles this.

**Pattern: Expect the consumer to provide QueryClientProvider**

```typescript
// grid-kit/src/index.ts

// DO export hooks that use useQuery/useMutation internally
export { useGridCompany } from './hooks/useGridCompany';
export { useGridSearch } from './hooks/useGridSearch';
export { useGridQuery } from './hooks/useGridQuery';

// DO export query key factories so consumers can manage cache
export { gridKeys } from './query-keys';

// DO export types
export type { GridCompany, GridQueryOptions } from './types';

// DO NOT export or create a QueryClient
// DO NOT wrap anything in QueryClientProvider
```

**Consumer usage**:

```tsx
// In the consumer's app
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGridCompany } from '@thegrid/grid-kit';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // These defaults apply to ALL queries, including grid-kit hooks
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MyApp />
    </QueryClientProvider>
  );
}
```

### 3.2 Peer Dependencies vs. Direct Dependencies

**@tanstack/react-query MUST be a peerDependency**, not a direct dependency.

```jsonc
// package.json
{
  "peerDependencies": {
    "@tanstack/react-query": "^5.0.0",
    "react": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "@tanstack/react-query": {
      "optional": false
    }
  },
  "devDependencies": {
    "@tanstack/react-query": "^5.0.0",
    "react": "^18.0.0"
  }
}
```

**Why peerDependency**:
- Prevents duplicate copies of React Query in the bundle (which causes
  "No QueryClient set" errors due to separate React contexts).
- Consumer controls the exact version.
- Follows the same pattern as `react` itself.

### 3.3 Hook Design Patterns

**Pattern A: Thin wrapper (recommended for grid-kit)**

```typescript
// The library provides focused hooks with good defaults
// but passes through TanStack Query options for full control

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

type GridQueryOptions<T> = Omit<
  UseQueryOptions<T, Error, T, readonly unknown[]>,
  'queryKey' | 'queryFn'
> & {
  // Library-specific options
};

export function useGridCompany(
  id: string,
  options?: GridQueryOptions<Company>
) {
  return useQuery({
    queryKey: gridKeys.company(id),
    queryFn: () => gridClient.query(COMPANY_QUERY, { id }),
    staleTime: 5 * 60 * 1000,
    ...options, // Consumer can override staleTime, enabled, select, etc.
  });
}
```

**Pattern B: Generic GraphQL hook (also needed for grid-kit)**

Since grid-kit lets developers "paste a custom GraphQL query," provide a
generic hook:

```typescript
export function useGridGraphQL<TData = unknown, TVariables = Record<string, unknown>>(
  query: string, // raw GraphQL query string
  variables?: TVariables,
  options?: GridQueryOptions<TData>
) {
  // Extract operation name for the query key
  const operationName = extractOperationName(query) ?? 'anonymous';

  return useQuery({
    queryKey: gridKeys.graphql(operationName, variables as Record<string, unknown>),
    queryFn: () => gridClient.execute<TData>(query, variables),
    staleTime: 60_000,
    ...options,
  });
}

function extractOperationName(query: string): string | null {
  const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
  return match?.[1] ?? null;
}
```

### 3.4 Configuration Provider (for API endpoint/auth, NOT QueryClient)

While you should NOT provide a QueryClientProvider, you DO need a way for
consumers to configure the library (API URL, auth tokens, etc.). Use a
separate React context:

```typescript
// GridProvider.tsx
import { createContext, useContext, type ReactNode } from 'react';

interface GridConfig {
  endpoint: string;    // e.g., 'https://tgs.thegrid.id/v1/graphql'
  apiKey?: string;
  headers?: Record<string, string>;
}

const GridContext = createContext<GridConfig | null>(null);

export function GridProvider({
  config,
  children,
}: {
  config: GridConfig;
  children: ReactNode;
}) {
  return (
    <GridContext.Provider value={config}>
      {children}
    </GridContext.Provider>
  );
}

export function useGridConfig(): GridConfig {
  const config = useContext(GridContext);
  if (!config) {
    throw new Error(
      'useGridConfig must be used within a <GridProvider>. ' +
      'Wrap your app in <GridProvider config={{ endpoint: "..." }}>.'
    );
  }
  return config;
}
```

**Consumer setup**:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GridProvider } from '@thegrid/grid-kit';

function App() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <GridProvider config={{ endpoint: 'https://tgs.thegrid.id/v1/graphql' }}>
        <MyApp />
      </GridProvider>
    </QueryClientProvider>
  );
}
```

### 3.5 The `enabled` Pattern

Always support conditional fetching via the `enabled` option. This is
critical for hooks that depend on data from other hooks:

```typescript
export function useGridCompany(
  id: string | undefined,
  options?: GridQueryOptions<Company>
) {
  return useQuery({
    queryKey: gridKeys.company(id!),
    queryFn: () => gridClient.query(COMPANY_QUERY, { id: id! }),
    enabled: !!id && (options?.enabled !== false),
    // ^ Only fetch when id is defined AND consumer hasn't disabled it
    ...options,
  });
}
```

---

## 4. Integration with GraphQL

### 4.1 TanStack Query + GraphQL Architecture

TanStack Query is **transport-agnostic**. It doesn't care whether you use REST,
GraphQL, gRPC, or anything else. The `queryFn` is just an async function that
returns data. This is a strength: you get all of TanStack's caching and state
management without being locked into a GraphQL-specific client like Apollo.

For grid-kit, the stack is:
```
useQuery (TanStack)  -->  Graffle (GraphQL client)  -->  The Grid API
```

### 4.2 Query Key Conventions for GraphQL

Unlike REST where URLs naturally map to query keys, GraphQL needs explicit
key strategies:

```typescript
// Option 1: Operation name + variables (RECOMMENDED)
queryKey: ['grid', 'graphql', 'GetCompany', { id: '123' }]

// Option 2: Query hash + variables (for anonymous queries)
queryKey: ['grid', 'graphql', hashQuery(queryString), variables]

// Option 3: Domain-based (for pre-built hooks)
queryKey: ['grid', 'company', '123']
```

**Recommendation**: Use Option 1 for the generic `useGridGraphQL` hook, and
Option 3 for domain-specific hooks like `useGridCompany`.

### 4.3 Graffle Integration

Graffle (formerly `graphql-request` successor / `genql` lineage) provides
type-safe GraphQL operations. The integration with TanStack Query:

```typescript
// grid-client.ts
import { Graffle } from 'graffle';

export function createGridClient(config: GridConfig) {
  return Graffle.create({
    schema: new URL(config.endpoint),
    transport: {
      headers: {
        ...(config.apiKey && { 'x-api-key': config.apiKey }),
        ...config.headers,
      },
    },
  });
}

// For raw query strings (copy-paste from Hasura):
export async function executeRawQuery<T>(
  client: ReturnType<typeof createGridClient>,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await client.rawString({
    document: query,
    variables,
  });

  if (response.errors?.length) {
    throw new GraphQLError(response.errors);
  }

  return response.data as T;
}
```

### 4.4 Normalized Cache Considerations

TanStack Query uses a **document cache** (keyed by query key), NOT a normalized
cache like Apollo. This means:

- The same entity fetched by two different queries is stored twice.
- Updating entity in one query does not auto-update it in another.
- You must use `invalidateQueries` to keep data in sync.

**For grid-kit this is fine** because:
- The library is primarily read-only.
- Document caching is simpler, faster, and has a smaller bundle size.
- Normalized caching adds significant complexity for minimal benefit in
  read-heavy scenarios.

---

## 5. Prefetching and SSR

### 5.1 SSR Compatibility

For grid-kit to work in SSR frameworks (Next.js App Router, Remix, etc.),
follow these rules:

1. **Never call `useQuery` at module scope** -- only inside components/hooks.
2. **Don't create a singleton QueryClient** -- let the consumer manage it.
3. **Export query options factories** so consumers can prefetch:

```typescript
// Export queryOptions factories (TanStack Query v5 pattern)
import { queryOptions } from '@tanstack/react-query';

export function gridCompanyQueryOptions(id: string) {
  return queryOptions({
    queryKey: gridKeys.company(id),
    queryFn: () => gridClient.query(COMPANY_QUERY, { id }),
    staleTime: 5 * 60 * 1000,
  });
}
```

**Consumer can then prefetch in a server component or loader**:

```typescript
// Next.js App Router example
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { gridCompanyQueryOptions } from '@thegrid/grid-kit';

export default async function CompanyPage({ params }) {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(gridCompanyQueryOptions(params.id));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CompanyView id={params.id} />
    </HydrationBoundary>
  );
}
```

### 5.2 Prefetching Patterns

For client-side prefetching (e.g., hovering over a company thumbnail):

```typescript
export function usePrefetchGridCompany() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery(gridCompanyQueryOptions(id));
  };
}

// Usage in the thumbnail component:
function CompanyThumbnail({ id }: { id: string }) {
  const prefetch = usePrefetchGridCompany();

  return (
    <div onMouseEnter={() => prefetch(id)}>
      {/* thumbnail content */}
    </div>
  );
}
```

This is directly relevant to grid-kit's "thumbnail hover to display company
information" use case.

---

## 6. Bundle Size Impact

### 6.1 Package Sizes

| Package | Minified | Minified + gzipped | Notes |
|---------|----------|-------------------|-------|
| `@tanstack/query-core` | ~38 KB | ~11 KB | Core logic, framework-agnostic |
| `@tanstack/react-query` | ~12 KB | ~3.5 KB | React bindings (imports query-core) |
| **Total** | **~50 KB** | **~14.5 KB** | What consumers add to their bundle |

*Sizes are approximate for v5.x and vary by version. Tree-shaking can
reduce actual impact.*

### 6.2 Impact as a Peer Dependency

Since `@tanstack/react-query` is a **peerDependency** of grid-kit:

- If the consumer already uses TanStack Query: **zero additional cost**.
- If the consumer doesn't: they add ~14.5 KB gzipped. This is very
  reasonable -- smaller than alternatives like Apollo Client (~45 KB gzipped).

### 6.3 Minimizing grid-kit's Own Bundle Size

Recommendations:

1. **Tree-shakeable exports**: Use named exports, no barrel files with
   side effects.
2. **Mark as side-effect-free** in package.json:
   ```json
   { "sideEffects": false }
   ```
3. **Don't bundle dependencies**: Use Rollup/tsup with `external` for all
   peer and regular dependencies.
4. **Provide ESM and CJS**:
   ```json
   {
     "type": "module",
     "main": "./dist/index.cjs",
     "module": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": {
         "import": "./dist/index.js",
         "require": "./dist/index.cjs",
         "types": "./dist/index.d.ts"
       }
     }
   }
   ```
5. **Avoid importing the entirety of large packages** -- import specific
   functions:
   ```typescript
   // GOOD
   import { useQuery } from '@tanstack/react-query';
   // BAD (if it existed)
   import * as ReactQuery from '@tanstack/react-query';
   ```

### 6.4 Comparing Alternatives

| Library | Bundle (min+gzip) | Normalized Cache | Framework Agnostic | DevTools |
|---------|-------------------|------------------|-------------------|----------|
| TanStack Query v5 | ~14.5 KB | No (document) | Yes | Yes |
| Apollo Client | ~45 KB | Yes | No (React only) | Yes |
| urql | ~14 KB | Optional | Yes | Yes |
| SWR | ~4.5 KB | No | No (React only) | No |

TanStack Query is the right choice for grid-kit: comparable size to urql,
far smaller than Apollo, much more feature-rich than SWR.

---

## 7. Actionable Recommendations for grid-kit

### 7.1 Architecture Decision Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| QueryClientProvider | Consumer provides | Shared cache, consumer control, SSR compat |
| @tanstack/react-query | peerDependency | Prevent duplicates, consumer controls version |
| Configuration | GridProvider context | Separate concern from query caching |
| Query keys | Factory pattern with 'grid' prefix | Enables prefix-based invalidation, namespacing |
| Default staleTime | 5 min for entities, 1 min for lists | Company data is relatively stable |
| GraphQL cache | Document cache (TanStack default) | Simpler, sufficient for read-heavy use case |
| SSR support | Export queryOptions factories | Consumers can prefetch in server components |
| Bundle format | ESM + CJS via tsup/bun build | Maximum compatibility |

### 7.2 Exports Checklist

The package should export:

```typescript
// Hooks
export { useGridQuery } from './hooks/useGridQuery';         // Generic GraphQL hook
export { useGridCompany } from './hooks/useGridCompany';     // Pre-built company hook
export { useGridSearch } from './hooks/useGridSearch';        // Pre-built search hook
export { usePrefetchGridCompany } from './hooks/usePrefetchGridCompany';

// Query Options Factories (for SSR prefetching)
export { gridCompanyQueryOptions } from './hooks/useGridCompany';

// Query Key Factory (for consumer cache management)
export { gridKeys } from './query-keys';

// Cache Utilities
export { useInvalidateGrid } from './hooks/useInvalidateGrid';

// Configuration
export { GridProvider, useGridConfig } from './GridProvider';

// Components
export { CompanyThumbnail } from './components/CompanyThumbnail';

// Types
export type { GridConfig, GridQueryOptions } from './types';
```

### 7.3 Consumer Quick Start (what the DX should look like)

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GridProvider, useGridCompany, useGridQuery } from '@thegrid/grid-kit';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GridProvider config={{ endpoint: 'https://tgs.thegrid.id/v1/graphql' }}>
        <Dashboard />
      </GridProvider>
    </QueryClientProvider>
  );
}

function Dashboard() {
  // Pre-built hook
  const { data: company, isLoading } = useGridCompany('abc-123');

  // Custom GraphQL query (copy-paste from Hasura)
  const { data: custom } = useGridQuery(`
    query GetFunding($companyId: uuid!) {
      funding_rounds(where: { company_id: { _eq: $companyId } }) {
        id
        amount
        round_type
        date
      }
    }
  `, { companyId: 'abc-123' });

  return (/* ... */);
}
```

### 7.4 Testing Recommendations

For testing hooks in the library itself, use TanStack Query's test utilities:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry in tests
        gcTime: 0,    // Immediate GC in tests
      },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <GridProvider config={{ endpoint: 'http://test.api' }}>
        {children}
      </GridProvider>
    </QueryClientProvider>
  );
}

test('useGridCompany fetches company data', async () => {
  const { result } = renderHook(
    () => useGridCompany('test-id'),
    { wrapper: createWrapper() }
  );

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toMatchObject({ id: 'test-id' });
});
```

### 7.5 Version Compatibility Notes

- TanStack Query v5 requires React 18+.
- v5 breaking changes from v4: `cacheTime` renamed to `gcTime`, `useQuery`
  no longer accepts positional arguments (object syntax only), `isLoading`
  renamed to `isPending` (with `isLoading` = `isPending && isFetching`),
  `onSuccess`/`onError`/`onSettled` removed from `useQuery` (still on
  `useMutation`).
- Specify `"@tanstack/react-query": "^5.0.0"` as peerDependency to avoid
  v4 incompatibilities.

---

## Sources and References

- TanStack Query v5 documentation: https://tanstack.com/query/latest/docs
- TanStack Query v5 Important Defaults: https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
- TanStack Query v5 Caching Guide: https://tanstack.com/query/latest/docs/framework/react/guides/caching
- TanStack Query v5 SSR Guide: https://tanstack.com/query/latest/docs/framework/react/guides/ssr
- TanStack Query v5 Query Keys: https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
- TanStack Query v5 Optimistic Updates: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- Bundlephobia @tanstack/react-query: https://bundlephobia.com/package/@tanstack/react-query
- TKDodo's Blog (TanStack Query maintainer): https://tkdodo.eu/blog/practical-react-query
