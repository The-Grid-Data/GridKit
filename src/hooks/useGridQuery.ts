import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useGridConfig } from '../components/GridProvider.js'
import { executeQuery } from '../core/client.js'
import { gridKeys } from '../core/query-keys.js'

/**
 * Extract the operation name from a raw GraphQL query string.
 * Handles: `query MyQuery`, `mutation DoThing`, `subscription OnThing`
 * Returns null for anonymous operations.
 */
export function extractOperationName(query: string): string | null {
  const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/)
  return match?.[1] ?? null
}

export function useGridQuery<TData = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  options?: Omit<
    UseQueryOptions<TData, Error, TData, ReturnType<typeof gridKeys.graphql>>,
    'queryKey' | 'queryFn'
  >,
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
