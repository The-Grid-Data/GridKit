# grid-kit

React hooks and helpers for querying [The Grid](https://thegrid.id) GraphQL API. Paste a query from the Hasura console, get typed data back with caching, filters, and pagination built in.

## Install

```bash
npm install grid-kit
```

Peer dependencies (your app provides these):

```bash
npm install react @tanstack/react-query
```

## Setup

Wrap your app with TanStack Query's `QueryClientProvider` and grid-kit's `GridProvider`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GridProvider } from 'grid-kit'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GridProvider config={{ endpoint: 'https://beta.node.thegrid.id/graphql' }}>
        <YourApp />
      </GridProvider>
    </QueryClientProvider>
  )
}
```

`GridProvider` accepts a `config` object:

```ts
interface GridConfig {
  endpoint: string                    // GraphQL endpoint URL
  apiKey?: string                     // Optional API key (sent as x-api-key header)
  headers?: Record<string, string>    // Optional additional headers
}
```

---

## 1. Fetching data with `useGridQuery`

Write a GraphQL query (same syntax you'd use in the Hasura console), pass it to `useGridQuery`, and get back a TanStack Query result:

```tsx
import { useGridQuery } from 'grid-kit'

const PRODUCTS_QUERY = `query GetProducts {
  products(limit: 5) {
    id
    name
    type
    status
  }
}`

function ProductList() {
  const { data, isLoading, error } = useGridQuery(PRODUCTS_QUERY)

  if (isLoading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {data.products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

### Variables

Pass a variables object as the second argument:

```tsx
const QUERY = `query SearchProfiles($where: ProfileInfosBoolExp, $limit: Int) {
  profileInfos(where: $where, limit: $limit) {
    id
    name
  }
}`

const { data } = useGridQuery(QUERY, { where: {}, limit: 10 })
```

### Options

The third argument accepts any TanStack Query options (`enabled`, `staleTime`, `placeholderData`, etc.):

```tsx
const { data } = useGridQuery(QUERY, variables, {
  enabled: !!searchTerm,      // only fetch when there's a search term
  staleTime: 5 * 60_000,      // cache for 5 minutes (default is 1 minute)
})
```

### Type parameter

Pass a type parameter for typed `data`:

```tsx
interface ProductsResult {
  products: Array<{ id: string; name: string }>
}

const { data } = useGridQuery<ProductsResult>(PRODUCTS_QUERY)
// data is typed as ProductsResult
```

---

## 2. Building filter queries with `buildProfileWhere`

`buildProfileWhere` converts a filter state object into a Hasura `where` clause you can pass as a variable:

```tsx
import { useGridQuery, buildProfileWhere } from 'grid-kit'
import type { ProfileWhereFilters } from 'grid-kit'

const SEARCH_QUERY = `query SearchProfiles($where: ProfileInfosBoolExp, $limit: Int, $offset: Int) {
  profileInfos(where: $where, limit: $limit, offset: $offset, order_by: {name: Asc}) {
    id
    name
    profileType { id name }
    profileSector { id name }
    profileStatus { id name }
  }
}`

function ProfileSearch() {
  const [filters, setFilters] = useState<ProfileWhereFilters>({
    types: ['2'],
    sectors: [],
    statuses: [],
    tags: [],
    search: 'solar',
  })

  const where = buildProfileWhere(filters)
  const { data } = useGridQuery(SEARCH_QUERY, { where, limit: 25, offset: 0 })

  return /* render data.profileInfos */
}
```

`ProfileWhereFilters` accepts:

```ts
interface ProfileWhereFilters {
  types?: string[]      // profileType IDs
  sectors?: string[]    // profileSector IDs
  statuses?: string[]   // profileStatus IDs
  tags?: string[]       // tag IDs
  search?: string       // name substring match
}
```

When multiple fields are set, they're combined with `_and`. Empty/undefined fields are ignored.

---

## 3. Getting filter options with `useGridFilterOptions`

`useGridFilterOptions` fetches all available filter dimensions in a single query (cached for 30 minutes):

```tsx
import { useGridFilterOptions } from 'grid-kit'

function FilterPanel() {
  const { data: filters, isLoading } = useGridFilterOptions()

  if (isLoading || !filters) return <p>Loading filters...</p>

  return (
    <div>
      <h3>Profile Types</h3>
      {filters.profileTypes.map((opt) => (
        <button key={opt.id}>{opt.name}</button>
      ))}

      <h3>Sectors</h3>
      {filters.profileSectors.map((opt) => (
        <button key={opt.id}>{opt.name}</button>
      ))}

      {/* filters.profileStatuses, filters.tags, etc. */}
    </div>
  )
}
```

The returned `FilterMetadata` type:

```ts
interface FilterMetadata {
  profileTypes: FilterOption[]
  profileSectors: FilterOption[]
  profileStatuses: FilterOption[]
  productTypes: FilterOption[]
  productStatuses: FilterOption[]
  assetTypes: FilterOption[]
  assetStatuses: FilterOption[]
  tagTypes: FilterOption[]
  tags: TagOption[]          // tags include tagType for grouping
}

interface FilterOption { id: string; name: string }
interface TagOption extends FilterOption { tagType: FilterOption | null }
```

---

## 4. Showing live filter counts with `buildFacetCountQuery`

When users select filters, you can show how many results each option would return. `buildFacetCountQuery` builds an aliased aggregate query that counts each option using cross-filtering (each dimension's counts reflect the other active filters, not its own):

```tsx
import { useMemo } from 'react'
import { useGridQuery, useGridFilterOptions, buildFacetCountQuery, buildProfileWhere } from 'grid-kit'
import type { ProfileWhereFilters, ProfileFacetCounts } from 'grid-kit'

function SearchWithCounts() {
  const { data: metadata } = useGridFilterOptions()

  const [filters, setFilters] = useState<ProfileWhereFilters>({
    types: [], sectors: [], statuses: [], tags: [],
  })

  // Build the facet count query from current filters + metadata
  const facetQuery = useMemo(
    () => metadata ? buildFacetCountQuery(filters, metadata) : null,
    [filters, metadata],
  )

  // Execute the generated query
  const { data: rawCounts } = useGridQuery<Record<string, { _count: number }>>(
    facetQuery?.query ?? '',
    undefined,
    { enabled: !!facetQuery },
  )

  // Parse aliased response into typed counts
  const counts: ProfileFacetCounts | undefined = useMemo(
    () => rawCounts && facetQuery ? facetQuery.parse(rawCounts) : undefined,
    [rawCounts, facetQuery],
  )

  return (
    <div>
      {metadata?.profileTypes.map((opt) => (
        <button key={opt.id}>
          {opt.name} ({counts?.types[opt.id] ?? '...'})
        </button>
      ))}
      {counts && <p>Total matching: {counts.total}</p>}
    </div>
  )
}
```

The parsed `ProfileFacetCounts` type:

```ts
interface ProfileFacetCounts {
  types: Record<string, number>      // profileType id → count
  sectors: Record<string, number>    // profileSector id → count
  statuses: Record<string, number>   // profileStatus id → count
  tags: Record<string, number>       // tag id → count
  total: number                      // total matching all active filters
}
```

---

## 5. Pagination

Use `limit` and `offset` variables with page state. Reset to page 0 when filters change, and use `keepPreviousData` to avoid layout flicker between pages:

```tsx
import { useState, useEffect, useMemo } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { useGridQuery, buildProfileWhere } from 'grid-kit'
import type { ProfileWhereFilters } from 'grid-kit'

const PAGE_SIZE = 25

const QUERY = `query SearchProfiles($where: ProfileInfosBoolExp, $limit: Int, $offset: Int) {
  profileInfos(where: $where, limit: $limit, offset: $offset, order_by: {name: Asc}) {
    id
    name
  }
}`

function PaginatedSearch() {
  const [filters, setFilters] = useState<ProfileWhereFilters>({ types: ['2'] })
  const [page, setPage] = useState(0)

  const where = useMemo(() => buildProfileWhere(filters), [filters])

  // Reset to first page when filters change
  useEffect(() => { setPage(0) }, [where])

  const { data, isFetching } = useGridQuery<{ profileInfos: Array<{ id: string; name: string }> }>(
    QUERY,
    { where, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { placeholderData: keepPreviousData },
  )

  const results = data?.profileInfos ?? []

  return (
    <div>
      <ul>
        {results.map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>

      <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
        Prev
      </button>
      <span>Page {page + 1}</span>
      <button disabled={results.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
        Next
      </button>

      {isFetching && <span>Loading...</span>}
    </div>
  )
}
```

Disable "Next" when `results.length < PAGE_SIZE` -- that means you've reached the last page.

---

## API reference

### Hooks

| Export | Import path | Description |
|---|---|---|
| `useGridQuery(query, variables?, options?)` | `grid-kit` or `grid-kit/hooks` | Execute a raw GraphQL query with caching |
| `useGridFilterOptions(options?)` | `grid-kit` or `grid-kit/hooks` | Fetch all filter dimensions (types, sectors, statuses, tags) |
| `extractOperationName(query)` | `grid-kit` or `grid-kit/hooks` | Parse the operation name from a GraphQL string |

### Components

| Export | Import path | Description |
|---|---|---|
| `GridProvider` | `grid-kit` or `grid-kit/components` | Config context provider (endpoint, auth) |
| `useGridConfig()` | `grid-kit` or `grid-kit/components` | Access the GridProvider config |
| `ProfileHoverCard` | `grid-kit` or `grid-kit/components` | Hover card showing profile summary + thumbnail |

### Core (framework-agnostic)

| Export | Import path | Description |
|---|---|---|
| `executeQuery(config, query, variables?)` | `grid-kit` or `grid-kit/core` | Raw query executor (no React needed) |
| `buildProfileWhere(filters)` | `grid-kit` or `grid-kit/core` | Convert filter state to Hasura `where` clause |
| `buildFacetCountQuery(filters, metadata)` | `grid-kit` or `grid-kit/core` | Generate cross-filtered aggregate count query |
| `gridKeys` | `grid-kit` or `grid-kit/core` | TanStack Query key factory for cache management |
| `FILTER_METADATA_QUERY` | `grid-kit` or `grid-kit/core` | Raw GraphQL string for fetching filter dimensions |
| `PROFILE_HOVER_QUERY` | `grid-kit` or `grid-kit/core` | Raw GraphQL string for profile hover data |

### Types

| Export | Import path |
|---|---|
| `GridConfig` | `grid-kit` or `grid-kit/core` |
| `FilterOption` | `grid-kit` or `grid-kit/core` |
| `TagOption` | `grid-kit` or `grid-kit/core` |
| `FilterMetadata` | `grid-kit` or `grid-kit/core` |
| `ProfileFacetCounts` | `grid-kit` or `grid-kit/core` |
| `ProfileWhereFilters` | `grid-kit` or `grid-kit/core` |
