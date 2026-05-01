import { describe, it, expect } from 'vitest'
import { registry } from '../../../src/audio/effects/registry'

describe('Isolator definition', () => {
  it('defaults to neutral gains', () => {
    const def = registry.get('isolator')
    expect(def?.defaultParams).toEqual({ low: 0, mid: 0, high: 0 })
  })

  it('isNeutral only returns true when all bands are exactly zero', () => {
    const def = registry.get('isolator')
    expect(def?.isNeutral({ low: 0, mid: 0, high: 0 })).toBe(true)
    expect(def?.isNeutral({ low: -1, mid: 0, high: 0 })).toBe(false)
    expect(def?.isNeutral({ low: 0, mid: 1, high: 0 })).toBe(false)
    expect(def?.isNeutral({ low: 0, mid: 0, high: 0.5 })).toBe(false)
  })
})
