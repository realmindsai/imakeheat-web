import { describe, expect, it } from 'vitest'
import { registry } from '../../../src/audio/effects/registry'

const def = registry.get('filterDrive')

describe('filterDrive definition', () => {
  it('has conservative defaults', () => {
    expect(def?.defaultParams).toEqual({
      cutoffHz: 16000,
      resonance: 0,
      drive: 0,
      filterType: 'lowpass',
      lowFreq: 200,
      lowGain: 0,
    })
  })

  it('is neutral only at the exact defaults', () => {
    expect(def?.isNeutral({
      cutoffHz: 16000,
      resonance: 0,
      drive: 0,
      filterType: 'lowpass',
      lowFreq: 200,
      lowGain: 0,
    } as never)).toBe(true)
    expect(def?.isNeutral({
      cutoffHz: 10000,
      resonance: 0,
      drive: 0,
      filterType: 'lowpass',
      lowFreq: 200,
      lowGain: 0,
    } as never)).toBe(false)
    expect(def?.isNeutral({
      cutoffHz: 16000,
      resonance: 0,
      drive: 10,
      filterType: 'lowpass',
      lowFreq: 200,
      lowGain: 0,
    } as never)).toBe(false)
  })
})
