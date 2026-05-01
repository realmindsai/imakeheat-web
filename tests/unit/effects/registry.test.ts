import { describe, it, expect } from 'vitest'
import { registry } from '../../../src/audio/effects/registry'

describe('effect registry', () => {
  it('exposes all nine effect kinds after Cassette Sim lands', () => {
    const kinds = Array.from(registry.keys()).sort()
    expect(kinds).toEqual([
      'cassette',
      'crusher',
      'echo',
      'filter',
      'pitch',
      'reverb',
      'srhold',
      'vinyl303',
      'vinyl404',
    ])
  })
  it('every definition has the required shape', () => {
    for (const def of registry.values()) {
      expect(typeof def.kind).toBe('string')
      expect(typeof def.displayName).toBe('string')
      expect(typeof def.isNeutral).toBe('function')
      expect(typeof def.build).toBe('function')
      expect(def.defaultParams).toBeDefined()
    }
  })
})
