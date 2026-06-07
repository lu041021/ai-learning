import { useCallback, useRef, useState } from 'react'

interface UseVirtualListOptions {
  itemCount: number
  itemHeight: number
  overscan?: number
}

export function useVirtualList({ itemCount, itemHeight, overscan = 3 }: UseVirtualListOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const getVisibleRange = (containerHeight: number) => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = Math.min(itemCount - 1, start + visibleCount + overscan * 2)
    return { start, end }
  }

  return { containerRef, onScroll, getVisibleRange, totalHeight: itemCount * itemHeight }
}
