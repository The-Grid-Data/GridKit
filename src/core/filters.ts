import type { FilterMetadata, ProfileFacetCounts } from './types.js'

export interface ProfileWhereFilters {
  types?: string[]
  sectors?: string[]
  statuses?: string[]
  tags?: string[]
  search?: string
}

/**
 * Build a where clause for profileInfos queries.
 *
 * Returns an object suitable for passing as a GraphQL variable:
 * ```ts
 * const where = buildProfileWhere({ types: ["2"], search: "sol" })
 * useGridQuery(SEARCH_QUERY, { where })
 * ```
 */
export function buildProfileWhere(
  filters: ProfileWhereFilters,
): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = []

  if (filters.types?.length) {
    conditions.push({ profileTypeId: { _in: filters.types } })
  }

  if (filters.sectors?.length) {
    conditions.push({ profileSectorId: { _in: filters.sectors } })
  }

  if (filters.statuses?.length) {
    conditions.push({ profileStatusId: { _in: filters.statuses } })
  }

  if (filters.tags?.length) {
    conditions.push({ root: { profileTags: { tagId: { _in: filters.tags } } } })
  }

  if (filters.search?.trim()) {
    conditions.push({ name: { _contains: filters.search.trim() } })
  }

  if (conditions.length === 0) return {}
  if (conditions.length === 1) return conditions[0]
  return { _and: conditions }
}

/**
 * Build an aliased aggregate query for faceted filter counts.
 *
 * For each option in each dimension, counts profiles matching that option
 * plus all active filters from the *other* dimensions (cross-filtering).
 *
 * Returns the query string and a `parse` function to convert the raw
 * aliased response into a typed `ProfileFacetCounts` object.
 */
export function buildFacetCountQuery(
  filters: ProfileWhereFilters,
  metadata: FilterMetadata,
): { query: string; parse: (data: Record<string, { _count: number }>) => ProfileFacetCounts } {
  const aliases: string[] = []

  const typeOptions = metadata.profileTypes.filter((o) => o.name.trim())
  const sectorOptions = metadata.profileSectors.filter((o) => o.name.trim())
  const statusOptions = metadata.profileStatuses.filter((o) => o.name.trim())
  const tagOptions = metadata.tags.filter((o) => o.name.trim())

  /** Convert a JS object to GraphQL inline literal (unquoted keys, quoted string values) */
  function toGraphQL(value: unknown): string {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) return `[${value.map(toGraphQL).join(', ')}]`
    const entries = Object.entries(value as Record<string, unknown>)
    return `{ ${entries.map(([k, v]) => `${k}: ${toGraphQL(v)}`).join(', ')} }`
  }

  function whereClause(conditions: Record<string, unknown>[]): string {
    if (conditions.length === 0) return '{}'
    if (conditions.length === 1) return toGraphQL(conditions[0])
    return toGraphQL({ _and: conditions })
  }

  /** Conditions from all dimensions *except* the excluded one, plus search */
  function crossConditions(exclude: 'types' | 'sectors' | 'statuses' | 'tags'): Record<string, unknown>[] {
    const conds: Record<string, unknown>[] = []
    if (exclude !== 'types' && filters.types?.length) {
      conds.push({ profileTypeId: { _in: filters.types } })
    }
    if (exclude !== 'sectors' && filters.sectors?.length) {
      conds.push({ profileSectorId: { _in: filters.sectors } })
    }
    if (exclude !== 'statuses' && filters.statuses?.length) {
      conds.push({ profileStatusId: { _in: filters.statuses } })
    }
    if (exclude !== 'tags' && filters.tags?.length) {
      conds.push({ root: { profileTags: { tagId: { _in: filters.tags } } } })
    }
    if (filters.search?.trim()) {
      conds.push({ name: { _contains: filters.search.trim() } })
    }
    return conds
  }

  // Type counts
  typeOptions.forEach((opt, i) => {
    const conds = [...crossConditions('types'), { profileTypeId: { _eq: opt.id } }]
    aliases.push(`type_${i}: profileInfosAggregate(filter_input: { where: ${whereClause(conds)} }) { _count }`)
  })

  // Sector counts
  sectorOptions.forEach((opt, i) => {
    const conds = [...crossConditions('sectors'), { profileSectorId: { _eq: opt.id } }]
    aliases.push(`sector_${i}: profileInfosAggregate(filter_input: { where: ${whereClause(conds)} }) { _count }`)
  })

  // Status counts
  statusOptions.forEach((opt, i) => {
    const conds = [...crossConditions('statuses'), { profileStatusId: { _eq: opt.id } }]
    aliases.push(`status_${i}: profileInfosAggregate(filter_input: { where: ${whereClause(conds)} }) { _count }`)
  })

  // Tag counts (tags live on root.profileTags)
  tagOptions.forEach((opt, i) => {
    const conds = [...crossConditions('tags'), { root: { profileTags: { tagId: { _eq: opt.id } } } }]
    aliases.push(`tag_${i}: profileInfosAggregate(filter_input: { where: ${whereClause(conds)} }) { _count }`)
  })

  // Total count with all active filters
  const totalConds: Record<string, unknown>[] = []
  if (filters.types?.length) totalConds.push({ profileTypeId: { _in: filters.types } })
  if (filters.sectors?.length) totalConds.push({ profileSectorId: { _in: filters.sectors } })
  if (filters.statuses?.length) totalConds.push({ profileStatusId: { _in: filters.statuses } })
  if (filters.tags?.length) totalConds.push({ root: { profileTags: { tagId: { _in: filters.tags } } } })
  if (filters.search?.trim()) totalConds.push({ name: { _contains: filters.search.trim() } })
  aliases.push(`total: profileInfosAggregate(filter_input: { where: ${whereClause(totalConds)} }) { _count }`)

  const query = `query ProfileFacetCounts {\n  ${aliases.join('\n  ')}\n}`

  function parse(data: Record<string, { _count: number }>): ProfileFacetCounts {
    const types: Record<string, number> = {}
    typeOptions.forEach((opt, i) => {
      types[opt.id] = data[`type_${i}`]?._count ?? 0
    })

    const sectors: Record<string, number> = {}
    sectorOptions.forEach((opt, i) => {
      sectors[opt.id] = data[`sector_${i}`]?._count ?? 0
    })

    const statuses: Record<string, number> = {}
    statusOptions.forEach((opt, i) => {
      statuses[opt.id] = data[`status_${i}`]?._count ?? 0
    })

    const tags: Record<string, number> = {}
    tagOptions.forEach((opt, i) => {
      tags[opt.id] = data[`tag_${i}`]?._count ?? 0
    })

    return { types, sectors, statuses, tags, total: data.total?._count ?? 0 }
  }

  return { query, parse }
}
