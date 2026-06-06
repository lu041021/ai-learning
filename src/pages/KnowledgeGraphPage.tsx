import { useEffect, useState } from 'react'
import { useUserStore } from '../stores'
import { api } from '../api/tauri'
import { ForceGraph } from '../components/common/ForceGraph'
import { useMountedRef } from '../hooks/useMountedRef'
import type { KnowledgeGraphData, ConceptNode } from '../types'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorBlock } from '../components/common/ErrorBlock'

export function KnowledgeGraphPage() {
  const userId = useUserStore((s) => s.userId)
  const [data, setData] = useState<KnowledgeGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null)
  const [filter, setFilter] = useState<'all' | 'mastered' | 'todo'>('all')
  const mountedRef = useMountedRef()

  useEffect(() => {
    document.title = '知识图谱 - AI 学堂'
    if (userId) {
      api
        .getKnowledgeGraph(userId)
        .then((d) => {
          if (mountedRef.current) {
            setData(d)
            setLoading(false)
          }
        })
        .catch(() => {
          if (mountedRef.current) {
            setError('加载知识图谱失败')
            setLoading(false)
          }
        })
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no userId means nothing to load
      setLoading(false)
    }
  }, [userId, mountedRef])

  const filteredData = data
    ? (() => {
        if (filter === 'all') return data
        const filteredNodes = data.nodes.filter((n) =>
          filter === 'mastered'
            ? n.completedCount === n.lessonCount && n.lessonCount > 0
            : n.completedCount < n.lessonCount || n.lessonCount === 0,
        )
        const filteredIds = new Set(filteredNodes.map((n) => n.id))
        const filteredEdges = data.edges.filter(
          (e) => filteredIds.has(e.sourceId) && filteredIds.has(e.targetId),
        )
        const filteredPositions = data.positions.filter((_, i) => filteredIds.has(data.nodes[i].id))
        return { nodes: filteredNodes, edges: filteredEdges, positions: filteredPositions }
      })()
    : null

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorBlock message={error} />
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '60px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#x1F578;</div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>还没有知识图谱</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          请先导入课程并开始学习，系统会自动构建概念图谱
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>知识图谱</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            AI 概念关系网络，帮助你理解知识结构
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'mastered', 'todo'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius)',
                fontSize: '12px',
                fontWeight: 500,
                background: filter === f ? 'var(--accent)' : 'var(--bg-secondary)',
                color: filter === f ? '#fff' : 'var(--text-secondary)',
                border: filter === f ? 'none' : '1px solid var(--border)',
              }}
            >
              {f === 'all' ? '全部' : f === 'mastered' ? '已掌握' : '待学习'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div
          style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            height: '560px',
            overflow: 'hidden',
          }}
        >
          {filteredData && (
            <ForceGraph
              nodes={filteredData.nodes}
              edges={filteredData.edges}
              positions={filteredData.positions}
              selectedNodeId={selectedNode?.id ?? null}
              onNodeClick={setSelectedNode}
            />
          )}
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div
            style={{
              width: '280px',
              flexShrink: 0,
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '20px',
              maxHeight: '560px',
              overflow: 'auto',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              {selectedNode.name}
            </h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>
                  {selectedNode.lessonCount}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>关联课时</div>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)' }}>
                  {selectedNode.completedCount}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>已完成</div>
              </div>
            </div>
            {/* Progress bar */}
            <div
              style={{
                height: '6px',
                borderRadius: '3px',
                background: 'var(--bg-tertiary)',
                marginBottom: '16px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width:
                    selectedNode.lessonCount > 0
                      ? `${(selectedNode.completedCount / selectedNode.lessonCount) * 100}%`
                      : '0%',
                  background:
                    selectedNode.completedCount === selectedNode.lessonCount
                      ? 'var(--success)'
                      : 'var(--warning)',
                  borderRadius: '3px',
                }}
              />
            </div>
            {/* Related concepts */}
            {data &&
              (() => {
                const related = data.edges
                  .filter((e) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id)
                  .map((e) => {
                    const otherId = e.sourceId === selectedNode.id ? e.targetId : e.sourceId
                    return { ...data.nodes.find((n) => n.id === otherId)!, weight: e.weight }
                  })
                  .filter((n) => n.id)
                  .sort((a, b) => b.weight - a.weight)
                  .slice(0, 5)
                if (related.length === 0) return null
                return (
                  <div>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                      }}
                    >
                      关联概念
                    </div>
                    {related.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedNode(r)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 'var(--radius)',
                          fontSize: '13px',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          marginBottom: '4px',
                          background: 'var(--bg-primary)',
                        }}
                      >
                        {r.name}
                        <span
                          style={{ float: 'right', color: 'var(--text-muted)', fontSize: '11px' }}
                        >
                          {Math.round(r.weight * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })()}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          gap: '16px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          justifyContent: 'center',
        }}
      >
        <span>&#x2B24; 灰色 = 未学习</span>
        <span>&#x2B24; 橙色 = 进行中</span>
        <span>&#x2B24; 绿色 = 已掌握</span>
        <span>节点大小 = 关联课时数</span>
      </div>
    </div>
  )
}
