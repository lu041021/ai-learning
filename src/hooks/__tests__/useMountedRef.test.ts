import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMountedRef } from '../useMountedRef'

describe('useMountedRef', () => {
  it('starts as mounted', () => {
    const { result } = renderHook(() => useMountedRef())
    expect(result.current.current).toBe(true)
  })

  it('sets to false on unmount', () => {
    const { result, unmount } = renderHook(() => useMountedRef())
    expect(result.current.current).toBe(true)
    unmount()
    expect(result.current.current).toBe(false)
  })
})
