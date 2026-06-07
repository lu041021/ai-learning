import { useCallback, useEffect, useRef, useState } from 'react'
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

function resolveVar(canvas: HTMLCanvasElement, name: string, fallback: string): string {
  return getComputedStyle(canvas).getPropertyValue(name).trim() || fallback
}

export function ForceGraph({ nodes, edges, positions, onNodeClick, selectedNodeId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>(0)

  const hitTest = useCallback(
    (cx: number, cy: number, canvasEl: HTMLCanvasElement): ConceptNode | null => {
      const rect = canvasEl.getBoundingClientRect()
      const mx = (cx - rect.left - pan.x) / scale
      const my = (cy - rect.top - pan.y) / scale
      for (let i = nodes.length - 1; i >= 0; i--) {
        const [px, py] = positions[i]
        const r = getRadius(nodes[i])
        if ((mx - px) ** 2 + (my - py) ** 2 <= r * r) return nodes[i]
      }
      return null
    },
    [nodes, positions, pan, scale],
  )

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
      }

      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(scale, scale)

      const colorAccent = resolveVar(canvas, '--accent', '#6366f1')
      const colorBorder = resolveVar(canvas, '--border', '#e2e8f0')
      const colorSuccess = resolveVar(canvas, '--success', '#22c55e')
      const colorWarning = resolveVar(canvas, '--warning', '#f59e0b')
      const colorBgTertiary = resolveVar(canvas, '--bg-tertiary', '#f1f5f9')
      const colorText = resolveVar(canvas, '--text-primary', '#1e293b')

      const focusId = hoveredId ?? selectedNodeId ?? null
      const connectedIds = new Set<number>()
      const connectedEdgeKeys = new Set<string>()
      if (focusId !== null) {
        edges.forEach((e) => {
          if (e.sourceId === focusId || e.targetId === focusId) {
            connectedIds.add(e.sourceId)
            connectedIds.add(e.targetId)
            connectedEdgeKeys.add(`${e.sourceId}-${e.targetId}`)
          }
        })
      }

      const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]))

      // Draw edges
      edges.forEach((e) => {
        const si = nodeIndex.get(e.sourceId)
        const ti = nodeIndex.get(e.targetId)
        if (si === undefined || ti === undefined) return
        const key = `${e.sourceId}-${e.targetId}`
        const isHighlighted = connectedEdgeKeys.has(key)
        ctx.beginPath()
        ctx.moveTo(positions[si][0], positions[si][1])
        ctx.lineTo(positions[ti][0], positions[ti][1])
        ctx.strokeStyle = isHighlighted ? colorAccent : colorBorder
        ctx.lineWidth = Math.max(0.5, e.weight * 3)
        ctx.globalAlpha = isHighlighted ? 0.8 : connectedEdgeKeys.size > 0 ? 0.1 : 0.4
        ctx.stroke()
        ctx.globalAlpha = 1
      })

      // Draw nodes
      nodes.forEach((node, i) => {
        const [px, py] = positions[i]
        const r = getRadius(node)
        const isFocused = hoveredId === node.id || selectedNodeId === node.id
        const isDimmed = connectedIds.size > 0 && !connectedIds.has(node.id) && !isFocused

        let fillColor = '#94a3b8'
        if (node.lessonCount === 0) fillColor = colorBgTertiary
        else if (node.completedCount === node.lessonCount) fillColor = colorSuccess
        else if (node.completedCount > 0) fillColor = colorWarning

        ctx.globalAlpha = isDimmed ? 0.2 : 1
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fillStyle = fillColor
        ctx.fill()

        if (isFocused) {
          ctx.strokeStyle = colorAccent
          ctx.lineWidth = 2.5
          ctx.stroke()
        }

        ctx.fillStyle = '#fff'
        ctx.font = `600 ${Math.min(13, 10 + node.lessonCount * 0.5)}px system-ui`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const innerLabel =
          node.completedCount > 0 && node.completedCount === node.lessonCount
            ? '✓'
            : node.lessonCount > 0
              ? String(node.lessonCount)
              : ''
        ctx.fillText(innerLabel, px, py)

        if (scale >= LABEL_HIDE_SCALE) {
          ctx.fillStyle = colorText
          ctx.font = `${isFocused ? 600 : 400} 11px system-ui`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(node.name, px, py + r + 4)
        }

        ctx.globalAlpha = 1
      })

      ctx.restore()
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [nodes, edges, positions, pan, scale, hoveredId, selectedNodeId])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (e.deltaY < 0 ? 1.12 : 0.9))))
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.buttons) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  const onPointerUp = useCallback(() => setIsDragging(false), [])

  const onPointerMoveHover = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.buttons) return
      const canvas = canvasRef.current
      if (!canvas) return
      const hit = hitTest(e.clientX, e.clientY, canvas)
      setHoveredId(hit ? hit.id : null)
      canvas.style.cursor = hit ? 'pointer' : isDragging ? 'grabbing' : 'grab'
    },
    [hitTest, isDragging],
  )

  const onClickCanvas = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const hit = hitTest(e.clientX, e.clientY, canvas)
      if (hit) onNodeClick?.(hit)
    },
    [hitTest, onNodeClick],
  )

  if (nodes.length === 0) return null

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        onPointerMove(e)
        onPointerMoveHover(e)
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClickCanvas}
    />
  )
}
