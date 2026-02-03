export interface GridConfig {
  /** The Grid GraphQL endpoint URL */
  endpoint: string
  /** Optional API key for authentication */
  apiKey?: string
  /** Optional additional headers */
  headers?: Record<string, string>
}
