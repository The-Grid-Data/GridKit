export const gridKeys = {
  all: ['grid'] as const,
  graphql: (opName: string, vars?: Record<string, unknown>) =>
    [...gridKeys.all, 'graphql', opName, vars] as const,
  profiles: () => [...gridKeys.all, 'profile'] as const,
  profile: (id: string) => [...gridKeys.profiles(), id] as const,
  searches: () => [...gridKeys.all, 'search'] as const,
  search: (query: string, vars?: Record<string, unknown>) =>
    [...gridKeys.searches(), query, vars] as const,
} as const
