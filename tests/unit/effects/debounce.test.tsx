import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedCallback } from '../../../src/audio/effects/_debounce'

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not fire before the delay', () => {
    const fn = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(fn, 300))
    act(() => {
      result.current('a')
    })
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(fn).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('coalesces multiple calls into a single fire after the delay', () => {
    const fn = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(fn, 300))
    act(() => {
      result.current(1)
      result.current(2)
      result.current(3)
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(3)
  })

  it('latest args win when calls are spaced inside the window', () => {
    const fn = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(fn, 300))
    act(() => {
      result.current('first')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    act(() => {
      result.current('second')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(fn).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('second')
  })

  it('cleans up the pending timer on unmount', () => {
    const fn = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 300))
    act(() => {
      result.current('x')
    })
    unmount()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(fn).not.toHaveBeenCalled()
  })
})
