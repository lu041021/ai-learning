import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { ConceptNode, ConceptEdge } from '../../types'

interface Props {
  nodes: ConceptNode[]
  edges: ConceptEdge[]
  positions: [number, number][]
  onNodeClick?: (node: ConceptNode) => void
  selectedNodeId?: number | null
}

const LABEL_HIDE_SCALE = 0.45
const MIN_SCALE = 0.1
const MAX_SCALE = 4

function getRadius(node: ConceptNode) {
  return 18 + node.lessonCount * 5
}

function getColor(node: ConceptNode) {
  if (node.lessonCount === 0) return 'var(--bg-tertiary)'
  if (node.completedCount === node.lessonCount) return 'var(--success)'
  if (node.completedCount > 0) return 'var(--warning)'
  return '#94a3b8'
}

const NodeGroup = memo(function NodeGroup({
  node,
  x,
  y,
  isFocused,
  isDimmed,
  showLabel,
  onEnter,
  onLeave,
  onClick,
}: {
  node: ConceptNode
  x: number
  y: number
  isFocused: boolean
  isDimmed: boolean
  showLabel: boolean
  onEnter: (id: number) => void
  onLeave: () => void
  onClick: (node: ConceptNode) => void
}) {
  const r = getRadius(node)
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={() => onEnter(node.id)}
      onMouseLeave={onLeave}
      onClick={() => onClick(node)}
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
      {showLabel && (
        <text
          textAnchor="middle"
          dy={r + 14}
          fill="var(--text-primary)"
          fontSize={11}
          fontWeight={isFocused ? 600 : 400}
        >
          {node.name}
        </text>
      )}
    </g>
  )
})

export function ForceGraph({ nodes, edges, positions, onNodeClick, selectedNodeId }: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [svgSize, setSvgSize] = useState({ w: 800, h: 560 })
  const lastPos = useRef({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      setSvgSize({ w: el.clientWidth || 800, h: el.clientHeight || 560 })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (e.deltaY < 0 ? 1.12 : 0.9))))
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.buttons) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  const onPointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleEnter = useCallback((id: number) => setHoveredId(id), [])
  const handleLeave = useCallback(() => setHoveredId(null), [])
  const handleClick = useCallback((node: ConceptNode) => onNodeClick?.(node), [onNodeClick])

  if (nodes.length === 0) return null

  const xs = positions.map((p) => p[0])
  const ys = positions.map((p) => p[1])
  const minX = Math.min(...xs) - 80
  const minY = Math.min(...ys) - 80
  const maxX = Math.max(...xs) + 80
  const maxY = Math.max(...ys) + 80
  const graphW = maxX - minX
  const graphH = maxY - minY

  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]))
  const showLabel = scale >= LABEL_HIDE_SCALE

  const connectedNodeIds = new Set<number>()
  const connectedEdges = new Set<string>()
  if (hoveredId || selectedNodeId) {
    const focusId = hoveredId ?? selectedNodeId
    edges.forEach((e) => {
      if (e.sourceId === focusId || e.targetId === focusId) {
        connectedNodeIds.add(e.sourceId)
        connectedNodeIds.add(e.targetId)
        connectedEdges.add(`${e.sourceId}-${e.targetId}`)
      }
    })
  }

  const vw = svgSize.w
  const vh = svgSize.h
  const visMinX = minX + -pan.x / scale
  const visMinY = minY + -pan.y / scale
  const visMaxX = visMinX + vw / scale
  const visMaxY = visMinY + vh / scale
  const MARGIN = 100

  const visibleNodeIdx = new Set<number>()
  nodes.forEach((_, i) => {
    const [px, py] = positions[i]
    if (
      px >= visMinX - MARGIN &&
      px <= visMaxX + MARGIN &&
      py >= visMinY - MARGIN &&
      py <= visMaxY + MARGIN
    ) {
      visibleNodeIdx.add(i)
    }
  })

  return (
    <svg
      ref={svgRef}
      viewBox={`${minX} ${minY} ${graphW} ${graphH}`}
      style={{
        width: '100%',
        height: '100%',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <g transform={`translate(${pan.x / scale}, ${pan.y / scale})`}>
        <g>
          {edges.map((e) => {
            const si = nodeIndex.get(e.sourceId)
            const ti = nodeIndex.get(e.targetId)
            if (si === undefined || ti === undefined) return null
            if (!visibleNodeIdx.has(si) && !visibleNodeIdx.has(ti)) return null
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
        </g>
        <g>
          {nodes.map((node, i) => {
            if (!visibleNodeIdx.has(i)) return null
            const isFocused = hoveredId === node.id || selectedNodeId === node.id
            const isDimmed =
              connectedNodeIds.size > 0 && !connectedNodeIds.has(node.id) && !isFocused
            return (
              <NodeGroup
                key={node.id}
                node={node}
                x={positions[i][0]}
                y={positions[i][1]}
                isFocused={isFocused}
                isDimmed={isDimmed}
                showLabel={showLabel}
                onEnter={handleEnter}
                onLeave={handleLeave}
                onClick={handleClick}
              />
            )
          })}
        </g>
      </g>
    </svg>
  )
}
