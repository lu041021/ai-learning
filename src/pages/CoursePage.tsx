import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/tauri'
import { useMountedRef } from '../hooks/useMountedRef'
import type { CourseDetail } from '../types'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorBlock } from '../components/common/ErrorBlock'

export function CoursePage() {
  const { slug } = useParams<{ slug: string }>()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useMountedRef()

  const fetchCourse = useCallback(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    api
      .getCourse(slug)
      .then((c) => {
        if (mountedRef.current) {
          setCourse(c)
          document.title = `${c.title} - AI 学堂`
          setLoading(false)
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setError('加载课程失败')
          setLoading(false)
        }
      })
  }, [slug, mountedRef])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    fetchCourse()
  }, [fetchCourse])

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorBlock message={error} onRetry={fetchCourse} />
  }

  if (!course) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
        课程不存在
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <Link
        to="/"
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
          display: 'inline-block',
        }}
      >
        &larr; 返回课程列表
      </Link>
      <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>{course.title}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '32px' }}>
        {course.description}
      </p>

      {course.chapters.length === 0 ? (
        <div
          style={{
            color: 'var(--text-muted)',
            padding: '24px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          此课程暂无章节
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {course.chapters.map((ch, ci) => (
            <div
              key={ch.id}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  fontWeight: 600,
                  fontSize: '15px',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-tertiary)',
                }}
              >
                Chapter {ci + 1}: {ch.title}
              </div>
              {ch.lessons.length === 0 ? (
                <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  暂无课时
                </div>
              ) : (
                ch.lessons.map((l) => (
                  <Link
                    key={l.id}
                    to={`/courses/${course.slug}/lessons/${l.id}`}
                    style={{
                      display: 'block',
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {l.title}
                  </Link>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
