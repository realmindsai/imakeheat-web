import { describe, it, expect } from 'vitest'
import '../../src/audio/worklets/processor-shim'
import { BitCrusherProcessor } from '../../src/audio/worklets/bitcrusher.worklet'
import { runProcessor, postToProcessor } from '../helpers/worklet'

function linspace(n: number, a: number, b: number): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = a + ((b - a) * i) / (n - 1)
  return out
}

describe('BitCrusherProcessor', () => {
  it('quantises to 16 unique levels at bits=4', () => {
    const proc = new BitCrusherProcessor()
    postToProcessor(proc, { bits: 4 })
    const input = [linspace(1024, -1, 1)]
    const out = runProcessor(proc, input)

    const unique = new Set(Array.from(out[0]).map((v) => v.toFixed(6)))
    expect(unique.size).toBeGreaterThanOrEqual(16)
    expect(unique.size).toBeLessThanOrEqual(17)
  })

  it('all output values lie on the 2/(2^bits) lattice', () => {
    const proc = new BitCrusherProcessor()
    postToProcessor(proc, { bits: 4 })
    const out = runProcessor(proc, [linspace(1024, -1, 1)])
    const step = 2 / (1 << 4) // 2/16 = 0.125
    for (const v of out[0]) {
      const ratio = v / step
      expect(Math.abs(ratio - Math.round(ratio))).toBeLessThan(1e-5)
    }
  })

  it('passes audio through unchanged at bits=16 (bypass identity)', () => {
    const proc = new BitCrusherProcessor()
    postToProcessor(proc, { bits: 16 })
    const input = [linspace(512, -0.7, 0.7)]
    const out = runProcessor(proc, input)
    for (let i = 0; i < input[0].length; i++) {
      expect(out[0][i]).toBeCloseTo(input[0][i], 6)
    }
  })

  it('processes stereo channels independently', () => {
    const proc = new BitCrusherProcessor()
    postToProcessor(proc, { bits: 4 })
    const left = linspace(256, -1, 1)
    const right = linspace(256, 1, -1)
    const out = runProcessor(proc, [left, right])
    expect(out.length).toBe(2)
    let differ = 0
    for (let i = 0; i < 256; i++) if (out[0][i] !== out[1][i]) differ++
    expect(differ).toBeGreaterThan(100)
  })
})
