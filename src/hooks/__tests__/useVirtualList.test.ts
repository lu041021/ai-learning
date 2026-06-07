import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVirtualList } from '../useVirtualList'

describe('useVirtualList', () => {
  it('computes totalHeight correctly', () => {
    const { result } = renderHook(() => useVirtualList({ itemCount: 100, itemHeight: 50 }))
    expect(result.current.totalHeight).toBe(5000)
  })

  it('returns full range when scrollTop is 0', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemCount: 100, itemHeight: 50, overscan: 0 }),
    )
    const { start, end } = result.current.getVisibleRange(200)
    expect(start).toBe(0)
    expect(end).toBe(4) // start(0) + visibleCount(4) + overscan(0)*2 = 4
  })

  it('applies overscan to visible range', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemCount: 100, itemHeight: 50, overscan: 2 }),
    )
    const { start, end } = result.current.getVisibleRange(200)
    expect(start).toBe(0) // max(0, 0 - 2)
    expect(end).toBe(8) // start(0) + visibleCount(4) + overscan(2)*2 = 8
  })

  it('updates visible range after scroll', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemCount: 100, itemHeight: 50, overscan: 0 }),
    )
    act(() => {
      result.current.onScroll({
        currentTarget: { scrollTop: 250 },
      } as unknown as React.UIEvent<HTMLDivElement>)
    })
    const { start, end } = result.current.getVisibleRange(200)
    expect(start).toBe(5) // floor(250/50)
    expect(end).toBe(9) // start(5) + visibleCount(4) + overscan(0)*2 = 9
  })

  it('clamps end to itemCount - 1', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemCount: 5, itemHeight: 50, overscan: 0 }),
    )
    const { end } = result.current.getVisibleRange(600)
    expect(end).toBe(4) // clamped to 5 - 1
  })

  it('clamps start to 0 when scroll is small', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemCount: 100, itemHeight: 50, overscan: 5 }),
    )
    act(() => {
      result.current.onScroll({
        currentTarget: { scrollTop: 50 },
      } as unknown as React.UIEvent<HTMLDivElement>)
    })
    const { start } = result.current.getVisibleRange(200)
    expect(start).toBe(0) // max(0, 1 - 5) = 0
  })
})
