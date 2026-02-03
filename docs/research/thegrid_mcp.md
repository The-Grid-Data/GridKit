# Research: The Grid MCP (Model Context Protocol) Server

## Overview

The Grid provides an MCP server that enables programmatic access to the Grid GraphQL API from within agent/AI tool environments. This MCP is connected and available for local querying during development and research.

---

## Available Tools

### `mcp__grid__query`

**Purpose:** Execute arbitrary GraphQL queries against The Grid API.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Raw GraphQL query string (same syntax as Hasura console) |
| `variables` | object | No | Variables to pass to the query |

This is the general-purpose tool. Any query you can run in the Hasura console can be run here.

**Example:**
```json
{
  "query": "query GetProducts($limit: Int) { products(limit: $limit) { id name type status } }",
  "variables": { "limit": 5 }
}
```

### `mcp__grid__find`

**Purpose:** Convenience search tool for finding products or assets.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lens` | `"products"` or `"assets"` | Yes | Which entity type to search |
| `name` | string | No | Name filter (exact, substring `%val%`, or multi `val1,val2`) |
| `type` | string | No | Type filter (same patterns) |
| `status` | string | No | Status filter (same patterns) |
| `limit` | number | No | Max results (default: 10) |

**Example:**
```json
{
  "lens": "products",
  "name": "%solar%",
  "status": "active",
  "limit": 5
}
```

---

## How This Relates to grid-kit

The MCP server serves two purposes for the grid-kit project:

1. **Research & Discovery**: Use `mcp__grid__query` with introspection queries to discover the full schema, understand table structures, and test queries before building hooks.

2. **Pattern Validation**: The MCP's `find` tool reveals the query patterns (filtering by name/type/status with wildcards) that real consumers will want. The grid-kit hooks should support similar patterns.

---

## TODO: Live Queries to Run

When MCP permissions are available, execute these to document the schema:

```graphql
# 1. Full schema introspection
{ __schema { types { name kind fields { name type { name kind ofType { name kind } } } } } }

# 2. Sample products query
{ products(limit: 3) { id name type status } }

# 3. Sample assets query
{ assets(limit: 3) { id name type status } }

# 4. Check available root queries
{ __schema { queryType { fields { name description } } } }
```
