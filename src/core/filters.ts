export interface ProfileWhereFilters {
  types?: string[]
  sectors?: string[]
  statuses?: string[]
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

  if (filters.search?.trim()) {
    conditions.push({ name: { _contains: filters.search.trim() } })
  }

  if (conditions.length === 0) return {}
  if (conditions.length === 1) return conditions[0]
  return { _and: conditions }
}
