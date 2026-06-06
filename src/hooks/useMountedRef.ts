import { useEffect, useRef } from 'react'

export function useMountedRef() {
  const ref = useRef(true)
  useEffect(
    () => () => {
      ref.current = false
    },
    [],
  )
  return ref
}
