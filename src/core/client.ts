import { Graffle } from 'graffle'
import type { GridConfig } from './types.js'

function createClient(config: GridConfig) {
  const headers: Record<string, string> = {
    ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
    ...config.headers,
  }

  return Graffle.create().transport({
    url: config.endpoint,
    headers,
  })
}

export async function executeQuery<TData = unknown>(
  config: GridConfig,
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const client = createClient(config)
  const result = await client.gql(query).$send(variables)
  return result as TData
}
