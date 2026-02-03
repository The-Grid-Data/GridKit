import { useState, useMemo, useEffect } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { useGridQuery } from '../src/hooks/useGridQuery.js'
import { useGridFilterOptions } from '../src/hooks/useGridFilterOptions.js'
import { buildProfileWhere } from '../src/core/filters.js'
import type { FilterOption } from '../src/core/types.js'

const DEFAULT_QUERY = `query GetProducts {
  products(limit: 5) {
    id
    name
    type
    status
  }
}`

const PAGE_SIZE = 25

const PROFILE_SEARCH_QUERY = `query SearchProfiles($where: ProfileInfosBoolExp, $limit: Int, $offset: Int) {
  profileInfos(where: $where, limit: $limit, offset: $offset, order_by: {name: Asc}) {
    id
    name
    profileType { id name }
    profileSector { id name }
    profileStatus { id name }
  }
}`

type Tab = 'search' | 'query'

export function App() {
  const [tab, setTab] = useState<Tab>('search')

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>grid-kit playground</h1>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e0e0e0' }}>
        <TabButton active={tab === 'search'} onClick={() => setTab('search')}>
          Profile Search
        </TabButton>
        <TabButton active={tab === 'query'} onClick={() => setTab('query')}>
          Raw Query
        </TabButton>
      </div>

      {tab === 'search' ? <ProfileSearch /> : <RawQuery />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 20px',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        border: 'none',
        borderBottom: active ? '2px solid #333' : '2px solid transparent',
        background: 'none',
        color: active ? '#333' : '#888',
        marginBottom: -2,
      }}
    >
      {children}
    </button>
  )
}

// --- Profile Search (new filter features) ---

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  // Filter out empty/placeholder entries
  const validOptions = options.filter((o) => o.name.trim())

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {validOptions.map((opt) => {
          const isSelected = selected.includes(opt.id)
          return (
            <button
              key={opt.id}
              onClick={() =>
                onChange(isSelected ? selected.filter((id) => id !== opt.id) : [...selected, opt.id])
              }
              style={{
                padding: '3px 10px',
                fontSize: 12,
                border: '1px solid',
                borderColor: isSelected ? '#333' : '#ccc',
                borderRadius: 12,
                background: isSelected ? '#333' : '#fff',
                color: isSelected ? '#fff' : '#555',
                cursor: 'pointer',
              }}
            >
              {opt.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProfileSearch() {
  const { data: filters, isLoading: filtersLoading, error: filtersError } = useGridFilterOptions()

  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [page, setPage] = useState(0)

  const where = useMemo(
    () =>
      buildProfileWhere({
        types: selectedTypes,
        sectors: selectedSectors,
        statuses: selectedStatuses,
        search: submittedSearch,
      }),
    [selectedTypes, selectedSectors, selectedStatuses, submittedSearch],
  )

  // Reset to first page when filters change
  const whereKey = JSON.stringify(where)
  useEffect(() => { setPage(0) }, [whereKey])

  const hasFilters = selectedTypes.length > 0 || selectedSectors.length > 0 || selectedStatuses.length > 0 || submittedSearch.trim() !== ''

  const {
    data: profiles,
    error: searchError,
    isLoading: searchLoading,
    isFetching: searchFetching,
  } = useGridQuery<{ profileInfos: Array<Record<string, unknown>> }>(
    PROFILE_SEARCH_QUERY,
    { where, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { enabled: hasFilters, placeholderData: keepPreviousData },
  )

  const clearAll = () => {
    setSelectedTypes([])
    setSelectedSectors([])
    setSelectedStatuses([])
    setSearch('')
    setSubmittedSearch('')
  }

  return (
    <div>
      <p style={{ color: '#666', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Uses <code>useGridFilterOptions()</code> to load filter dimensions, <code>buildProfileWhere()</code> to build Hasura where clauses.
      </p>

      {filtersLoading && <p style={{ color: '#666' }}>Loading filter options...</p>}
      {filtersError && (
        <pre style={{ color: '#d32f2f', fontSize: 13 }}>
          {filtersError instanceof Error ? filtersError.message : String(filtersError)}
        </pre>
      )}

      {filters && (
        <div style={{ background: '#fafafa', padding: 16, borderRadius: 6, marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Search</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSubmittedSearch(search)}
                placeholder="Search profiles by name..."
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: 13,
                  border: '1px solid #ccc',
                  borderRadius: 4,
                }}
              />
              <button
                onClick={() => setSubmittedSearch(search)}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: 4,
                  border: '1px solid #333',
                  background: '#333',
                  color: '#fff',
                }}
              >
                Search
              </button>
            </div>
          </div>

          <MultiSelect label="Profile Type" options={filters.profileTypes} selected={selectedTypes} onChange={setSelectedTypes} />
          <MultiSelect label="Sector" options={filters.profileSectors} selected={selectedSectors} onChange={setSelectedSectors} />
          <MultiSelect label="Status" options={filters.profileStatuses} selected={selectedStatuses} onChange={setSelectedStatuses} />

          {hasFilters && (
            <button
              onClick={clearAll}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                cursor: 'pointer',
                borderRadius: 4,
                border: '1px solid #999',
                background: '#fff',
                color: '#666',
              }}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {hasFilters && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 12, color: '#888', cursor: 'pointer' }}>Generated where clause</summary>
          <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 12, overflow: 'auto' }}>
            {JSON.stringify(where, null, 2)}
          </pre>
        </details>
      )}

      <div>
        {searchLoading && <p style={{ color: '#666' }}>Searching...</p>}
        {searchFetching && !searchLoading && <p style={{ color: '#666' }}>Refetching...</p>}
        {!hasFilters && <p style={{ color: '#999', fontSize: 13 }}>Select filters or search to find profiles.</p>}
        {searchError && (
          <pre style={{ color: '#d32f2f', whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {searchError instanceof Error ? searchError.message : String(searchError)}
          </pre>
        )}
        {profiles?.profileInfos && (
          <div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + profiles.profileInfos.length} (page {page + 1})
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '6px 8px' }}>Name</th>
                  <th style={{ padding: '6px 8px' }}>Type</th>
                  <th style={{ padding: '6px 8px' }}>Sector</th>
                  <th style={{ padding: '6px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {profiles.profileInfos.map((p: Record<string, unknown>) => (
                  <tr key={p.id as string} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 8px' }}>{p.name as string}</td>
                    <td style={{ padding: '6px 8px', color: '#666' }}>{(p.profileType as Record<string, string>)?.name ?? '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#666' }}>{(p.profileSector as Record<string, string>)?.name ?? '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#666' }}>{(p.profileStatus as Record<string, string>)?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  cursor: page === 0 ? 'default' : 'pointer',
                  borderRadius: 4,
                  border: '1px solid #ccc',
                  background: '#fff',
                  color: page === 0 ? '#ccc' : '#333',
                }}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, color: '#666' }}>Page {page + 1}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={profiles.profileInfos.length < PAGE_SIZE}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  cursor: profiles.profileInfos.length < PAGE_SIZE ? 'default' : 'pointer',
                  borderRadius: 4,
                  border: '1px solid #ccc',
                  background: '#fff',
                  color: profiles.profileInfos.length < PAGE_SIZE ? '#ccc' : '#333',
                }}
              >
                Next
              </button>
              {searchFetching && <span style={{ fontSize: 12, color: '#999' }}>Loading...</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Raw Query (existing) ---

function RawQuery() {
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
    <div>
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
