import { describe, expect, it } from 'vitest'
import { registry } from '../../../src/audio/effects/registry'

const def = registry.get('compressor')

describe('compressor definition', () => {
  it('has conservative defaults', () => {
    expect(def?.defaultParams).toEqual({
      sustain: 0,
      attack: 50,
      ratio: 0,
      level: 100,
    })
  })

  it('is neutral only at the exact defaults', () => {
    expect(def?.isNeutral({
      sustain: 0,
      attack: 50,
      ratio: 0,
      level: 100,
    } as never)).toBe(true)
    expect(def?.isNeutral({
      sustain: 5,
      attack: 50,
      ratio: 0,
      level: 100,
    } as never)).toBe(false)
    expect(def?.isNeutral({
      sustain: 0,
      attack: 20,
      ratio: 0,
      level: 100,
    } as never)).toBe(false)
  })
})
