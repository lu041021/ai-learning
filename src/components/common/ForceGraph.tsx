import { useState } from 'react'
import type { ConceptNode, ConceptEdge } from '../../types'

interface Props {
  nodes: ConceptNode[]
  edges: ConceptEdge[]
  positions: [number, number][]
  onNodeClick?: (node: ConceptNode) => void
  selectedNodeId?: number | null
}

export function ForceGraph({ nodes, edges, positions, onNodeClick, selectedNodeId }: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  if (nodes.length === 0) return null

  const xs = positions.map((p) => p[0])
  const ys = positions.map((p) => p[1])
  const minX = Math.min(...xs) - 80
  const minY = Math.min(...ys) - 80
  const maxX = Math.max(...xs) + 80
  const maxY = Math.max(...ys) + 80
  const width = maxX - minX
  const height = maxY - minY

  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]))

  const getRadius = (node: ConceptNode) => 18 + node.lessonCount * 5
  const getColor = (node: ConceptNode) => {
    if (node.lessonCount === 0) return 'var(--bg-tertiary)'
    if (node.completedCount === node.lessonCount) return 'var(--success)'
    if (node.completedCount > 0) return 'var(--warning)'
    return '#94a3b8'
  }

  const connectedNodeIds = new Set<number>()
  const connectedEdges = new Set<string>()
  if (hoveredId || selectedNodeId) {
    const focusId = hoveredId || selectedNodeId
    edges.forEach((e) => {
      if (e.sourceId === focusId || e.targetId === focusId) {
        connectedNodeIds.add(e.sourceId)
        connectedNodeIds.add(e.targetId)
        connectedEdges.add(`${e.sourceId}-${e.targetId}`)
      }
    })
  }

  return (
    <svg viewBox={`${minX} ${minY} ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
      {/* Edges */}
      {edges.map((e) => {
        const si = nodeIndex.get(e.sourceId)
        const ti = nodeIndex.get(e.targetId)
        if (si === undefined || ti === undefined) return null
        const key = `${e.sourceId}-${e.targetId}`
        const isHighlighted = connectedEdges.has(key)
        return (
          <line
            key={key}
            x1={positions[si][0]}
            y1={positions[si][1]}
            x2={positions[ti][0]}
            y2={positions[ti][1]}
            stroke={isHighlighted ? 'var(--accent)' : 'var(--border)'}
            strokeWidth={Math.max(0.5, e.weight * 3)}
            opacity={isHighlighted ? 0.8 : connectedEdges.size > 0 ? 0.1 : 0.4}
          />
        )
      })}

      {/* Nodes */}
      {nodes.map((node, i) => {
        const r = getRadius(node)
        const isFocused = hoveredId === node.id || selectedNodeId === node.id
        const isDimmed = connectedNodeIds.size > 0 && !connectedNodeIds.has(node.id) && !isFocused

        return (
          <g
            key={node.id}
            transform={`translate(${positions[i][0]}, ${positions[i][1]})`}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onNodeClick?.(node)}
            style={{ cursor: 'pointer', opacity: isDimmed ? 0.2 : 1 }}
          >
            <circle
              r={r}
              fill={getColor(node)}
              stroke={isFocused ? 'var(--accent)' : 'transparent'}
              strokeWidth={2.5}
            />
            <text
              textAnchor="middle"
              dy="0.35em"
              fill="#fff"
              fontSize={Math.min(13, 10 + node.lessonCount * 0.5)}
              fontWeight={600}
            >
              {node.completedCount > 0 && node.completedCount === node.lessonCount
                ? '✓'
                : node.lessonCount || ''}
            </text>
            <text
              textAnchor="middle"
              dy={r + 14}
              fill="var(--text-primary)"
              fontSize={11}
              fontWeight={isFocused ? 600 : 400}
            >
              {node.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
