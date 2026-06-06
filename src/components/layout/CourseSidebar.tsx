import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useUIStore, useProgressStore, useUserStore, useChatStore } from '../../stores'
import { api } from '../../api/tauri'
import { toast } from '../ui/Toast'
import type { CourseDetail } from '../../types'

export function CourseSidebar() {
  const { slug, lessonId } = useParams()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel)
  const completedIds = useProgressStore((s) => s.completedIds)
  const userId = useUserStore((s) => s.userId)
  const fetchConversations = useChatStore((s) => s.fetchConversations)

  useEffect(() => {
    if (userId) fetchConversations(userId)
  }, [userId, fetchConversations])

  useEffect(() => {
    if (slug)
      api
        .getCourse(slug)
        .then(setCourse)
        .catch(() => toast.error('加载课程失败'))
  }, [slug])

  return (
    <aside
      style={{
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link to="/" style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
          AI 学堂
        </Link>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Link
            to="/settings"
            title="设置"
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            &#9881;
          </Link>
          <button
            onClick={toggleAIPanel}
            title="切换 AI 面板"
            aria-label="切换 AI 面板"
            style={{
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            AI
          </button>
          <button
            onClick={toggleSidebar}
            title="关闭侧边栏"
            aria-label="关闭侧边栏"
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '16px',
            }}
          >
            x
          </button>
        </div>
      </div>

      <nav style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
        <Link
          to="/courses"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '4px',
          }}
        >
          &larr; 全部课程
        </Link>
        <Link
          to="/learning-path"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '4px',
          }}
        >
          学习路线
        </Link>
        <Link
          to="/progress"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '4px',
          }}
        >
          学习进度
        </Link>
        <Link
          to="/search"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '8px',
          }}
          title="Ctrl+K"
        >
          搜索
        </Link>
        <Link
          to="/knowledge-graph"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          知识图谱
        </Link>
        <Link
          to="/mcp-playground"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          MCP Playground
          <span
            style={{
              marginLeft: '6px',
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '6px',
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              fontWeight: 600,
            }}
          >
            新
          </span>
        </Link>
        <Link
          to="/analytics"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          学习分析
        </Link>
        <Link
          to="/import"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '4px',
          }}
        >
          导入课程
        </Link>
        <Link
          to="/import/github"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '4px',
          }}
        >
          GitHub 导入
        </Link>
        <Link
          to="/import/rss"
          style={{
            display: 'block',
            padding: '8px 20px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          RSS 订阅
        </Link>

        {course && (
          <div>
            <div
              style={{
                padding: '4px 20px 8px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {course.title}
            </div>
            {course.chapters.map((ch) => (
              <div key={ch.id}>
                <div
                  style={{
                    padding: '6px 20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {ch.title}
                </div>
                {ch.lessons.map((l) => {
                  const isActive = lessonId === String(l.id)
                  const isCompleted = completedIds.has(l.id)
                  return (
                    <Link
                      key={l.id}
                      to={`/courses/${slug}/lessons/${l.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 20px 6px 28px',
                        fontSize: '13px',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        background: isActive ? 'var(--accent-light)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: isCompleted ? 'var(--success)' : 'var(--bg-tertiary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          flexShrink: 0,
                        }}
                      >
                        {isCompleted ? 'v' : ''}
                      </span>
                      {l.title}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </nav>
    </aside>
  )
}
