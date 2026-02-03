# Research: The Grid GraphQL Schema & MCP Capabilities

## 1. Overview

The Grid is a platform with a GraphQL API served by **Hasura** (a GraphQL engine on top of PostgreSQL). The schema endpoint is hosted at `tgs.thegrid.id`. The goal of the `grid-kit` package is to provide React hooks and components for querying and displaying Grid data.

---

## 2. GraphQL Endpoint

**Base URL:** `https://tgs.thegrid.id`

**Likely endpoint paths (Hasura convention):**
- `https://tgs.thegrid.id/v1/graphql` -- this is the standard Hasura GraphQL endpoint
- The README confirms this is a Hasura-backed endpoint: *"devs can copy/paste from hasura"*

**Introspection:** The task document states: *"the schema of the graphql queries is found at tgs.thegrid.id (this will be upgraded later, but you can get full json here)"* -- this confirms the endpoint supports full introspection, meaning you can fetch the complete schema as JSON via a standard GraphQL introspection query.

**Standard introspection query to run:**
```graphql
{
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      name
      kind
      description
      fields {
        name
        type {
          name
          kind
          ofType { name kind }
        }
      }
    }
  }
}
```

You would POST this to `https://tgs.thegrid.id/v1/graphql` with `Content-Type: application/json`.

---

## 3. MCP Server: "grid"

A connected MCP server named **"grid"** is available. It provides two tools:

### 3.1 `mcp__grid__query`
**Purpose:** Execute a GraphQL query against the Grid API.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The GraphQL query to execute |
| `variables` | object | No | Optional variables for the GraphQL query |

**Usage example:**
```
mcp__grid__query({
  query: "{ products { id name type status } }",
  variables: {}
})
```

This tool is the primary way to run arbitrary GraphQL queries against The Grid from within the Claude/MCP environment. It supports the same query syntax you would use in the Hasura console.

### 3.2 `mcp__grid__find`
**Purpose:** Find products or assets on The Grid by name, type, and/or status. This is a convenience/shortcut tool that wraps common search patterns.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lens` | enum: `"products"` or `"assets"` | Yes | The entity type to search |
| `name` | string | No | Filter by name. Supports: exact match (`value`), substring (`%value%`), multiple values (`value1,value2`) |
| `type` | string | No | Filter by type. Same matching patterns as name |
| `status` | string | No | Filter by status. Same matching patterns as name |
| `limit` | number | No | Max results to return (default: 10) |

**Usage examples:**
```
// Find all products
mcp__grid__find({ lens: "products", limit: 5 })

// Substring search for products containing "solar"
mcp__grid__find({ lens: "products", name: "%solar%" })

// Find assets by type
mcp__grid__find({ lens: "assets", type: "wind", status: "active" })
```

---

## 4. Known Schema Structure (from MCP tool signatures)

Based on the `mcp__grid__find` tool's parameter definitions, we can infer the following about the schema:

### Core Entity Types

**Products**
- Has fields: `name`, `type`, `status` (at minimum)
- Likely has: `id`, timestamps, relational fields

**Assets**
- Has fields: `name`, `type`, `status` (at minimum)
- Likely has: `id`, timestamps, relational fields

### Hasura-Specific Schema Patterns

Since the backend is Hasura, the schema will follow Hasura conventions:
- **Query root type:** `query_root`
- **Mutation root type:** `mutation_root` (if mutations are exposed)
- **Subscription root type:** `subscription_root` (if subscriptions are exposed)
- Each table gets auto-generated queries: `<table>` (list), `<table>_by_pk` (by primary key), `<table>_aggregate` (aggregations)
- Filtering uses `where` clauses with operators like `_eq`, `_like`, `_ilike`, `_in`, `_gt`, `_lt`, etc.
- Sorting via `order_by`
- Pagination via `limit` and `offset`

**Typical Hasura query pattern:**
```graphql
query {
  products(
    where: { status: { _eq: "active" }, name: { _ilike: "%solar%" } }
    order_by: { name: asc }
    limit: 10
    offset: 0
  ) {
    id
    name
    type
    status
    created_at
    updated_at
  }
}
```

---

## 5. TODO: Complete Schema Discovery

To complete this research, run the following with the MCP tools:

1. **Full introspection query** via `mcp__grid__query`:
   ```graphql
   {
     __schema {
       types {
         name
         kind
         fields { name type { name kind ofType { name kind } } }
       }
     }
   }
   ```

2. **Export the schema as JSON** -- the task doc confirms you can "get full json here" from the endpoint.

3. **Enumerate all tables** by filtering introspection results for `OBJECT` kind types that are not prefixed with `__` (internal GraphQL types).

4. **Test sample queries** using `mcp__grid__find` with both `products` and `assets` lenses to see the shape of returned data.

5. **Check for authentication** -- Hasura endpoints often require an `x-hasura-admin-secret` header or JWT-based auth. The MCP server likely handles this transparently.

---

## 6. Architecture Summary

```
                 +-------------------+
                 |   Hasura Engine   |
                 | tgs.thegrid.id    |
                 | /v1/graphql       |
                 +--------+----------+
                          |
              +-----------+-----------+
              |                       |
    +---------+--------+    +---------+--------+
    | MCP Server "grid"|    | grid-kit (NPM)   |
    | - query (raw GQL)|    | - React hooks    |
    | - find (products |    | - Components     |
    |   & assets)      |    | - Graffle types  |
    +------------------+    +------------------+
```

- **tgs.thegrid.id** -- Hasura GraphQL endpoint over PostgreSQL
- **MCP "grid" server** -- Provides `query` (raw GraphQL) and `find` (convenience search) tools for local/agent use
- **grid-kit** -- NPM package being developed to provide React hooks (via Graffle + TanStack Query) and UI components (thumbnail hover cards) for consuming Grid data
