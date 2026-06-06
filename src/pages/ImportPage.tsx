import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/tauri'
import { useImportStore } from '../stores'

export function ImportPage() {
  const [url, setUrl] = useState('')
  const {
    phase,
    result,
    errorText,
    duplicate,
    setPhase,
    setResult,
    setDuplicate,
    setError,
    resetImport,
  } = useImportStore()

  useEffect(() => {
    document.title = '导入内容 - AI 学堂'
  }, [])

  const handleImport = async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setPhase('checking')
    setDuplicate(null)

    try {
      const dup = await api.checkImportUrl(trimmed)
      if (dup.exists) {
        setDuplicate(dup)
        return
      }
    } catch {
      // proceed even if check fails
    }

    setPhase('importing')

    try {
      const res = await api.importFromUrl(trimmed)
      setResult(res)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && phase === 'idle') {
      handleImport()
    }
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>导入课程</h1>

      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '24px',
          marginBottom: '20px',
        }}
      >
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: '16px',
            lineHeight: 1.6,
          }}
        >
          粘贴任意技术文章、教程或文档链接，AI 将自动提取内容并生成结构化课程（含课时和测验）。 支持
          HTML 网页和纯文本内容。
        </p>
        <Link
          to="/import/github"
          style={{
            display: 'inline-block',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--accent)',
            textDecoration: 'none',
          }}
        >
          GitHub Awesome 浏览器 &rarr;
        </Link>
        <Link
          to="/import/rss"
          style={{
            display: 'inline-block',
            marginBottom: '16px',
            marginLeft: '16px',
            fontSize: '13px',
            color: 'var(--accent)',
            textDecoration: 'none',
          }}
        >
          RSS 订阅导入 &rarr;
        </Link>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="url"
            placeholder="https://example.com/ai-tutorial"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setDuplicate(null)
            }}
            onKeyDown={handleKeyDown}
            disabled={phase === 'importing' || phase === 'checking'}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleImport}
            disabled={!url.trim() || phase === 'importing' || phase === 'checking'}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: url.trim() && phase === 'idle' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: url.trim() && phase === 'idle' ? '#fff' : 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: url.trim() && phase === 'idle' ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            开始导入
          </button>
        </div>

        {(phase === 'checking' || phase === 'importing') && (
          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              borderRadius: 'var(--radius)',
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {phase === 'checking' ? '检查中...' : '正在抓取并生成课程...'}
            </span>
          </div>
        )}

        {duplicate && (
          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              borderRadius: 'var(--radius)',
              background: 'rgba(250, 204, 21, 0.1)',
              border: '1px solid var(--warning)',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                color: 'var(--warning)',
                margin: 0,
                marginBottom: '8px',
                fontWeight: 600,
              }}
            >
              该链接已导入过
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              课程: {duplicate.existing_course_title}
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              borderRadius: 'var(--radius)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error)',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                color: 'var(--error)',
                margin: 0,
                marginBottom: '8px',
                fontWeight: 600,
              }}
            >
              导入失败
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                margin: 0,
                wordBreak: 'break-all',
              }}
            >
              {errorText}
            </p>
            <button
              onClick={resetImport}
              style={{
                marginTop: '12px',
                padding: '6px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        )}
      </div>

      {result && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--success)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--success)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 700,
              }}
            >
              &#10003;
            </span>
            <h3
              style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}
            >
              导入成功
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '20px',
              fontSize: '14px',
            }}
          >
            <div style={{ color: 'var(--text-muted)' }}>课程名称</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              {result.course_title}
            </div>
            <div style={{ color: 'var(--text-muted)' }}>章节数</div>
            <div style={{ color: 'var(--text-primary)' }}>{result.chapters_count}</div>
            <div style={{ color: 'var(--text-muted)' }}>课时数</div>
            <div style={{ color: 'var(--text-primary)' }}>{result.lessons_count}</div>
            <div style={{ color: 'var(--text-muted)' }}>测验数</div>
            <div style={{ color: 'var(--text-primary)' }}>{result.quiz_count}</div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              to={`/courses/${result.course_slug}`}
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--radius)',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              开始学习
            </Link>
            <button
              onClick={() => {
                setUrl('')
                resetImport()
              }}
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              再导入一个
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
