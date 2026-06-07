import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/tauri'
import { useUserStore, useProgressStore } from '../stores'
import { useMountedRef } from '../hooks/useMountedRef'
import type { DashboardData, TreeNodeData, WrongAnswerItem } from '../types'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorBlock } from '../components/common/ErrorBlock'

export function ProgressPage() {
  const userId = useUserStore((s) => s.userId)
  const [data, setData] = useState<DashboardData | null>(null)
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchProgress = useProgressStore((s) => s.fetchProgress)
  const mountedRef = useMountedRef()

  const loadData = useCallback(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    Promise.all([api.getDashboardData(userId), api.getWrongAnswers(userId)])
      .then(([d, wa]) => {
        if (mountedRef.current) {
          setData(d)
          setWrongAnswers(wa)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setError('加载进度数据失败')
          setLoading(false)
        }
      })
  }, [userId, mountedRef])

  useEffect(() => {
    document.title = '学习进度 - AI 学堂'
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    loadData()
  }, [loadData])

  const handleRefresh = () => {
    if (userId) {
      fetchProgress(userId)
      loadData()
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorBlock message={error} onRetry={handleRefresh} />
  }

  if (!data) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
        暂无数据
      </div>
    )
  }

  const avgPct = data.total_quizzes > 0 ? Math.round(data.avg_quiz_score * 100) : 0

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>学习进度</h1>
        <button
          onClick={handleRefresh}
          style={{
            padding: '6px 14px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            border: '1px solid var(--border)',
          }}
        >
          刷新
        </button>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        {[
          {
            label: '已完成课时',
            value: `${data.completed_lessons}/${data.total_lessons}`,
            color: 'var(--accent)',
          },
          { label: '已完成测验', value: String(data.total_quizzes), color: 'var(--warning)' },
          {
            label: '平均得分',
            value: data.total_quizzes > 0 ? `${avgPct}%` : '-',
            color: 'var(--success)',
          },
          { label: '学习天数', value: String(data.calendar_days.length), color: '#a78bfa' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '20px 16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '32px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        {/* Skill Radar */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
          }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              marginBottom: '16px',
              color: 'var(--text-primary)',
            }}
          >
            技能雷达
          </h3>
          <SkillRadar items={data.skill_radar} />
        </div>

        {/* Learning Calendar */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
          }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              marginBottom: '16px',
              color: 'var(--text-primary)',
            }}
          >
            学习热力图
          </h3>
          <CalendarHeatmap days={data.calendar_days} />
        </div>
      </div>

      {/* Course Progress Bars */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '24px',
          marginBottom: '28px',
        }}
      >
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 600,
            marginBottom: '16px',
            color: 'var(--text-primary)',
          }}
        >
          课程进度
        </h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {data.course_progress.map((cp) => {
            const pct =
              cp.total_lessons > 0 ? Math.round((cp.completed_lessons / cp.total_lessons) * 100) : 0
            return (
              <Link
                key={cp.course_id}
                to={`/courses/${cp.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}
                      >
                        {cp.title}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {cp.completed_lessons}/{cp.total_lessons} 课时
                      </span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: pct === 100 ? 'var(--success)' : 'var(--accent)',
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Knowledge Tree */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '24px',
          marginBottom: '28px',
        }}
      >
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 600,
            marginBottom: '20px',
            color: 'var(--text-primary)',
          }}
        >
          知识树
        </h3>
        <KnowledgeTree tree={data.knowledge_tree} />
      </div>

      {/* Wrong Answers / Error Notebook */}
      {wrongAnswers.length > 0 && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
            marginBottom: '28px',
          }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              marginBottom: '20px',
              color: 'var(--text-primary)',
            }}
          >
            错题本 ({wrongAnswers.length} 道错题)
          </h3>
          {(() => {
            const grouped = new Map<string, WrongAnswerItem[]>()
            for (const wa of wrongAnswers) {
              const key = wa.course_slug
              if (!grouped.has(key)) grouped.set(key, [])
              grouped.get(key)!.push(wa)
            }
            return Array.from(grouped.entries()).map(([courseSlug, items]) => (
              <div key={courseSlug} style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {courseSlug}
                </div>
                {items.map((wa, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      padding: '16px',
                      marginBottom: '10px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        marginBottom: '8px',
                      }}
                    >
                      {wa.question_text}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                        fontSize: '13px',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--danger)', fontWeight: 500 }}>你的答案: </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {wa.your_answer_index >= 0 && wa.options[wa.your_answer_index]
                            ? `${String.fromCharCode(65 + wa.your_answer_index)}. ${wa.options[wa.your_answer_index]}`
                            : '未作答'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--success)', fontWeight: 500 }}>正确答案: </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {String.fromCharCode(65 + wa.correct_answer_index)}.{' '}
                          {wa.options[wa.correct_answer_index]}
                        </span>
                      </div>
                    </div>
                    {wa.explanation && (
                      <div
                        style={{
                          marginTop: '8px',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          lineHeight: 1.5,
                          background: 'rgba(139, 92, 246, 0.06)',
                          borderRadius: '6px',
                          padding: '8px 12px',
                        }}
                      >
                        {wa.explanation}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {wa.lesson_title} · {wa.attempted_at}
                      </span>
                      <Link
                        to={`/courses/${wa.course_slug}/lessons/${wa.lesson_id}/quiz`}
                        style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}
                      >
                        重新测验 &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ))
          })()}
        </div>
      )}

      {wrongAnswers.length === 0 && data.total_quizzes > 0 && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '20px',
            marginBottom: '28px',
            textAlign: 'center',
            color: 'var(--success)',
            fontSize: '14px',
          }}
        >
          全部正确！继续保持！
        </div>
      )}
    </div>
  )
}

function SkillRadar({ items }: { items: { label: string; score: number }[] }) {
  if (items.length < 3) {
    return (
      <div
        style={{
          color: 'var(--text-muted)',
          fontSize: '13px',
          textAlign: 'center',
          padding: '32px 0',
        }}
      >
        完成入门评估以获得个性化技能雷达
      </div>
    )
  }

  const cx = 130
  const cy = 130
  const r = 100
  const n = items.length
  const angleStep = (2 * Math.PI) / n

  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2
    const dist = r * value
    return `${cx + dist * Math.cos(angle)},${cy + dist * Math.sin(angle)}`
  }

  const levels = [0.25, 0.5, 0.75, 1.0]
  const gridPolygons = levels.map((level) => {
    const points = Array.from({ length: n }, (_, i) => getPoint(i, level))
    return points.join(' ')
  })

  const dataPolygon = Array.from({ length: n }, (_, i) => getPoint(i, items[i].score)).join(' ')

  return (
    <svg viewBox="0 0 260 260" style={{ width: '100%', maxHeight: '280px' }}>
      {gridPolygons.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          opacity={i === 3 ? 0.6 : 0.3}
        />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const angle = angleStep * i - Math.PI / 2
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + r * Math.cos(angle)}
            y2={cy + r * Math.sin(angle)}
            stroke="var(--border)"
            strokeWidth="1"
            opacity={0.5}
          />
        )
      })}
      <polygon
        points={dataPolygon}
        fill="rgba(59, 130, 246, 0.15)"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      {items.map((item, i) => {
        const angle = angleStep * i - Math.PI / 2
        const lx = cx + (r + 22) * Math.cos(angle)
        const ly = cy + (r + 22) * Math.sin(angle)
        return (
          <text
            key={i}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-secondary)"
            fontSize="11"
          >
            {item.label}
          </text>
        )
      })}
    </svg>
  )
}

function CalendarHeatmap({ days }: { days: { date: string; count: number }[] }) {
  const dayMap = new Map(days.map((d) => [d.date, d.count]))
  const weeks: { date: string; count: number }[][] = []
  const today = new Date()
  const totalDays = 84

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const weekIdx = Math.floor((totalDays - 1 - i) / 7)
    if (!weeks[weekIdx]) weeks[weekIdx] = []
    weeks[weekIdx].push({ date: dateStr, count: dayMap.get(dateStr) ?? 0 })
  }

  const maxCount = Math.max(1, ...days.map((d) => d.count))

  const getColor = (count: number) => {
    if (count === 0) return 'var(--bg-tertiary)'
    const t = count / maxCount
    if (t < 0.33) return 'rgba(59, 130, 246, 0.3)'
    if (t < 0.66) return 'rgba(59, 130, 246, 0.55)'
    return 'rgba(59, 130, 246, 0.85)'
  }

  const dayLabels = ['', '一', '', '三', '', '五', '']

  return (
    <div style={{ overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: '3px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'repeat(7, 12px)',
            gap: '3px',
            marginRight: '4px',
          }}
        >
          {dayLabels.map((l, i) => (
            <div
              key={i}
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                lineHeight: '12px',
                textAlign: 'right',
                width: '16px',
              }}
            >
              {l}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            style={{ display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gap: '3px' }}
          >
            {week.map((day, di) => (
              <div
                key={di}
                title={`${day.date}: ${day.count} 次测验`}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  background: getColor(day.count),
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '4px',
          marginTop: '8px',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}
      >
        少
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            background: 'var(--bg-tertiary)',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            background: 'rgba(59,130,246,0.3)',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            background: 'rgba(59,130,246,0.55)',
          }}
        />
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            background: 'rgba(59,130,246,0.85)',
          }}
        />
        多
      </div>
    </div>
  )
}

function KnowledgeTree({ tree }: { tree: TreeNodeData[] }) {
  const navigate = useNavigate()
  const nodeW = 110
  const layerGap = 130
  const nodeH = 28
  const vGap = 14

  const flatten = (
    nodes: TreeNodeData[],
    depth: number,
  ): { node: TreeNodeData; depth: number; row: number }[] => {
    const result: { node: TreeNodeData; depth: number; row: number }[] = []
    let row = 0
    const walk = (ns: TreeNodeData[], d: number) => {
      for (const n of ns) {
        const currentRow = row
        result.push({ node: n, depth: d, row: currentRow })
        row += 1
        if (n.children.length > 0) {
          walk(n.children, d + 1)
        }
      }
    }
    walk(nodes, depth)
    return result
  }

  const flatNodes = flatten(tree, 0)
  if (flatNodes.length === 0) {
    return (
      <div
        style={{
          color: 'var(--text-muted)',
          fontSize: '13px',
          textAlign: 'center',
          padding: '20px 0',
        }}
      >
        暂无课程数据
      </div>
    )
  }

  const totalRows = flatNodes.length
  const svgH = totalRows * (nodeH + vGap) + 20

  const nodeMap = new Map<number, { depth: number; row: number }>()
  for (const fn of flatNodes) {
    nodeMap.set(fn.node.id, { depth: fn.depth, row: fn.row })
  }

  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (const fn of flatNodes) {
    const parentX = fn.depth * layerGap + nodeW
    const parentY = fn.row * (nodeH + vGap) + nodeH / 2
    for (const child of fn.node.children) {
      const childInfo = nodeMap.get(child.id)
      if (childInfo) {
        const childX = childInfo.depth * layerGap
        const childY = childInfo.row * (nodeH + vGap) + nodeH / 2
        edges.push({ x1: parentX, y1: parentY, x2: childX, y2: childY })
      }
    }
  }

  const getSlug = (node: TreeNodeData): string | null => {
    if (node.course_slug) return node.course_slug
    for (const fn of flatNodes) {
      if (fn.node.children.some((c) => c.id === node.id)) {
        return fn.node.course_slug
      }
    }
    return null
  }

  const maxDepth = Math.max(...flatNodes.map((f) => f.depth))
  const svgW = (maxDepth + 1) * layerGap + 40

  return (
    <div style={{ overflow: 'auto' }}>
      <svg width={svgW} height={svgH} style={{ minWidth: '100%' }}>
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="var(--border)"
            strokeWidth="1.5"
          />
        ))}
        {flatNodes.map(({ node, depth, row }) => {
          const x = depth * layerGap
          const y = row * (nodeH + vGap)
          const isLesson = node.kind === 'lesson'
          const slug = getSlug(node)
          const navTo = isLesson && slug ? `/courses/${slug}/lessons/${node.id}` : undefined
          return (
            <g key={node.id}>
              <rect
                x={x}
                y={y}
                width={nodeW}
                height={nodeH}
                rx="6"
                fill={node.completed ? 'rgba(34, 197, 94, 0.12)' : 'var(--bg-tertiary)'}
                stroke={node.completed ? 'var(--success)' : 'var(--border)'}
                strokeWidth="1.5"
                style={navTo ? { cursor: 'pointer' } : undefined}
                onClick={navTo ? () => navigate(navTo) : undefined}
              />
              <text
                x={x + 8}
                y={y + nodeH / 2 + 1}
                dominantBaseline="middle"
                fill={node.completed ? 'var(--success)' : 'var(--text-secondary)'}
                fontSize="11"
                fontWeight={node.kind === 'course' ? 600 : 400}
                style={
                  navTo ? { cursor: 'pointer', pointerEvents: 'none' } : { pointerEvents: 'none' }
                }
              >
                {node.title.length > 10 ? node.title.slice(0, 10) + '...' : node.title}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
