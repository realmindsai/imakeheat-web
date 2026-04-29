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

  it('at bits=8, a +6 dBFS sine clips hard (peaks pinned to lattice edges, −1 and +127/128), not softly', () => {
    const proc = new BitCrusherProcessor()
    postToProcessor(proc, { bits: 8 })
    const n = 4096
    const sr = 48000
    const f = 1000
    // ~+6 dBFS: amplitude = 2.0 (overshoots ±1)
    const sig = new Float32Array(n)
    for (let i = 0; i < n; i++) sig[i] = 2 * Math.sin((2 * Math.PI * f * i) / sr)
    const out = runProcessor(proc, [sig])
    // Hard clip → output saturates at the lattice rails: -128/128 = -1 negative, 127/128 positive.
    // Lattice step = 2 / 256 = 1/128. Highest positive code = 127/128 ≈ 0.9921875.
    const maxOut = Math.max(...Array.from(out[0]))
    const minOut = Math.min(...Array.from(out[0]))
    expect(maxOut).toBeCloseTo(127 / 128, 4)
    expect(minOut).toBeCloseTo(-1, 4)
  })

  it('at bits=12, a small-signal sine is pushed louder by the SP-vibe drive', () => {
    // A small signal (-6 dBFS sine) sits well inside the soft-clip linear range.
    // With +2 dB drive applied PRE-quantize, the RMS of the output should be
    // measurably above the input RMS — proving the saturator runs on 12-bit
    // and not on other bit depths.
    const n = 8192
    const sr = 48000
    const f = 1000
    const amp = 0.5 // -6 dBFS
    const sig = new Float32Array(n)
    for (let i = 0; i < n; i++) sig[i] = amp * Math.sin((2 * Math.PI * f * i) / sr)
    const inRms = Math.sqrt(sig.reduce((s, v) => s + v * v, 0) / n)

    const proc12 = new BitCrusherProcessor()
    postToProcessor(proc12, { bits: 12 })
    const out12 = runProcessor(proc12, [sig])
    const out12Rms = Math.sqrt(out12[0].reduce((s, v) => s + v * v, 0) / n)

    // +2 dB linear gain ≈ ×1.259, but tanh compresses even moderate signals,
    // so the realized RMS gain is below the linear ceiling. Empirically ≈ ×1.149.
    // Lower bound proves the saturator is engaged; upper bound proves it's tanh
    // (not just linear gain) and that quantization didn't blow up.
    expect(out12Rms / inRms).toBeGreaterThan(1.10)
    expect(out12Rms / inRms).toBeLessThan(1.20)
  })

  it('at bits=8, the same small-signal sine is NOT pushed louder (saturator stays off)', () => {
    const n = 8192
    const sr = 48000
    const f = 1000
    const amp = 0.5
    const sig = new Float32Array(n)
    for (let i = 0; i < n; i++) sig[i] = amp * Math.sin((2 * Math.PI * f * i) / sr)
    const inRms = Math.sqrt(sig.reduce((s, v) => s + v * v, 0) / n)

    const proc8 = new BitCrusherProcessor()
    postToProcessor(proc8, { bits: 8 })
    const out8 = runProcessor(proc8, [sig])
    const out8Rms = Math.sqrt(out8[0].reduce((s, v) => s + v * v, 0) / n)

    // No saturator → ratio should be ~1 within quantization noise.
    expect(Math.abs(out8Rms / inRms - 1)).toBeLessThan(0.02)
  })

  it('at bits=12, hot input is soft-clipped (peaks below 1.0 with no rail-pinning)', () => {
    // A +6 dBFS sine into tanh(1.26 * x) saturates well below ±1.
    // Hard clip would pin to the 12-bit lattice edges (±~0.9995). Soft clip
    // peaks should sit clearly inside that.
    const n = 4096
    const sr = 48000
    const f = 1000
    const sig = new Float32Array(n)
    for (let i = 0; i < n; i++) sig[i] = 2 * Math.sin((2 * Math.PI * f * i) / sr)

    const proc = new BitCrusherProcessor()
    postToProcessor(proc, { bits: 12 })
    const out = runProcessor(proc, [sig])
    const peak = Math.max(...Array.from(out[0]).map((v) => Math.abs(v)))
    // tanh(1.26 * 2) = tanh(2.52) ≈ 0.987 — soft-clipped well inside the 12-bit rails.
    expect(peak).toBeLessThan(0.99)
    expect(peak).toBeGreaterThan(0.95)
  })
})
