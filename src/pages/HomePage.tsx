import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUserStore } from '../stores'
import { api } from '../api/tauri'
import { useMountedRef } from '../hooks/useMountedRef'
import { useVirtualList } from '../hooks/useVirtualList'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorBlock } from '../components/common/ErrorBlock'
import type { CourseSummary, RecommendationItem } from '../types'

const COURSE_ITEM_HEIGHT = 138
const VIRTUAL_THRESHOLD = 20
const VIRTUAL_CONTAINER_HEIGHT = 600

export function HomePage() {
  const userId = useUserStore((s) => s.userId)
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useMountedRef()
  const useVirtual = courses.length > VIRTUAL_THRESHOLD
  const {
    containerRef: virtualListRef,
    onScroll: onVirtualScroll,
    getVisibleRange,
    totalHeight,
  } = useVirtualList({
    itemCount: courses.length,
    itemHeight: COURSE_ITEM_HEIGHT,
  })

  useEffect(() => {
    document.title = 'AI 学堂'
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true)
    setError(null)

    Promise.all([
      api.getCourses(),
      userId ? api.getRecommendations(userId).catch(() => []) : Promise.resolve([]),
    ])
      .then(([c, r]) => {
        if (mountedRef.current) {
          setCourses(c)
          setRecommendations(r)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setError('加载失败')
          setLoading(false)
        }
      })
  }, [userId, mountedRef])

  const continueLearning = recommendations.filter(
    (r) => r.completedLessons > 0 && r.completedLessons < r.totalLessons,
  )
  const topRecommendations = recommendations.filter((r) => r.score >= 0.3).slice(0, 4)

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorBlock message={error} onRetry={() => window.location.reload()} />
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>欢迎来到 AI 学堂</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          交互式 AI 学习之旅从这里开始。跟随结构化课程，AI 导师全程陪伴。
        </p>
      </div>

      {/* Continue Learning */}
      {continueLearning.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>继续学习</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {continueLearning.map((item) => (
              <Link
                key={item.courseId}
                to={`/courses/${item.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 20px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '15px',
                      color: 'var(--text-primary)',
                      marginBottom: '4px',
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        flex: 1,
                        maxWidth: '200px',
                        height: '6px',
                        borderRadius: '3px',
                        background: 'var(--bg-tertiary)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          borderRadius: '3px',
                          width: `${(item.completedLessons / item.totalLessons) * 100}%`,
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {item.completedLessons}/{item.totalLessons} 课时
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 500 }}>
                  继续 &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {topRecommendations.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>为你推荐</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {topRecommendations.map((item) => (
              <Link
                key={item.courseId}
                to={`/courses/${item.slug}`}
                style={{
                  display: 'block',
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '15px',
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '1px 8px',
                      borderRadius: '8px',
                      background: 'var(--accent-light)',
                      color: 'var(--accent)',
                    }}
                  >
                    {item.reason}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    匹配度 {Math.round(item.score * 100)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: no profile yet */}
      {recommendations.length === 0 && continueLearning.length === 0 && (
        <div
          style={{
            marginBottom: '32px',
            padding: '24px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            完成评估以获得个性化课程推荐
          </p>
          <Link
            to="/onboarding"
            style={{
              display: 'inline-block',
              marginTop: '12px',
              padding: '8px 24px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            开始评估
          </Link>
        </div>
      )}

      {/* All Courses */}
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
        全部课程
        {courses.length > 0 && (
          <span
            style={{
              fontSize: '13px',
              fontWeight: 400,
              color: 'var(--text-muted)',
              marginLeft: '8px',
            }}
          >
            {courses.length} 门
          </span>
        )}
      </h2>
      {courses.length === 0 ? (
        <div
          style={{
            color: 'var(--text-muted)',
            padding: '24px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          暂无可用课程，请先导入
        </div>
      ) : useVirtual ? (
        <div
          ref={virtualListRef}
          style={{
            height: `${VIRTUAL_CONTAINER_HEIGHT}px`,
            overflowY: 'auto',
            position: 'relative',
          }}
          onScroll={(e) => {
            onVirtualScroll(e)
          }}
        >
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {(() => {
              const { start, end } = getVisibleRange(VIRTUAL_CONTAINER_HEIGHT)
              return courses.slice(start, end + 1).map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    position: 'absolute',
                    top: `${(start + idx) * COURSE_ITEM_HEIGHT}px`,
                    left: 0,
                    right: 0,
                    padding: '0 0 16px 0',
                  }}
                >
                  <CourseCard course={c} />
                </div>
              ))
            })()}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function CourseCard({ course: c }: { course: CourseSummary }) {
  return (
    <Link
      to={`/courses/${c.slug}`}
      style={{
        display: 'block',
        padding: '24px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <h3
        style={{
          fontSize: '17px',
          fontWeight: 600,
          marginBottom: '6px',
          color: 'var(--text-primary)',
        }}
      >
        {c.title}
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {c.description}
      </p>
      <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--accent)', fontWeight: 500 }}>
        开始学习 &rarr;
      </div>
    </Link>
  )
}
