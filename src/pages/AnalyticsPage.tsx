import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUserStore } from '../stores'
import { api } from '../api/tauri'
import type { AnalyticsData } from '../types'

function ActivityBarChart({ data }: { data: { week: string; sessions: number; lessonsCompleted: number }[] }) {
  if (data.length === 0) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>暂无活动数据</div>
  const w = 600
  const h = 200
  const pad = { top: 10, right: 20, bottom: 30, left: 40 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  const barW = chartW / data.length * 0.6
  const gap = chartW / data.length * 0.4
  const maxVal = Math.max(...data.map((d) => d.sessions), 1)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      {data.map((d, i) => (
        <g key={d.week}>
          <rect
            x={pad.left + i * (barW + gap)}
            y={pad.top + chartH - (d.sessions / maxVal) * chartH}
            width={barW}
            height={(d.sessions / maxVal) * chartH}
            rx={3}
            fill="var(--accent)"
            opacity={0.8}
          />
          <text
            x={pad.left + i * (barW + gap) + barW / 2}
            y={h - 8}
            textAnchor="middle"
            fontSize={9}
            fill="var(--text-muted)"
          >
            {d.week.replace(/^\d{4}-/, '')}
          </text>
          <text
            x={pad.left + i * (barW + gap) + barW / 2}
            y={pad.top + chartH - (d.sessions / maxVal) * chartH - 4}
            textAnchor="middle"
            fontSize={9}
            fill="var(--text-muted)"
          >
            {d.sessions}
          </text>
        </g>
      ))}
    </svg>
  )
}

function AccuracyLineChart({ data }: { data: { label: string; score: number }[] }) {
  if (data.length === 0) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>暂无准确率数据</div>
  const w = 600
  const h = 200
  const pad = { top: 10, right: 20, bottom: 30, left: 40 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom

  const minScore = Math.min(0, ...data.map((d) => d.score))
  const maxScore = Math.max(100, ...data.map((d) => d.score))
  const range = maxScore - minScore || 1

  const points = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1 || 1)) * chartW,
    y: pad.top + chartH - ((d.score - minScore) / range) * chartH,
    ...d,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const fillD = pathD + ` L ${points[points.length - 1].x} ${pad.top + chartH} L ${points[0].x} ${pad.top + chartH} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      <path d={fillD} fill="var(--accent-light)" opacity={0.3} />
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
          <text x={p.x} y={h - 8} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
            {p.label.replace(/^\d{4}-/, '')}
          </text>
          {i % Math.ceil(points.length / 6) === 0 && (
            <text x={p.x - 16} y={p.y + 4} textAnchor="end" fontSize={9} fill="var(--accent)">
              {p.score}%
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

function DomainBars({ data }: { data: { domain: string; accuracy: number; attempts: number }[] }) {
  if (data.length === 0) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px', fontSize: '13px' }}>暂无领域数据</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {data.map((d) => (
        <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '120px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
            {d.domain}
          </div>
          <div style={{ flex: 1, height: '18px', borderRadius: '4px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '4px',
              width: `${d.accuracy}%`,
              background: d.accuracy >= 80 ? 'var(--success)' : d.accuracy >= 50 ? 'var(--warning)' : 'var(--danger)',
            }} />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '50px' }}>
            {d.accuracy}%
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '40px' }}>
            {d.attempts}次
          </span>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsPage() {
  const userId = useUserStore((s) => s.userId)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    document.title = '学习分析 - AI 学堂'
    if (userId) {
      api.getAnalytics(userId).then((d) => {
        if (mountedRef.current) { setData(d); setLoading(false) }
      }).catch(() => {
        if (mountedRef.current) setLoading(false)
      })
    }
    return () => { mountedRef.current = false }
  }, [userId])

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>加载中...</div>
  }

  if (!data) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '60px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x1F4CA;</div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>暂无学习数据</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          开始学习并完成测验后，这里会展示详细的学习分析
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>学习分析</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>深入了解你的学习模式和知识掌握情况</p>
      </div>

      {/* Row 1: Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: '完成率', value: `${data.completionPct}%`, color: 'var(--accent)' },
          { label: '准确率', value: `${data.accuracyPct}%`, color: 'var(--success)' },
          { label: '连续学习', value: `${data.streakDays}天`, sub: `最长 ${data.longestStreak} 天`, color: 'var(--warning)' },
          { label: '复习率', value: `${data.reviewRate.toFixed(1)}x`, sub: '每题平均', color: '#a78bfa' },
        ].map((card) => (
          <div key={card.label} style={{
            padding: '16px', background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: card.color, marginBottom: '4px' }}>
              {card.value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{card.label}</div>
            {card.sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Row 2: Activity + Accuracy Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', padding: '20px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>每周学习活动</h3>
          <ActivityBarChart
            data={data.weeklyActivity.map((w) => ({
              week: w.week,
              sessions: w.sessions,
              lessonsCompleted: w.lessonsCompleted,
            }))}
          />
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', padding: '20px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>准确率趋势</h3>
          <AccuracyLineChart data={data.accuracyTrend} />
        </div>
      </div>

      {/* Row 3: Domain accuracy */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', padding: '20px',
        marginBottom: '24px',
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>领域掌握度</h3>
        <DomainBars data={data.domainAccuracy} />
      </div>

      {/* Row 4: Weak & Strong areas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', padding: '20px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: 'var(--danger)' }}>
            需要加强
          </h3>
          {data.weakAreas.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
              暂无薄弱项，继续保持！
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.weakAreas.map((w, i) => (
                <Link
                  key={i}
                  to={`/courses/${w.courseSlug}/lessons/${w.lessonId}`}
                  style={{
                    display: 'block', padding: '10px 14px',
                    background: 'var(--bg-primary)', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {w.conceptName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{w.lessonTitle}</div>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)' }}>
                      {w.accuracy}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', padding: '20px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: 'var(--success)' }}>
            已掌握领域
          </h3>
          {data.strongAreas.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
              完成更多课程来积累强项
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {data.strongAreas.map((s, i) => (
                <span key={i} style={{
                  padding: '4px 12px', borderRadius: '12px',
                  background: 'var(--success-light)', color: 'var(--success)',
                  fontSize: '12px', fontWeight: 500,
                }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-course detail */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', padding: '20px',
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>课程详情</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.perCourse.map((c) => (
            <Link
              key={c.courseId}
              to={`/courses/${c.slug}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '10px 14px',
                background: 'var(--bg-primary)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {c.title}
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    进度 {c.completed}/{c.totalLessons}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    测验 {c.quizAttempts}次
                  </span>
                </div>
              </div>
              <div style={{
                width: '120px', height: '6px', borderRadius: '3px',
                background: 'var(--bg-tertiary)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  width: `${c.totalLessons > 0 ? (c.completed / c.totalLessons) * 100 : 0}%`,
                  background: 'var(--accent)',
                }} />
              </div>
              <span style={{
                fontSize: '13px', fontWeight: 600, width: '50px', textAlign: 'right',
                color: c.avgQuizScore >= 80 ? 'var(--success)' : c.avgQuizScore >= 50 ? 'var(--warning)' : 'var(--text-muted)',
              }}>
                {c.avgQuizScore}%
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
