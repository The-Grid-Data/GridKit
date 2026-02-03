export const gridKeys = {
  all: ['grid'] as const,
  graphql: (opName: string, vars?: Record<string, unknown>) =>
    [...gridKeys.all, 'graphql', opName, vars] as const,
  companies: () => [...gridKeys.all, 'company'] as const,
  company: (id: string) => [...gridKeys.companies(), id] as const,
  searches: () => [...gridKeys.all, 'search'] as const,
  search: (query: string, vars?: Record<string, unknown>) =>
    [...gridKeys.searches(), query, vars] as const,
} as const
