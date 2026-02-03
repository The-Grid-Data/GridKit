import { createContext, useContext, type ReactNode } from 'react'
import type { GridConfig } from '../core/types.js'

const GridContext = createContext<GridConfig | null>(null)

export function GridProvider({
  config,
  children,
}: {
  config: GridConfig
  children: ReactNode
}) {
  return <GridContext.Provider value={config}>{children}</GridContext.Provider>
}

export function useGridConfig(): GridConfig {
  const config = useContext(GridContext)
  if (!config) {
    throw new Error(
      'useGridConfig must be used within a <GridProvider>. ' +
        'Wrap your app in <GridProvider config={{ endpoint: "..." }}>.',
    )
  }
  return config
}
