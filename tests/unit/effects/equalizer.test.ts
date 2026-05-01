import { describe, it, expect, vi } from 'vitest'
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

describe('Equalizer definition', () => {
  it('defaults to flat gains at the stock crossover frequencies', () => {
    const def = registry.get('equalizer')
    expect(def?.defaultParams).toEqual({
      lowGain: 0,
      midGain: 0,
      highGain: 0,
      lowFreq: 80,
      midFreq: 1000,
      highFreq: 8000,
    })
  })

  it('isNeutral only depends on the three gains being exactly zero', () => {
    const def = registry.get('equalizer')
    expect(
      def?.isNeutral({
        lowGain: 0,
        midGain: 0,
        highGain: 0,
        lowFreq: 20,
        midFreq: 4000,
        highFreq: 12000,
      }),
    ).toBe(true)
    expect(
      def?.isNeutral({
        lowGain: -1,
        midGain: 0,
        highGain: 0,
        lowFreq: 80,
        midFreq: 1000,
        highFreq: 8000,
      }),
    ).toBe(false)
    expect(
      def?.isNeutral({
        lowGain: 0,
        midGain: 2,
        highGain: 0,
        lowFreq: 80,
        midFreq: 1000,
        highFreq: 8000,
      }),
    ).toBe(false)
    expect(
      def?.isNeutral({
        lowGain: 0,
        midGain: 0,
        highGain: -3,
        lowFreq: 80,
        midFreq: 1000,
        highFreq: 8000,
      }),
    ).toBe(false)
  })

  it('builds the three-band EQ with immediate gain/frequency init and smooth apply updates', () => {
    const def = registry.get('equalizer')
    const { ctx, filters } = makeFakeContext(7.5)
    const node = def!.build(ctx, {
      lowGain: -6,
      midGain: 3,
      highGain: 9,
      lowFreq: 70,
      midFreq: 1500,
      highFreq: 9000,
    })

    expect(node.input).toBe(filters[0])
    expect(node.output).toBe(filters[2])
    expect(filters.map((filter) => filter.type)).toEqual(['lowshelf', 'peaking', 'highshelf'])
    expect(filters.map((filter) => filter.frequency.value)).toEqual([70, 1500, 9000])
    expect(filters.map((filter) => filter.gain.value)).toEqual([-6, 3, 9])
    expect(filters[0].gain.setTargetAtTime).not.toHaveBeenCalled()
    expect(filters[1].gain.setTargetAtTime).not.toHaveBeenCalled()
    expect(filters[2].gain.setTargetAtTime).not.toHaveBeenCalled()
    expect(filters[0].frequency.setTargetAtTime).not.toHaveBeenCalled()
    expect(filters[1].frequency.setTargetAtTime).not.toHaveBeenCalled()
    expect(filters[2].frequency.setTargetAtTime).not.toHaveBeenCalled()

    node.apply({
      lowGain: -4,
      midGain: 1,
      highGain: 6,
      lowFreq: 90,
      midFreq: 1200,
      highFreq: 10000,
    })

    expect(filters[0].gain.setTargetAtTime).toHaveBeenCalledWith(-4, 7.5, 0.01)
    expect(filters[1].gain.setTargetAtTime).toHaveBeenCalledWith(1, 7.5, 0.01)
    expect(filters[2].gain.setTargetAtTime).toHaveBeenCalledWith(6, 7.5, 0.01)
    expect(filters[0].frequency.setTargetAtTime).toHaveBeenCalledWith(90, 7.5, 0.01)
    expect(filters[1].frequency.setTargetAtTime).toHaveBeenCalledWith(1200, 7.5, 0.01)
    expect(filters[2].frequency.setTargetAtTime).toHaveBeenCalledWith(10000, 7.5, 0.01)
  })
})
