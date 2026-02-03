import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GridProvider } from '../src/components/GridProvider.js'
import { App } from './App.js'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GridProvider config={{ endpoint: 'https://beta.node.thegrid.id/graphql' }}>
        <App />
      </GridProvider>
    </QueryClientProvider>
  </StrictMode>,
)
