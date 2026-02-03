# Search & Filter Support — Schema Analysis & Design

## Schema Analysis (Live Data)

The Grid's Hasura API at `tgs.thegrid.id/v1/graphql` exposes filter dimension tables as simple `{id, name}` lookups. A single query fetches all dimensions in one round-trip.

### Available Filter Dimensions

#### Profile Filters

| Dimension | Table | Count | Examples |
|-----------|-------|-------|---------|
| Type | `profileTypes` | 7 | Company, DAO, Government, Investor, NFT Collection, Project |
| Sector | `profileSectors` | 27 | Finance, Payments, Gaming, Infrastructure, Blockchain Platforms, NFTs, Security |
| Status | `profileStatuses` | 6 | Active, Announced, Closed, Inactive, Acquired |

#### Product Filters

| Dimension | Table | Count | Examples |
|-----------|-------|-------|---------|
| Type | `productTypes` | 100+ | L1, L2, L3, DEX, CEX, Wallet, Bridge, Oracle, Stablecoin Issuance, AI Agent |
| Status | `productStatuses` | 7 | Live, In Development, Early access, Open Beta, Discontinued, Support Ended |

#### Asset Filters

| Dimension | Table | Count | Examples |
|-----------|-------|-------|---------|
| Type | `assetTypes` | 15 | Currency, NFT, Governance, Memecoin, Stablecoin, Utility, Security, LSTs |
| Status | `assetStatuses` | 4 | Active, In Development, Inactive, not set |

#### Tags (Cross-Entity)

| Dimension | Table | Count | Examples |
|-----------|-------|-------|---------|
| Tag Types | `tagTypes` | 8 | Community, Event, Geography, Hackathon, Paradigm, Report, Tech |
| Tags | `tags` | ~50 | Solana, Ethereum, AI, DeFi, Bitcoin, SuperteamUK, Breakpoint 2024 |

Tags have a `tagType` relationship — each tag belongs to a category (Tech, Event, Community, etc.).

### Data Characteristics

- Total payload: ~50-100KB (small, stable)
- Change frequency: Low (new types/sectors added occasionally, tags more frequently)
- Recommended cache: 30 minutes (`staleTime: 30 * 60_000`)
- Some dimensions have empty/placeholder entries (id "0", name " ") — consumers should filter these in their UI

## The Metadata Query

```graphql
query GetFilterMetadata {
  profileTypes(order_by: {name: Asc}) { id name }
  profileSectors(order_by: {name: Asc}) { id name }
  profileStatuses(order_by: {name: Asc}) { id name }
  productTypes(order_by: {name: Asc}) { id name }
  productStatuses(order_by: {name: Asc}) { id name }
  assetTypes(order_by: {name: Asc}) { id name }
  assetStatuses(order_by: {name: Asc}) { id name }
  tagTypes(order_by: {name: Asc}) { id name }
  tags(order_by: {name: Asc}, limit: 500) { id name tagType { id name } }
}
```

## What grid-kit Provides

### Types

- `FilterOption` — `{id, name}` shape matching all dimension tables
- `TagOption` — extends FilterOption with `tagType: FilterOption | null`
- `FilterMetadata` — all 9 dimensions in one typed object
- `ProfileWhereFilters` — input shape for `buildProfileWhere`

### Hook

- `useGridFilterOptions(options?)` — fetches all filter dimensions in one call, 30min staleTime

### Where-Clause Builder

- `buildProfileWhere({ types?, sectors?, statuses?, tags?, search? })` — converts selected filter IDs into a Hasura-compatible `where` clause with `_and`, `_in`, `_ilike`

### Query Key

- `gridKeys.filterMetadata()` — `['grid', 'filterMetadata']` for cache management

## Consumer Usage Pattern

```tsx
import {
  useGridFilterOptions,
  useGridQuery,
  buildProfileWhere,
  type FilterMetadata,
} from 'grid-kit'

function ProfileSearch() {
  const { data: filters } = useGridFilterOptions()
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const where = buildProfileWhere({
    types: selectedTypes,
    search,
  })

  const { data: profiles } = useGridQuery(
    `query SearchProfiles($where: profiles_bool_exp, $limit: Int) {
      profiles(where: $where, limit: $limit, order_by: {name: Asc}) {
        id name slug
        profileType { name }
        profileSector { name }
      }
    }`,
    { where, limit: 20 },
  )

  return (
    <div>
      {/* Render filter UI from filters.profileTypes, etc. */}
      {/* Render results from profiles */}
    </div>
  )
}
```

## What the Consumer Builds (Not in grid-kit)

- Filter UI components (dropdowns, chips, checkboxes)
- Debounce logic for search input
- URL state synchronization
- Pagination (limit/offset variables)
- Faceted counts (use `useGridQuery` with `_aggregate` queries)
- Product/asset where-clause builders (add to grid-kit if demand emerges)
