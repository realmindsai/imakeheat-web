import { describe, it, expect } from 'vitest'
import { registry } from '../../../src/audio/effects/registry'

describe('effect registry', () => {
  it('exposes all phase1 and phase2 effect kinds', () => {
    const kinds = Array.from(registry.keys()).sort()
    expect(kinds).toEqual([
      'cassette',
      'compressor',
      'crusher',
      'distortion',
      'echo',
      'equalizer',
      'filter',
      'filterDrive',
      'isolator',
      'loFi',
      'overdrive',
      'pitch',
      'reverb',
      'srhold',
      'tapeEcho',
      'timeCtrlDly',
      'vinyl303',
      'vinyl404',
      'wrmSaturator',
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
