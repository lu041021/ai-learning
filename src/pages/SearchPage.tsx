import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/tauri'
import { SafeSnippet } from '../components/common/SafeSnippet'
import type { SearchResultItem } from '../types'

type Tab = 'all' | 'course' | 'lesson' | 'quiz_question'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const doSearch = (q: string) => {
    if (q.trim().length < 1) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    api.searchAll(q, 50).then((r) => {
      if (mountedRef.current) { setResults(r); setLoading(false) }
    }).catch(() => {
      if (mountedRef.current) { setLoading(false) }
    })
  }

  const handleInput = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 400)
  }

  const filtered = useMemo(() => {
    if (tab === 'all') return results
    return results.filter((r) => r.source_type === tab)
  }, [results, tab])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'course', label: '课程' },
    { key: 'lesson', label: '课时' },
    { key: 'quiz_question', label: '题目' },
  ]

  const getNavTarget = (r: SearchResultItem): string => {
    if (r.source_type === 'course') return `/courses/${r.context_slug}`
    if (r.source_type === 'lesson') return `/courses/${r.context_slug}/lessons/${r.source_id}`
    return `/courses/${r.context_slug}/lessons/${r.context_id}/quiz`
  }

  useEffect(() => {
    document.title = '搜索 - AI 学堂'
  }, [])

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>搜索</h1>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="搜索课程、课时或题目..."
          autoFocus
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '15px',
            outline: 'none',
          }}
        />
      </div>

      {searched && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius)',
                  fontSize: '13px',
                  fontWeight: 500,
                  background: tab === t.key ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: tab === t.key ? '#fff' : 'var(--text-secondary)',
                  border: tab === t.key ? 'none' : '1px solid var(--border)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>搜索中...</div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center', fontSize: '14px' }}>
              没有找到与 "{query}" 相关的结果
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filtered.map((r) => (
                <Link
                  key={`${r.source_type}-${r.source_id}`}
                  to={getNavTarget(r)}
                  style={{
                    display: 'block',
                    padding: '16px 20px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: '8px',
                      background: r.source_type === 'course' ? 'var(--accent-light)' : r.source_type === 'lesson' ? 'var(--success-light)' : 'var(--warning-light)',
                      color: r.source_type === 'course' ? 'var(--accent)' : r.source_type === 'lesson' ? 'var(--success)' : 'var(--warning)',
                      fontWeight: 600,
                    }}>
                      {r.source_type === 'course' ? '课程' : r.source_type === 'lesson' ? '课时' : '题目'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                      {r.title}
                    </span>
                  </div>
                  <p
                    style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}
                  >
                    <SafeSnippet html={r.snippet || ''} />
                  </p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {!searched && (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x1F50D;</div>
          <p>输入关键词开始搜索</p>
          <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            试试搜索 "Machine Learning"、 "神经网络" 或 "Supervised Learning"
          </p>
        </div>
      )}
    </div>
  )
}
