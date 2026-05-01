import { describe, expect, it } from 'vitest'
import { registry } from '../../../src/audio/effects/registry'

const def = registry.get('loFi')

describe('loFi definition', () => {
  it('has dry-bypass defaults', () => {
    expect(def?.defaultParams).toEqual({
      preFilt: 1,
      lofiType: 1,
      tone: 0,
      cutoffHz: 8000,
      balance: 0,
      level: 100,
    })
  })

  it('is neutral only at exact defaults', () => {
    expect(def?.isNeutral({
      preFilt: 1,
      lofiType: 1,
      tone: 0,
      cutoffHz: 8000,
      balance: 0,
      level: 100,
    } as never)).toBe(true)
    expect(def?.isNeutral({
      preFilt: 1,
      lofiType: 1,
      tone: 10,
      cutoffHz: 8000,
      balance: 0,
      level: 100,
    } as never)).toBe(false)
    expect(def?.isNeutral({
      preFilt: 1,
      lofiType: 1,
      tone: 0,
      cutoffHz: 8000,
      balance: 15,
      level: 100,
    } as never)).toBe(false)
  })
})
