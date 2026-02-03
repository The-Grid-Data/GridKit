# SKILLS.md - grid-kit Build Skills

Technical skills and patterns required to build grid-kit, synthesized from research.

---

## Skill: NPM Library Packaging with tsup

**When**: Building/configuring the package output

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'hooks/index': 'src/hooks/index.ts',
    'components/index': 'src/components/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom', '@tanstack/react-query'],
  minify: false,
  target: 'es2020',
})
```

### package.json exports pattern

```jsonc
{
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./core": {
      "import": { "types": "./dist/core/index.d.ts", "default": "./dist/core/index.js" },
      "require": { "types": "./dist/core/index.d.cts", "default": "./dist/core/index.cjs" }
    },
    "./hooks": {
      "import": { "types": "./dist/hooks/index.d.ts", "default": "./dist/hooks/index.js" },
      "require": { "types": "./dist/hooks/index.d.cts", "default": "./dist/hooks/index.cjs" }
    },
    "./components": {
      "import": { "types": "./dist/components/index.d.ts", "default": "./dist/components/index.js" },
      "require": { "types": "./dist/components/index.d.cts", "default": "./dist/components/index.cjs" }
    }
  },
  "files": ["dist", "README.md"],
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

### Rules
- `types` condition must be FIRST in each exports block
- No side effects at module top-level scope
- No barrel files that import modules with side effects
- Use `files` whitelist, never `.npmignore`

---

## Skill: Graffle GraphQL Client Setup

**When**: Setting up the GraphQL client, generating types, creating query functions

### Type generation config

```typescript
// graffle.config.ts
import { Generator } from 'graffle/generator'

export default Generator.configure({
  schema: {
    type: 'url',
    url: 'https://tgs.thegrid.id/v1/graphql',
    headers: {
      'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
    },
  },
  outputDir: './src/generated/graffle',
  name: 'TheGrid',
})
```

Run: `npx graffle generate`

### Client factory

```typescript
import { Graffle } from 'graffle'

export function createGridClient(config: { endpoint: string; headers?: Record<string, string> }) {
  return Graffle.create({
    schema: new URL(config.endpoint),
    transport: { headers: config.headers ?? {} },
  })
}
```

### Raw query execution (copy/paste from Hasura)

```typescript
const result = await client.gql`
  query GetProducts($limit: Int) {
    products(limit: $limit) { id name type status }
  }
`.send({ limit: 10 })
```

### Schema-driven query (typed builder)

```typescript
const result = await client.query.products({
  $: { where: { status: { _eq: "active" } }, limit: 10 },
  id: true,
  name: true,
  type: true,
})
```

---

## Skill: TanStack Query v5 Library Patterns

**When**: Building React hooks that wrap data fetching

### Query key factory

```typescript
export const gridKeys = {
  all: ['grid'] as const,
  companies: () => [...gridKeys.all, 'company'] as const,
  company: (id: string) => [...gridKeys.companies(), id] as const,
  searches: () => [...gridKeys.all, 'search'] as const,
  search: (query: string, vars?: Record<string, unknown>) =>
    [...gridKeys.searches(), query, vars] as const,
  graphql: (opName: string, vars?: Record<string, unknown>) =>
    [...gridKeys.all, 'graphql', opName, vars] as const,
} as const
```

### Generic GraphQL hook

```typescript
export function useGridQuery<TData = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>
) {
  const config = useGridConfig()
  const opName = extractOperationName(query) ?? 'anonymous'

  return useQuery({
    queryKey: gridKeys.graphql(opName, variables),
    queryFn: () => executeQuery<TData>(config, query, variables),
    staleTime: 60_000,
    ...options,
  })
}
```

### Pre-built domain hook

```typescript
export function useGridCompany(
  id: string | undefined,
  options?: Omit<UseQueryOptions<Company>, 'queryKey' | 'queryFn'>
) {
  const config = useGridConfig()

  return useQuery({
    queryKey: gridKeys.company(id!),
    queryFn: () => fetchCompany(config, id!),
    staleTime: 5 * 60 * 1000,
    enabled: !!id && (options?.enabled !== false),
    ...options,
  })
}
```

### queryOptions factory (for SSR)

```typescript
export function gridCompanyQueryOptions(config: GridConfig, id: string) {
  return queryOptions({
    queryKey: gridKeys.company(id),
    queryFn: () => fetchCompany(config, id),
    staleTime: 5 * 60 * 1000,
  })
}
```

### Rules
- Never provide QueryClientProvider -- consumer provides it
- @tanstack/react-query is a peerDependency, never a direct dependency
- Always support `enabled` pattern for conditional fetching
- Always allow consumer to override options via spread
- Export gridKeys so consumers can manage cache invalidation
- Export queryOptions factories so consumers can prefetch for SSR

---

## Skill: GridProvider Configuration Context

**When**: Setting up the library's configuration layer

```typescript
interface GridConfig {
  endpoint: string
  apiKey?: string
  headers?: Record<string, string>
}

const GridContext = createContext<GridConfig | null>(null)

export function GridProvider({ config, children }: { config: GridConfig; children: ReactNode }) {
  return <GridContext.Provider value={config}>{children}</GridContext.Provider>
}

export function useGridConfig(): GridConfig {
  const config = useContext(GridContext)
  if (!config) throw new Error('useGridConfig must be used within <GridProvider>')
  return config
}
```

Consumer wraps their app:
```tsx
<QueryClientProvider client={queryClient}>
  <GridProvider config={{ endpoint: 'https://tgs.thegrid.id/v1/graphql' }}>
    <App />
  </GridProvider>
</QueryClientProvider>
```

---

## Skill: Hasura GraphQL Query Patterns

**When**: Writing queries against The Grid's Hasura endpoint

### List with filters
```graphql
query {
  products(
    where: { status: { _eq: "active" }, name: { _ilike: "%solar%" } }
    order_by: { name: asc }
    limit: 10
    offset: 0
  ) { id name type status created_at }
}
```

### Single lookup
```graphql
query { products_by_pk(id: "uuid-here") { id name type status } }
```

### Aggregation
```graphql
query { products_aggregate(where: { status: { _eq: "active" } }) { aggregate { count } } }
```

### Operators: `_eq`, `_neq`, `_gt`, `_lt`, `_gte`, `_lte`, `_in`, `_like`, `_ilike`, `_is_null`

---

## Skill: Prefetch on Hover (Thumbnail Component)

**When**: Building the ThumbnailHoverCard component

```typescript
export function usePrefetchGridCompany() {
  const queryClient = useQueryClient()
  const config = useGridConfig()

  return (id: string) => {
    queryClient.prefetchQuery(gridCompanyQueryOptions(config, id))
  }
}

// In component:
function ThumbnailHoverCard({ companyId }: { companyId: string }) {
  const prefetch = usePrefetchGridCompany()
  const { data } = useGridCompany(companyId)

  return (
    <div onMouseEnter={() => prefetch(companyId)}>
      {/* render company info */}
    </div>
  )
}
```

---

## Skill: Pre-Publish Validation

**When**: Before running `npm publish`

```bash
npm pack --dry-run              # verify tarball contents
npx publint                     # lint exports/main/types fields
npx attw --pack                 # verify TypeScript declaration resolution
npx size-limit                  # check bundle size budget
```

Target: < 15 KB gzipped for grid-kit's own code (excluding peer deps).
