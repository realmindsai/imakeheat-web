import { describe, expect, it } from 'vitest'
import { registry } from '../../../src/audio/effects/registry'

const def = registry.get('wrmSaturator')

describe('wrmSaturator definition', () => {
  it('has dry-bypass defaults', () => {
    expect(def?.defaultParams).toEqual({
      amount: 0.4,
      bias: 0,
      tone: 0.5,
      mix: 0,
      level: 0.8,
    })
  })

  it('is neutral only when mix is near dry', () => {
    expect(def?.isNeutral({ amount: 0.4, bias: 0, tone: 0.5, mix: 0, level: 0.8 } as never)).toBe(true)
    expect(def?.isNeutral({ amount: 0.4, bias: 0, tone: 0.5, mix: 0.2, level: 0.8 } as never)).toBe(false)
  })
})
