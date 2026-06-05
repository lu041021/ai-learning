import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/tauri'
import { SafeSnippet } from './SafeSnippet'
import type { SearchResultItem } from '../../types'

export function SearchBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        setQuery('')
        setResults([])
        setSelectedIdx(0)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
      if (open && e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1))
      }
      if (open && e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((prev) => Math.max(prev - 1, 0))
      }
      if (open && e.key === 'Enter' && results[selectedIdx]) {
        handleSelect(results[selectedIdx])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, selectedIdx])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const doSearch = useCallback((q: string) => {
    if (q.trim().length < 1) {
      setResults([])
      return
    }
    api.searchAll(q, 8).then(setResults).catch(() => setResults([]))
  }, [])

  const handleInput = (value: string) => {
    setQuery(value)
    setSelectedIdx(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const getNavTarget = (r: SearchResultItem): string => {
    if (r.source_type === 'course') return `/courses/${r.context_slug}`
    if (r.source_type === 'lesson') return `/courses/${r.context_slug}/lessons/${r.source_id}`
    return `/courses/${r.context_slug}/lessons/${r.context_id}/quiz`
  }

  const handleSelect = (r: SearchResultItem) => {
    setOpen(false)
    setQuery('')
    setResults([])
    navigate(getNavTarget(r))
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', justifyContent: 'center', paddingTop: '12vh',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: '560px', maxHeight: '480px',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="搜索课程、课时、题目..."
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontSize: '16px', background: 'transparent',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {results.length === 0 && query.trim().length > 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              未找到相关结果
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.source_type}-${r.source_id}`}
              onClick={() => handleSelect(r)}
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius)',
                background: i === selectedIdx ? 'var(--accent-light)' : 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '8px',
                  background: r.source_type === 'course' ? 'var(--accent-light)' : r.source_type === 'lesson' ? 'var(--success-light)' : 'var(--warning-light)',
                  color: r.source_type === 'course' ? 'var(--accent)' : r.source_type === 'lesson' ? 'var(--success)' : 'var(--warning)',
                  fontWeight: 600,
                }}>
                  {r.source_type === 'course' ? '课程' : r.source_type === 'lesson' ? '课时' : '题目'}
                </span>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {r.title}
                </span>
              </div>
              <p
                style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}
              >
                <SafeSnippet html={r.snippet || ''} />
              </p>
            </div>
          ))}
        </div>
        <div style={{
          padding: '8px 16px', borderTop: '1px solid var(--border)',
          fontSize: '11px', color: 'var(--text-muted)',
          display: 'flex', gap: '16px',
        }}>
          <span>↑↓ 导航</span>
          <span>Enter 选择</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
