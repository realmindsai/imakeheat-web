import { describe, expect, it } from 'vitest'
import { registry } from '../../../src/audio/effects/registry'

const def = registry.get('overdrive')

describe('overdrive definition', () => {
  it('has dry-bypass defaults', () => {
    expect(def?.defaultParams).toEqual({
      drive: 0.35,
      tone: 0.5,
      level: 0.8,
      mix: 0,
    })
  })

  it('is neutral only when mix is near dry', () => {
    expect(def?.isNeutral({
      drive: 0.35,
      tone: 0.5,
      level: 0.8,
      mix: 0,
    } as never)).toBe(true)

    expect(def?.isNeutral({
      drive: 0,
      tone: 0,
      level: 0,
      mix: 0.1,
    } as never)).toBe(false)
  })
})
