# Research: Graffle GraphQL Client

## 1. What is Graffle

**Graffle** (formerly known as `graphql-request` v6+) is a modern, minimal GraphQL client for JavaScript/TypeScript created by Jason Kuhrt. It is the spiritual successor to the widely-used `graphql-request` library, reimagined with a focus on type safety and developer experience.

### Key Characteristics

- **Minimal & Lightweight**: Designed to be a thin, zero-bloat GraphQL client -- no framework lock-in, no massive runtime
- **TypeScript-First**: Built from the ground up for TypeScript with deep type inference
- **Dual Interface**: Offers both a **document-based** interface (raw GraphQL strings) and a **schema-driven** (typed) interface
- **Extensible via "Extensions"**: Plugin system for features like retries, auth headers, etc.
- **Runs Anywhere**: Works in Node.js, Deno, Bun, and browsers

### Comparison to Other GraphQL Clients

| Feature | Graffle | urql | Apollo Client | graphql-request |
|---|---|---|---|---|
| **Bundle Size** | ~5-15 KB (core) | ~25-30 KB | ~50-100+ KB | ~5 KB |
| **Type Safety** | Built-in schema-driven types | Via codegen | Via codegen | Manual / codegen |
| **Caching** | None built-in (use TanStack Query) | Normalized + document cache | Normalized cache | None |
| **React Integration** | Via TanStack Query | Built-in hooks | Built-in hooks | Via TanStack Query |
| **Learning Curve** | Low-Medium | Medium | High | Very Low |
| **Framework Coupling** | None | Light | Heavy | None |
| **Schema-Driven Client** | Yes (first-class) | No | No | No |

### Why Graffle Over Alternatives

- **vs graphql-request**: Graffle is the next evolution. It adds type-safe schema-driven queries while keeping the simplicity
- **vs urql/Apollo**: No normalized cache (by design). If you don't need a client-side normalized cache, Graffle + TanStack Query is lighter and simpler
- **vs gql.tada**: Similar type-safety goals, but Graffle provides a functional query builder in addition to document strings

---

## 2. Type Generation

Graffle has a **code generation** step that reads your GraphQL schema and produces TypeScript types and a typed client.

### How It Works

Graffle's type generation is fundamentally different from `graphql-codegen`:

- **graphql-codegen**: Generates types for each _operation_ (query/mutation) you write
- **Graffle**: Generates types for the entire _schema_, then the client infers result types at the call site

### Codegen Setup

#### Installation

```bash
npm install graffle
```

#### CLI Generation Command

```bash
npx graffle --schema <path-or-url>
```

This can point to:
- A local `.graphql` SDL file
- A URL endpoint (introspection query)
- A JSON introspection result file

#### Configuration File

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
  outputDir: './src/graphql/graffle',
  name: 'TheGrid',
})
```

#### Generated Output Structure

Graffle generates a directory of files (not a single monolithic file):

```
src/graphql/graffle/
  index.ts          # Main entry - re-exports everything
  schema.ts         # Schema type definitions
  select.ts         # Selection set types
  modules/          # Internal module types
```

---

## 3. Schema-First Approach with Hasura

### Pointing Graffle at a Hasura Endpoint

Hasura exposes a standard GraphQL endpoint with introspection enabled. Graffle can introspect it directly.

#### Step 1: Configure Schema Source

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
})
```

#### Step 2: Generate Types

```bash
npx graffle generate
```

#### Step 3: Create a Typed Client

```typescript
import { Graffle } from './src/generated/graffle/index.js'

const client = Graffle.create({
  schema: 'https://tgs.thegrid.id/v1/graphql',
  headers: {
    'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
  },
})
```

#### Important Hasura Considerations

- **Introspection Access**: Hasura must have introspection enabled (it is by default for admin role)
- **Role-Based Schema**: Different Hasura roles see different schemas. Generate types for the role your app uses
- **Naming Conventions**: Hasura generates query/mutation names like `users`, `users_by_pk`, `insert_users`, `update_users`, etc. Graffle will type all of these

---

## 4. Custom Queries -- Copy/Paste from Hasura Console

This is a critical workflow requirement. Graffle supports **two approaches** for running queries:

### Approach A: Raw Document Strings (Copy/Paste Friendly)

Graffle supports running raw GraphQL document strings, which means developers can directly copy queries from the Hasura console.

```typescript
const result = await client.gql`
  query GetUsersByOrganization($orgId: uuid!) {
    users(where: { organization_id: { _eq: $orgId } }) {
      id
      name
      email
      created_at
      organization {
        name
      }
    }
  }
`.send({ orgId: 'some-uuid' })
```

For full type safety with document strings, combine with `TypedDocumentNode`:

```typescript
import { type TypedDocumentNode } from '@graphql-typed-document-node/core'
import { parse } from 'graphql'

type GetUsersResult = {
  users: Array<{
    id: string
    name: string
    email: string
  }>
}

type GetUsersVariables = { orgId: string }

const GET_USERS = parse(`
  query GetUsersByOrganization($orgId: uuid!) {
    users(where: { organization_id: { _eq: $orgId } }) {
      id
      name
      email
    }
  }
`) as TypedDocumentNode<GetUsersResult, GetUsersVariables>

const result = await client.gql(GET_USERS).send({ orgId: 'some-uuid' })
// result.users is fully typed
```

### Approach B: Schema-Driven (Typed) Query Builder

Graffle's unique feature -- write queries using a typed JavaScript API:

```typescript
const result = await client.query.users({
  $: {
    where: { organization_id: { _eq: 'some-uuid' } },
  },
  id: true,
  name: true,
  email: true,
  organization: {
    name: true,
  },
})
```

This approach provides:
- Full autocompletion for field names
- Type-checked filter/where clauses
- Compile-time error detection
- No need to manually type results

### Recommended Approach for grid-kit

Given the requirement that devs should copy/paste from Hasura console, **Approach A (raw document strings)** is the primary workflow. However, consider offering both:

```typescript
// For copy/paste from Hasura:
const result = await useGridQuery(gql`
  query { products(limit: 10) { id name } }
`)

// For typed queries:
const result = await client.query.products({
  $: { limit: 10 },
  id: true,
  name: true,
})
```

---

## 5. React Integration with TanStack Query

Graffle does **not** ship its own React hooks. The recommended approach is to pair it with TanStack Query.

### Pattern: Custom Hook Wrapping Both

```typescript
// src/hooks/useGridQuery.ts
import { useQuery } from '@tanstack/react-query'
import { graphqlClient } from '../client'

export function useGridQuery(query: string, variables?: Record<string, any>) {
  return useQuery({
    queryKey: ['grid', query, variables],
    queryFn: async () => {
      return graphqlClient.gql(query).send(variables)
    },
  })
}
```

### Pattern: Query Factory

```typescript
export const queries = {
  usersByOrg: (orgId: string) =>
    graphqlClient.gql`
      query GetUsersByOrganization($orgId: uuid!) {
        users(where: { organization_id: { _eq: $orgId } }) {
          id name email
        }
      }
    `.send({ orgId }),

  productById: (id: string) =>
    graphqlClient.gql`
      query GetProduct($id: uuid!) {
        products_by_pk(id: $id) {
          id name type status
        }
      }
    `.send({ id }),
}
```

---

## 6. Bundle Size

| Component | Approximate Size (minified + gzipped) |
|---|---|
| Graffle core | ~8-15 KB |
| Generated schema types | Types only (erased at compile time) |
| `graphql` peer dep | ~40 KB (often already in bundle) |

### Size Impact Assessment

For a project already using TanStack Query, adding Graffle adds approximately **8-15 KB gzipped** to the bundle. This is comparable to `graphql-request` and significantly smaller than Apollo Client or urql with React bindings.

---

## 7. Risks / Concerns

1. **Maturity**: Graffle is relatively new (rebranded/rearchitected from graphql-request). The API may still be evolving.
2. **Ecosystem**: Smaller community compared to Apollo or urql; fewer Stack Overflow answers, fewer blog posts.
3. **Raw string type safety**: Copy/pasted queries in `gql` template literals are NOT type-safe by default. Type safety requires either (a) using the schema-driven query builder or (b) manually typing results with `TypedDocumentNode`.
4. **Documentation**: As of early 2025, documentation was still maturing.
5. **`graphql` peer dependency**: The `graphql` package itself is ~40 KB. If not already in the project, this is a non-trivial addition.

---

## 8. TODO: Verify Against Live Docs

- Check current API at https://graffle.js.org
- Verify exact CLI commands and config format
- Confirm whether a dedicated Hasura integration/extension exists
- Check current bundle size at bundlephobia.com/package/graffle
