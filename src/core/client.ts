import type { GridConfig } from './types.js'

interface GraphQLResponse<TData> {
  data?: TData
  errors?: Array<{ message: string }>
}

export async function executeQuery<TData = unknown>(
  config: GridConfig,
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
    ...config.headers,
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
  }

  const json: GraphQLResponse<TData> = await response.json()

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('\n'))
  }

  if (json.data === undefined) {
    throw new Error('GraphQL response missing data')
  }

  return json.data
}
