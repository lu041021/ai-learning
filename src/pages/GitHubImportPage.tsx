import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/tauri'
import { useImportStore } from '../stores'
import type { AwesomeRepo, AwesomeLink, LinkPreview } from '../types'

type LeftPhase = 'idle' | 'searching' | 'results' | 'error'
type RightPhase = 'idle' | 'loading_links' | 'links' | 'previewing' | 'importing' | 'done' | 'error'

export function GitHubImportPage() {
  const [query, setQuery] = useState('')
  const [leftPhase, setLeftPhase] = useState<LeftPhase>('idle')
  const [repos, setRepos] = useState<AwesomeRepo[]>([])
  const [leftError, setLeftError] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<AwesomeRepo | null>(null)

  const [rightPhase, setRightPhase] = useState<RightPhase>('idle')
  const [links, setLinks] = useState<AwesomeLink[]>([])
  const [rightError, setRightError] = useState('')
  const [selectedLink, setSelectedLink] = useState<AwesomeLink | null>(null)
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [, setImportedSlug] = useState<string | null>(null)

  const { duplicate, result, setResult, setDuplicate } = useImportStore()

  useEffect(() => {
    document.title = 'GitHub 导入 - AI 学堂'
  }, [])

  const handleSearch = async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    setLeftPhase('searching')
    setLeftError('')
    setRepos([])
    setSelectedRepo(null)
    setRightPhase('idle')
    setLinks([])
    setPreview(null)

    try {
      const results = await api.searchGithubAwesome(trimmed)
      setRepos(results)
      setLeftPhase(results.length > 0 ? 'results' : 'idle')
    } catch (e) {
      setLeftError(String(e))
      setLeftPhase('error')
    }
  }

  const handleSelectRepo = async (repo: AwesomeRepo) => {
    setSelectedRepo(repo)
    setRightPhase('loading_links')
    setRightError('')
    setLinks([])
    setSelectedLink(null)
    setPreview(null)

    try {
      const [owner, repoName] = repo.full_name.split('/')
      const results = await api.fetchAwesomeLinks(owner, repoName)
      setLinks(results)
      setRightPhase('links')
    } catch (e) {
      setRightError(String(e))
      setRightPhase('error')
    }
  }

  const handlePreviewLink = async (link: AwesomeLink) => {
    setSelectedLink(link)
    setRightPhase('previewing')
    setRightError('')

    try {
      const result = await api.previewImportLink(link.url)
      setPreview(result)
      setRightPhase('links') // stay in links view, just show preview
    } catch (e) {
      setRightError(String(e))
      setRightPhase('error')
    }
  }

  const handleImport = async (link: AwesomeLink) => {
    setRightPhase('importing')
    setRightError('')
    setImportedSlug(null)

    try {
      const dup = await api.checkImportUrl(link.url)
      if (dup.exists) {
        setDuplicate(dup)
        setRightPhase('links')
        return
      }
    } catch {
      // proceed
    }

    try {
      const res = await api.importFromUrl(link.url)
      setResult(res)
      setImportedSlug(res.course_slug)
      setRightPhase('done')
    } catch (e) {
      setRightError(String(e))
      setRightPhase('error')
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 160px)' }}>
      {/* Left Panel: Search + Repo List */}
      <div
        style={{
          width: '320px',
          flexShrink: 0,
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>GitHub Awesome</h2>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="搜索 awesome-ai, python, rust..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            disabled={leftPhase === 'searching'}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || leftPhase === 'searching'}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            搜索
          </button>
        </div>

        {leftPhase === 'searching' && (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            搜索中...
          </div>
        )}

        {leftPhase === 'error' && (
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error)',
              fontSize: '13px',
              color: 'var(--error)',
              marginBottom: '12px',
            }}
          >
            {leftError}
          </div>
        )}

        {leftPhase === 'results' && repos.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            未找到相关仓库
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto' }}>
          {repos.map((repo) => (
            <div
              key={repo.full_name}
              onClick={() => handleSelectRepo(repo)}
              style={{
                padding: '12px',
                borderRadius: 'var(--radius)',
                border:
                  selectedRepo?.full_name === repo.full_name
                    ? '1px solid var(--accent)'
                    : '1px solid transparent',
                background:
                  selectedRepo?.full_name === repo.full_name
                    ? 'var(--accent-light)'
                    : 'transparent',
                marginBottom: '8px',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                }}
              >
                {repo.full_name}
              </div>
              {repo.description && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                    lineHeight: 1.5,
                  }}
                >
                  {repo.description.length > 100
                    ? repo.description.slice(0, 100) + '...'
                    : repo.description}
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {'★'} {repo.stars.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel: Links + Preview + Import */}
      <div
        style={{
          flex: 1,
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {rightPhase === 'idle' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '14px',
            }}
          >
            选择左侧仓库浏览其链接列表
          </div>
        )}

        {rightPhase === 'loading_links' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        )}

        {rightPhase === 'error' && (
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error)',
              fontSize: '13px',
              color: 'var(--error)',
            }}
          >
            <p style={{ margin: 0, marginBottom: '8px', fontWeight: 600 }}>出错了</p>
            <p style={{ margin: 0, wordBreak: 'break-all' }}>{rightError}</p>
            <button
              onClick={() => setRightPhase('idle')}
              style={{
                marginTop: '10px',
                padding: '6px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        )}

        {(rightPhase === 'links' ||
          rightPhase === 'previewing' ||
          rightPhase === 'importing' ||
          rightPhase === 'done') && (
          <>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '12px',
                color: 'var(--text-primary)',
              }}
            >
              {selectedRepo?.full_name} ({links.length} 个链接)
            </div>

            <div style={{ flex: 1, overflow: 'auto', marginBottom: '16px' }}>
              {links.map((link) => (
                <div
                  key={link.url}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    border:
                      selectedLink?.url === link.url
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border)',
                    marginBottom: '6px',
                    background:
                      selectedLink?.url === link.url ? 'var(--accent-light)' : 'var(--bg-primary)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {link.text}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {link.url}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => handlePreviewLink(link)}
                        disabled={rightPhase === 'importing'}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        预览
                      </button>
                      <button
                        onClick={() => handleImport(link)}
                        disabled={rightPhase === 'importing'}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius)',
                          border: 'none',
                          background: 'var(--accent)',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        导入
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {links.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                  }}
                >
                  该仓库未找到可导入的外部链接
                </div>
              )}
            </div>

            {/* Preview Card */}
            {preview && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  marginBottom: '16px',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {preview.title || '无标题'}
                </div>
                {preview.description && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                    }}
                  >
                    {preview.description}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  内容长度: {preview.text_length.toLocaleString()} 字符
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {preview.text_preview}
                  {preview.text_length > 500 && '...'}
                </div>
              </div>
            )}

            {/* Duplicate Warning */}
            {duplicate && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius)',
                  background: 'rgba(250, 204, 21, 0.1)',
                  border: '1px solid var(--warning)',
                  marginBottom: '16px',
                }}
              >
                <p
                  style={{
                    fontSize: '14px',
                    color: 'var(--warning)',
                    margin: 0,
                    marginBottom: '4px',
                    fontWeight: 600,
                  }}
                >
                  该链接已导入过
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  课程: {duplicate.existing_course_title}
                </p>
                <button
                  onClick={() => setDuplicate(null)}
                  style={{
                    marginTop: '8px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  关闭
                </button>
              </div>
            )}

            {/* Import Status */}
            {rightPhase === 'importing' && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid var(--border)',
                    borderTopColor: 'var(--accent)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                正在抓取并生成课程...
              </div>
            )}

            {rightPhase === 'done' && result && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--success)',
                  background: 'rgba(34, 197, 94, 0.1)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '16px' }}>
                    &#10003;
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    导入成功 — {result.course_title}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginBottom: '10px',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  <span>{result.chapters_count} 章节</span>
                  <span>{result.lessons_count} 课时</span>
                  <span>{result.quiz_count} 测验</span>
                </div>
                <Link
                  to={`/courses/${result.course_slug}`}
                  style={{
                    display: 'inline-block',
                    padding: '8px 20px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  开始学习
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
