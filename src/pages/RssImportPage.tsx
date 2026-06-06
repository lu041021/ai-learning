import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/tauri'
import type { FeedSubscription, FeedArticle } from '../types'

const PRESETS = [
  { label: 'freeCodeCamp', url: 'https://medium.freecodecamp.org/feed/' },
  { label: 'Towards Data Science', url: 'https://towardsdatascience.com/feed/' },
  { label: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
  { label: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { label: 'Dev.to', url: 'https://dev.to/feed' },
]

type Phase = 'idle' | 'loading' | 'error'

export function RssImportPage() {
  const [feedUrl, setFeedUrl] = useState('')
  const [subscribePhase, setSubscribePhase] = useState<Phase>('idle')
  const [subscribeError, setSubscribeError] = useState('')

  const [subscriptions, setSubscriptions] = useState<FeedSubscription[]>([])
  const [selectedSub, setSelectedSub] = useState<FeedSubscription | null>(null)

  const [articlesPhase, setArticlesPhase] = useState<Phase>('idle')
  const [articles, setArticles] = useState<FeedArticle[]>([])
  const [articlesError, setArticlesError] = useState('')

  const [importingUrl, setImportingUrl] = useState<string | null>(null)
  const [importedSlugs, setImportedSlugs] = useState<Record<string, string>>({})
  const [importErrors, setImportErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    document.title = 'RSS 订阅 - AI 学堂'
    loadSubscriptions()
  }, [])

  const loadSubscriptions = async () => {
    try {
      const subs = await api.listFeedSubscriptions()
      setSubscriptions(subs)
    } catch {
      // ignore
    }
  }

  const handleSubscribe = async (url?: string) => {
    const target = url || feedUrl.trim()
    if (!target) return

    setSubscribePhase('loading')
    setSubscribeError('')

    try {
      await api.subscribeFeed(target)
      setFeedUrl('')
      setSubscribePhase('idle')
      await loadSubscriptions()
    } catch (e) {
      setSubscribeError(String(e))
      setSubscribePhase('error')
    }
  }

  const handleUnsubscribe = async (id: number) => {
    try {
      await api.unsubscribeFeed(id)
      if (selectedSub?.id === id) {
        setSelectedSub(null)
        setArticles([])
        setArticlesPhase('idle')
      }
      await loadSubscriptions()
    } catch {
      // ignore
    }
  }

  const handleSelectSub = async (sub: FeedSubscription) => {
    setSelectedSub(sub)
    setArticlesPhase('loading')
    setArticles([])
    setArticlesError('')

    try {
      const result = await api.fetchFeedArticles(sub.feed_url)
      setArticles(result)
      setArticlesPhase('idle')
    } catch (e) {
      setArticlesError(String(e))
      setArticlesPhase('error')
    }
  }

  const handleImportArticle = async (article: FeedArticle) => {
    setImportingUrl(article.url)
    setImportErrors((prev) => {
      const next = { ...prev }
      delete next[article.url]
      return next
    })

    try {
      const dup = await api.checkImportUrl(article.url)
      if (dup.exists) {
        setImportErrors((prev) => ({
          ...prev,
          [article.url]: `已导入: ${dup.existing_course_title}`,
        }))
        setImportingUrl(null)
        return
      }
    } catch {
      // proceed
    }

    try {
      const result = await api.importFromUrl(article.url)
      setImportedSlugs((prev) => ({ ...prev, [article.url]: result.course_slug }))
    } catch (e) {
      setImportErrors((prev) => ({ ...prev, [article.url]: String(e) }))
    }
    setImportingUrl(null)
  }

  const handleBatchImport = async () => {
    const unimported = articles.filter((a) => !importedSlugs[a.url] && !importErrors[a.url])
    for (const article of unimported) {
      await handleImportArticle(article)
    }
  }

  const handleSubscribeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubscribe()
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>RSS 订阅导入</h1>

      {/* Subscribe Section */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <input
            type="url"
            placeholder="粘贴 RSS/Atom 订阅地址..."
            value={feedUrl}
            onChange={(e) => {
              setFeedUrl(e.target.value)
              setSubscribeError('')
            }}
            onKeyDown={handleSubscribeKeyDown}
            disabled={subscribePhase === 'loading'}
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
            onClick={() => handleSubscribe()}
            disabled={!feedUrl.trim() || subscribePhase === 'loading'}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: feedUrl.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: feedUrl.trim() ? '#fff' : 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: feedUrl.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            订阅
          </button>
        </div>

        {subscribePhase === 'loading' && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            订阅中...
          </div>
        )}
        {subscribeError && (
          <div style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>
            {subscribeError}
          </div>
        )}

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          预设订阅源:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {PRESETS.map((p) => (
            <button
              key={p.url}
              onClick={() => handleSubscribe(p.url)}
              disabled={subscribePhase === 'loading'}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 340px)' }}>
        {/* Left: Subscriptions */}
        <div
          style={{
            width: '280px',
            flexShrink: 0,
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
              color: 'var(--text-primary)',
            }}
          >
            我的订阅 ({subscriptions.length})
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                onClick={() => handleSelectSub(sub)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border:
                    selectedSub?.id === sub.id
                      ? '1px solid var(--accent)'
                      : '1px solid transparent',
                  background:
                    selectedSub?.id === sub.id ? 'var(--accent-light)' : 'var(--bg-primary)',
                  marginBottom: '6px',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '2px',
                      }}
                    >
                      {sub.feed_title || new URL(sub.feed_url).hostname}
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
                      {sub.feed_url}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnsubscribe(sub.id)
                    }}
                    style={{
                      flexShrink: 0,
                      marginLeft: '8px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      fontSize: '16px',
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                    title="取消订阅"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
            {subscriptions.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}
              >
                暂无订阅，粘贴 RSS 地址或点击预设源开始
              </div>
            )}
          </div>
        </div>

        {/* Right: Articles */}
        <div
          style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {articlesPhase === 'idle' && !selectedSub && (
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
              选择左侧订阅源查看文章列表
            </div>
          )}

          {articlesPhase === 'loading' && (
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

          {articlesError && (
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--error)',
                fontSize: '13px',
                color: 'var(--error)',
              }}
            >
              {articlesError}
            </div>
          )}

          {selectedSub && articlesPhase === 'idle' && (
            <>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '12px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  {selectedSub.feed_title || selectedSub.feed_url} ({articles.length} 篇文章)
                </span>
                {articles.filter((a) => !importedSlugs[a.url] && !importErrors[a.url]).length >
                  0 && (
                  <button
                    onClick={handleBatchImport}
                    disabled={importingUrl !== null}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--accent)',
                      background: 'transparent',
                      color: 'var(--accent)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    批量导入全部
                  </button>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {articles.map((article) => {
                  const isImporting = importingUrl === article.url
                  const slug = importedSlugs[article.url]
                  const error = importErrors[article.url]

                  return (
                    <div
                      key={article.url}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-primary)',
                        marginBottom: '8px',
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
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              marginBottom: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {article.title || '(无标题)'}
                          </div>
                          {article.description && (
                            <div
                              style={{
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                marginBottom: '6px',
                                lineHeight: 1.5,
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {article.description.replace(/<[^>]*>/g, '').slice(0, 200)}
                            </div>
                          )}
                          <div
                            style={{
                              display: 'flex',
                              gap: '12px',
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {article.author && <span>{article.author}</span>}
                            {article.published_at && (
                              <span>
                                {new Date(article.published_at).toLocaleDateString('zh-CN')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: '4px',
                          }}
                        >
                          {slug ? (
                            <Link
                              to={`/courses/${slug}`}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 'var(--radius)',
                                background: 'var(--success)',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 600,
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              已导入
                            </Link>
                          ) : (
                            <button
                              onClick={() => handleImportArticle(article)}
                              disabled={isImporting}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 'var(--radius)',
                                border: 'none',
                                background: 'var(--accent)',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isImporting ? '导入中...' : '导入'}
                            </button>
                          )}
                          {error && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: error.startsWith('已导入')
                                  ? 'var(--warning)'
                                  : 'var(--error)',
                                maxWidth: '150px',
                                textAlign: 'right',
                              }}
                            >
                              {error.length > 40 ? error.slice(0, 40) + '...' : error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {articles.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    该订阅源暂无文章
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
