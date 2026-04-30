import { describe, it, expect } from 'vitest'
import '../../../src/audio/worklets/processor-shim'
import { ReverbProcessor } from '../../../src/audio/worklets/reverb.worklet'
import { runProcessor, postToProcessor } from '../../helpers/worklet'

const SR = 48000
const ms = (n: number) => Math.round(n * SR / 1000)

function rms(arr: Float32Array, start: number, end: number): number {
  let s = 0; let n = 0
  for (let i = start; i < Math.min(end, arr.length); i++) { s += arr[i] * arr[i]; n++ }
  return n === 0 ? 0 : Math.sqrt(s / n)
}

function impulse(len: number): Float32Array { const a = new Float32Array(len); a[0] = 1; return a }

describe('ReverbProcessor', () => {
  it('mix=0: bypass identity', () => {
    const proc = new ReverbProcessor(SR)
    postToProcessor(proc, { size: 0.5, decay: 0.7, mix: 0 })
    const inp = new Float32Array(2048); for (let i = 0; i < 2048; i++) inp[i] = Math.sin(i / 7)
    const out = runProcessor(proc, [inp])
    for (let i = 0; i < 2048; i++) expect(out[0][i]).toBeCloseTo(inp[i], 5)
  })

  it('mix=1, decay=0.7: tail RMS over [50ms, 500ms] > 1e-3', () => {
    const proc = new ReverbProcessor(SR)
    postToProcessor(proc, { size: 0.5, decay: 0.7, mix: 1 })
    const out = runProcessor(proc, [impulse(SR)])
    expect(rms(out[0], ms(50), ms(500))).toBeGreaterThan(1e-3)
  })

  it('decay=1.0 late-tail RMS > decay=0.0 late-tail RMS', () => {
    const a = new ReverbProcessor(SR); postToProcessor(a, { size: 0.5, decay: 1.0, mix: 1 })
    const b = new ReverbProcessor(SR); postToProcessor(b, { size: 0.5, decay: 0.0, mix: 1 })
    const outA = runProcessor(a, [impulse(SR * 2)])
    const outB = runProcessor(b, [impulse(SR * 2)])
    expect(rms(outA[0], ms(1500), ms(2000))).toBeGreaterThan(rms(outB[0], ms(1500), ms(2000)))
  })

  it('late RMS (1.5–2.0s) < early RMS (0.1–0.5s) for any decay', () => {
    for (const decay of [0, 0.5, 1]) {
      const proc = new ReverbProcessor(SR)
      postToProcessor(proc, { size: 0.5, decay, mix: 1 })
      const out = runProcessor(proc, [impulse(SR * 2)])
      expect(rms(out[0], ms(1500), ms(2000))).toBeLessThan(rms(out[0], ms(100), ms(500)))
    }
  })

  it('out-of-range params do not throw', () => {
    const proc = new ReverbProcessor(SR)
    expect(() => postToProcessor(proc, { size: -5, decay: 99, mix: -1 })).not.toThrow()
    expect(() => runProcessor(proc, [impulse(1024)])).not.toThrow()
  })

  it('processes stereo channels independently with symmetric tunings (L=R for L=R input)', () => {
    const proc = new ReverbProcessor(SR)
    postToProcessor(proc, { size: 0.5, decay: 0.7, mix: 1 })
    const sig = impulse(SR)
    const out = runProcessor(proc, [sig, sig.slice()])
    for (let i = 0; i < out[0].length; i++) expect(out[0][i]).toBeCloseTo(out[1][i], 6)
  })
})
