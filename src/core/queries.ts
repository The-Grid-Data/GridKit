export const FILTER_METADATA_QUERY = `query GetFilterMetadata {
  profileTypes(order_by: {name: Asc}) { id name }
  profileSectors(order_by: {name: Asc}) { id name }
  profileStatuses(order_by: {name: Asc}) { id name }
  productTypes(order_by: {name: Asc}) { id name }
  productStatuses(order_by: {name: Asc}) { id name }
  assetTypes(order_by: {name: Asc}) { id name }
  assetStatuses(order_by: {name: Asc}) { id name }
  tagTypes(order_by: {name: Asc}) { id name }
  tags(order_by: {name: Asc}, limit: 500) { id name tagType { id name } }
}`
