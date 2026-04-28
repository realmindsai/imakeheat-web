import { describe, it, expect } from 'vitest'
import { relativeTime } from '../../src/lib/time'

const NOW = new Date('2026-04-28T19:00:00Z').getTime()

describe('relativeTime', () => {
  it('returns "just now" within 60 seconds', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('just now')
  })

  it('returns "Nm ago" within an hour', () => {
    expect(relativeTime(NOW - 8 * 60_000, NOW)).toBe('8m ago')
  })

  it('returns "Nh ago" within a day', () => {
    expect(relativeTime(NOW - 3 * 3600_000, NOW)).toBe('3h ago')
  })

  it('returns "yesterday" between 24 and 48 hours', () => {
    expect(relativeTime(NOW - 30 * 3600_000, NOW)).toBe('yesterday')
  })

  it('returns "DD MMM" past 48 hours', () => {
    const tenDaysAgo = NOW - 10 * 24 * 3600_000
    expect(relativeTime(tenDaysAgo, NOW)).toBe('18 Apr')
  })
})
