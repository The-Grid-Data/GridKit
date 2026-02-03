export interface GridConfig {
  /** The Grid GraphQL endpoint URL */
  endpoint: string
  /** Optional API key for authentication */
  apiKey?: string
  /** Optional additional headers */
  headers?: Record<string, string>
}

/** A single filter option from the schema (matches all dimension tables) */
export interface FilterOption {
  id: string
  name: string
}

/** A tag option with its category */
export interface TagOption extends FilterOption {
  tagType: FilterOption | null
}

/** All available filter dimensions, fetched from the API */
export interface FilterMetadata {
  profileTypes: FilterOption[]
  profileSectors: FilterOption[]
  profileStatuses: FilterOption[]
  productTypes: FilterOption[]
  productStatuses: FilterOption[]
  assetTypes: FilterOption[]
  assetStatuses: FilterOption[]
  tagTypes: FilterOption[]
  tags: TagOption[]
}
