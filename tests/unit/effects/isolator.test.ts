import { describe, it, expect, vi } from 'vitest'
import { createThreeBandEq } from '../../../src/audio/effects/_shared/eq'
import { registry } from '../../../src/audio/effects/registry'

function makeFakeParam(initialValue = 0) {
  return {
    value: initialValue,
    setTargetAtTime: vi.fn(),
  }
}

function makeFakeFilter() {
  return {
    type: 'lowpass' as BiquadFilterType,
    frequency: makeFakeParam(),
    Q: makeFakeParam(),
    gain: makeFakeParam(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function makeFakeContext(currentTime = 0) {
  const filters = [makeFakeFilter(), makeFakeFilter(), makeFakeFilter()]
  let index = 0
  return {
    ctx: {
      currentTime,
      createBiquadFilter: vi.fn(() => filters[index++]),
    } as unknown as BaseAudioContext,
    filters,
  }
}

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

  it('builds a lowshelf -> peaking -> highshelf chain with the fixed isolator frequencies', () => {
    const { ctx, filters } = makeFakeContext()
    const nodes = createThreeBandEq(ctx, { low: 120, mid: 1000, high: 6000 })

    expect(nodes.input).toBe(filters[0])
    expect(nodes.output).toBe(filters[2])
    expect(filters.map((filter) => filter.type)).toEqual(['lowshelf', 'peaking', 'highshelf'])
    expect(filters.map((filter) => filter.frequency.value)).toEqual([120, 1000, 6000])
    expect(filters[1].Q.value).toBeCloseTo(0.707, 3)
    expect(filters[0].connect).toHaveBeenCalledWith(filters[1])
    expect(filters[1].connect).toHaveBeenCalledWith(filters[2])
  })

  it('assigns initial gains immediately during build and smooths later apply updates', () => {
    const def = registry.get('isolator')
    const { ctx, filters } = makeFakeContext(4.25)
    const node = def!.build(ctx, { low: -18, mid: 4, high: 9 })

    expect(node.input).toBe(filters[0])
    expect(node.output).toBe(filters[2])
    expect(filters.map((filter) => filter.gain.value)).toEqual([-18, 4, 9])
    expect(filters[0].gain.setTargetAtTime).not.toHaveBeenCalled()
    expect(filters[1].gain.setTargetAtTime).not.toHaveBeenCalled()
    expect(filters[2].gain.setTargetAtTime).not.toHaveBeenCalled()

    node.apply({ low: -24, mid: 1, high: 6 })

    expect(filters[0].gain.setTargetAtTime).toHaveBeenCalledWith(-24, 4.25, 0.01)
    expect(filters[1].gain.setTargetAtTime).toHaveBeenCalledWith(1, 4.25, 0.01)
    expect(filters[2].gain.setTargetAtTime).toHaveBeenCalledWith(6, 4.25, 0.01)
  })
})
