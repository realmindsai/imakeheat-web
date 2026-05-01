import { describe, expect, it } from 'vitest'
import { registry } from '../../../src/audio/effects/registry'

const def = registry.get('distortion')

describe('distortion definition', () => {
  it('has dry-bypass defaults', () => {
    expect(def?.defaultParams).toEqual({
      drive: 0.5,
      tone: 0.55,
      level: 0.75,
      mix: 0,
    })
  })

  it('is neutral only when mix is near dry', () => {
    expect(def?.isNeutral({ drive: 0.5, tone: 0.55, level: 0.75, mix: 0 } as never)).toBe(true)
    expect(def?.isNeutral({ drive: 0.5, tone: 0.55, level: 0.75, mix: 0.2 } as never)).toBe(false)
  })
})
