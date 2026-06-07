import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useUserStore, useLearningPathStore, useProgressStore } from '../stores'
import { api } from '../api/tauri'
import type { LearningPathStep, LearningPathVersionSummary, UsageProfile } from '../types'

const STEP_ICONS: Record<string, string> = {
  course_lesson: '📖',
  ai_concept: '💡',
  practice_quiz: '✏️',
  project: '🛠️',
}

const STEP_COLORS: Record<string, string> = {
  course_lesson: 'var(--accent)',
  ai_concept: 'var(--success)',
  practice_quiz: 'var(--warning)',
  project: '#a78bfa',
}

const STATUS_STYLE: Record<string, { bg: string; label: string; icon: string }> = {
  locked: { bg: 'var(--bg-tertiary)', label: '待解锁', icon: '🔒' },
  available: { bg: 'var(--accent-light)', label: '可开始', icon: '▶️' },
  in_progress: { bg: 'var(--accent-light)', label: '进行中', icon: '⏳' },
  completed: { bg: 'var(--success)', label: '已完成', icon: '✅' },
}

function getCourseSlug(courseId: number | null, courseMap: Map<number, string>): string {
  if (courseId !== null && courseMap.has(courseId)) return courseMap.get(courseId)!
  return ''
}

export function LearningPathPage() {
  const userId = useUserStore((s) => s.userId)
  const completedIds = useProgressStore((s) => s.completedIds)
  const { path, loading, generating, fetchPath, generatePath, resetPath } = useLearningPathStore()
  const [courseMap, setCourseMap] = useState<Map<number, string>>(new Map())
  const [versions, setVersions] = useState<LearningPathVersionSummary[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null)
  const [usageProfile, setUsageProfile] = useState<UsageProfile | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [isGoalPath, setIsGoalPath] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    document.title = '学习路线 - AI 学堂'
    if (userId) {
      fetchPath(userId)
      api
        .listLearningPathVersions(userId)
        .then(setVersions)
        .catch(() => {})
    }
  }, [userId, fetchPath])

  useEffect(() => {
    if (userId && searchParams.get('autoGenerate') === '1') {
      generatePath(userId)
    }
  }, [userId, searchParams, generatePath])

  useEffect(() => {
    api
      .getCourses()
      .then((courses) => {
        const map = new Map<number, string>()
        courses.forEach((c) => map.set(c.id, c.slug))
        setCourseMap(map)
      })
      .catch(() => {})
  }, [])

  const handleGenerate = () => {
    if (!userId) return
    generatePath(userId)
      .then(() => {
        api
          .listLearningPathVersions(userId)
          .then(setVersions)
          .catch(() => {})
        setSelectedVersionId(null)
        setIsGoalPath(false)
      })
      .catch(() => {})
  }

  const handleEnrichedGenerate = () => {
    if (!userId) return
    api
      .generateEnrichedLearningPath(userId)
      .then(() => {
        fetchPath(userId)
        api
          .listLearningPathVersions(userId)
          .then(setVersions)
          .catch(() => {})
        setSelectedVersionId(null)
        setIsGoalPath(true)
      })
      .catch((e) => {
        alert(typeof e === 'string' ? e : '深度路线生成失败，请先完成评估')
      })
  }

  const handleSelectVersion = (versionId: number) => {
    if (!userId) return
    setSelectedVersionId(versionId)
    api
      .getLearningPathVersion(userId, versionId)
      .then((v) => {
        if (v) {
          useLearningPathStore.setState({ path: v })
          setIsGoalPath(false)
        }
      })
      .catch(() => {})
  }

  const handleAnalyzeUsage = async () => {
    setAnalyzing(true)
    try {
      const profile = await api.analyzeUsage()
      setUsageProfile(profile)
    } catch (e) {
      const msg = typeof e === 'string' ? e : '分析失败'
      alert(msg)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleGoalGenerate = async () => {
    if (!userId) return
    generatePath(userId).then(async () => {
      try {
        await api.generateGoalPath(userId)
        setIsGoalPath(true)
        resetPath()
        fetchPath(userId)
        api
          .listLearningPathVersions(userId)
          .then(setVersions)
          .catch(() => {})
        setSelectedVersionId(null)
      } catch {
        // Fallback: standard generate already done
      }
    })
  }

  const handleStepClick = (step: LearningPathStep) => {
    if (step.status === 'locked') return
    if (step.lesson_id && step.course_id) {
      const slug = getCourseSlug(step.course_id, courseMap)
      if (slug) {
        navigate(`/courses/${slug}/lessons/${step.lesson_id}`)
      }
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
          加载中...
        </div>
      </div>
    )
  }

  if (!path || path.steps.length === 0) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <Link
          to="/"
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
            display: 'inline-block',
          }}
        >
          &larr; 返回首页
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>我的学习路线</h1>
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>?</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>还没有学习路线</h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '14px',
              marginBottom: '24px',
              lineHeight: 1.6,
            }}
          >
            AI 将根据你的学习画像，为你生成一条个性化的学习路径，
            <br />
            告诉你该学什么、按什么顺序学。
          </p>

          {!usageProfile && (
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={handleAnalyzeUsage}
                disabled={analyzing}
                style={{
                  padding: '10px 24px',
                  background: 'transparent',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                {analyzing ? '分析中...' : '分析我的 Claude Code 使用记录'}
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>
                让 AI 了解你的实际使用模式，生成更精准的学习路线
              </p>
            </div>
          )}

          {usageProfile && (
            <div
              style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                padding: '16px',
                marginBottom: '20px',
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--success)',
                  marginBottom: '8px',
                }}
              >
                使用分析完成
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: '10px',
                }}
              >
                {usageProfile.experience_summary}
              </p>
              {usageProfile.knowledge_gaps.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>知识缺口：</span>
                  {usageProfile.knowledge_gaps.map((g, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-block',
                        margin: '2px 4px',
                        padding: '2px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        background:
                          g.severity === 'high' ? 'var(--danger-light)' : 'var(--bg-tertiary)',
                        color: g.severity === 'high' ? 'var(--danger)' : 'var(--text-secondary)',
                      }}
                    >
                      {g.domain}
                    </span>
                  ))}
                </div>
              )}
              {usageProfile.learning_recommendations.length > 0 && (
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>推荐方向：</span>
                  <span style={{ fontSize: '13px', color: 'var(--accent)' }}>
                    {usageProfile.learning_recommendations.join('、')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                padding: '12px 32px',
                background: generating ? 'var(--bg-tertiary)' : 'var(--accent)',
                color: generating ? 'var(--text-muted)' : '#fff',
                borderRadius: 'var(--radius)',
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              {generating ? '生成中...' : '标准生成'}
            </button>
            {usageProfile && (
              <button
                onClick={handleGoalGenerate}
                disabled={generating}
                style={{
                  padding: '12px 32px',
                  background: generating ? 'var(--bg-tertiary)' : 'var(--success)',
                  color: generating ? 'var(--text-muted)' : '#fff',
                  borderRadius: 'var(--radius)',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                {generating ? '生成中...' : '基于使用分析生成'}
              </button>
            )}
            <button
              onClick={handleEnrichedGenerate}
              disabled={generating}
              style={{
                padding: '12px 32px',
                background: generating ? 'var(--bg-tertiary)' : '#a78bfa',
                color: generating ? 'var(--text-muted)' : '#fff',
                borderRadius: 'var(--radius)',
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              {generating ? '生成中...' : '深度画像生成'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const steps = path.steps.map((step) => {
    if (step.lesson_id && completedIds.has(step.lesson_id)) {
      return { ...step, status: 'completed' as const }
    }
    return step
  })

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <Link
            to="/"
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              marginBottom: '8px',
              display: 'inline-block',
            }}
          >
            &larr; 返回首页
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>
            我的学习路线
            {isGoalPath && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#a78bfa',
                  marginLeft: '10px',
                  padding: '2px 10px',
                  background: '#a78bfa20',
                  borderRadius: '20px',
                }}
              >
                深度画像
              </span>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleEnrichedGenerate}
            disabled={generating}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              color: '#a78bfa',
              border: '1px solid #a78bfa',
              borderRadius: 'var(--radius)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {generating ? '生成中...' : '深度画像生成'}
          </button>
          {!usageProfile && (
            <button
              onClick={handleAnalyzeUsage}
              disabled={analyzing}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {analyzing ? '分析中...' : '分析使用记录'}
            </button>
          )}
          {usageProfile && (
            <button
              onClick={handleGoalGenerate}
              disabled={generating}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                color: 'var(--success)',
                border: '1px solid var(--success)',
                borderRadius: 'var(--radius)',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {generating ? '生成中...' : '基于使用分析重新生成'}
            </button>
          )}
          {versions.length > 1 && (
            <select
              value={selectedVersionId ?? path?.id ?? ''}
              onChange={(e) => {
                const vid = parseInt(e.target.value)
                if (vid && vid !== path?.id) handleSelectVersion(vid)
              }}
              style={{
                padding: '7px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none',
              }}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} — {v.generated_at.slice(0, 10)} {v.is_active ? '(当前)' : ''} (
                  {v.step_count}步)
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: '8px 20px',
              background: 'transparent',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {generating ? '生成中...' : '重新生成'}
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', paddingLeft: '32px' }}>
        <div
          style={{
            position: 'absolute',
            left: '15px',
            top: '8px',
            bottom: '8px',
            width: '2px',
            background: 'var(--border)',
          }}
        />

        {steps.map((step, i) => {
          const statusInfo = STATUS_STYLE[step.status] || STATUS_STYLE.available
          const color = STEP_COLORS[step.step_type] || 'var(--accent)'
          const isClickable = step.status !== 'locked' && step.lesson_id

          return (
            <div
              key={i}
              style={{ position: 'relative', marginBottom: i < steps.length - 1 ? '20px' : '0' }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '-23px',
                  top: '8px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background:
                    step.status === 'completed'
                      ? 'var(--success)'
                      : step.status === 'in_progress'
                        ? color
                        : 'var(--bg-tertiary)',
                  border:
                    step.status === 'available' ? `2px solid ${color}` : '2px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: step.status === 'completed' ? '#fff' : 'var(--text-muted)',
                  zIndex: 1,
                }}
              >
                {step.status === 'completed' ? '?' : step.status === 'in_progress' ? '?' : ''}
              </div>

              <div
                onClick={() => handleStepClick(step)}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  border:
                    step.status === 'in_progress'
                      ? `1px solid ${color}`
                      : '1px solid var(--border)',
                  padding: '16px 20px',
                  cursor: isClickable ? 'pointer' : 'default',
                  opacity: step.status === 'locked' ? 0.5 : 1,
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (isClickable) e.currentTarget.style.borderColor = color
                }}
                onMouseLeave={(e) => {
                  if (isClickable)
                    e.currentTarget.style.borderColor =
                      step.status === 'in_progress' ? color : 'var(--border)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '6px',
                  }}
                >
                  <span
                    style={{
                      background: `${color}20`,
                      color,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {statusInfo.label}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {STEP_ICONS[step.step_type]}{' '}
                    {step.step_type === 'course_lesson'
                      ? '课时'
                      : step.step_type === 'ai_concept'
                        ? '概念'
                        : step.step_type === 'practice_quiz'
                          ? '测验'
                          : '项目'}
                  </span>
                  <span
                    style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}
                  >
                    ~{step.estimated_minutes}分钟
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    marginBottom: '4px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {step.order}. {step.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {step.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
