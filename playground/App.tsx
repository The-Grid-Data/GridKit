import { useState } from 'react'
import { useGridQuery } from '../src/hooks/useGridQuery.js'

const DEFAULT_QUERY = `query GetProducts {
  products(limit: 5) {
    id
    name
    type
    status
  }
}`

export function App() {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [variables, setVariables] = useState('{}')
  const [submitted, setSubmitted] = useState<{ query: string; vars: Record<string, unknown> }>({
    query: DEFAULT_QUERY,
    vars: {},
  })

  const { data, error, isLoading, isFetching } = useGridQuery(
    submitted.query,
    submitted.vars,
    { enabled: !!submitted.query },
  )

  const handleSubmit = () => {
    try {
      const vars = JSON.parse(variables)
      setSubmitted({ query, vars })
    } catch {
      alert('Invalid JSON in variables')
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>grid-kit playground</h1>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>GraphQL Query</label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            height: 200,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 13,
            padding: 8,
            border: '1px solid #ccc',
            borderRadius: 4,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Variables (JSON)</label>
        <textarea
          value={variables}
          onChange={(e) => setVariables(e.target.value)}
          style={{
            width: '100%',
            height: 60,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 13,
            padding: 8,
            border: '1px solid #ccc',
            borderRadius: 4,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        onClick={handleSubmit}
        style={{
          padding: '6px 16px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          borderRadius: 4,
          border: '1px solid #333',
          background: '#333',
          color: '#fff',
        }}
      >
        Execute
      </button>

      <div style={{ marginTop: 16 }}>
        {isLoading && <p style={{ color: '#666' }}>Loading...</p>}
        {isFetching && !isLoading && <p style={{ color: '#666' }}>Refetching...</p>}
        {error && (
          <pre style={{ color: '#d32f2f', whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {error instanceof Error ? error.message : String(error)}
          </pre>
        )}
        {data !== undefined && (
          <pre
            style={{
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
              fontSize: 13,
              overflow: 'auto',
              maxHeight: 500,
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
