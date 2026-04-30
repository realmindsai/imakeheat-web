// ABOUTME: useDebouncedCallback — fires fn after a delay, used by echo/reverb panels.
// ABOUTME: Latest call wins; pending timers are cleared. Cleanup-safe on unmount.

import { useEffect, useRef } from 'react'

export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay = 300,
): (...args: A) => void {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  }, [fn])
  useEffect(
    () => () => {
      if (t.current) clearTimeout(t.current)
    },
    [],
  )
  return (...args: A) => {
    if (t.current) clearTimeout(t.current)
    t.current = setTimeout(() => fnRef.current(...args), delay)
  }
}
