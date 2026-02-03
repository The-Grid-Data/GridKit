import type { UseQueryOptions } from '@tanstack/react-query'
import type { FilterMetadata } from '../core/types.js'
import { gridKeys } from '../core/query-keys.js'
import { FILTER_METADATA_QUERY } from '../core/queries.js'
import { useGridQuery } from './useGridQuery.js'

export function useGridFilterOptions(
  options?: Omit<
    UseQueryOptions<FilterMetadata, Error, FilterMetadata, ReturnType<typeof gridKeys.graphql>>,
    'queryKey' | 'queryFn'
  >,
) {
  return useGridQuery<FilterMetadata>(FILTER_METADATA_QUERY, undefined, {
    staleTime: 30 * 60_000, // 30 min — filter dimensions rarely change
    ...options,
  })
}
