import { describe, it, expect } from 'vitest'
import '../../../src/audio/worklets/processor-shim'
import { Vinyl404Processor } from '../../../src/audio/worklets/vinyl404.worklet'
import { runProcessor, postToProcessor } from '../../helpers/worklet'

const SR = 48000

function sine(freq: number, amp: number, durSec: number): Float32Array {
  const n = Math.round(durSec * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR)
  return out
}

function rms(buf: Float32Array): number {
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  return Math.sqrt(s / buf.length)
}

describe('Vinyl404Processor', () => {
  it('neutral params are transparent', () => {
    const proc = new Vinyl404Processor(SR)
    postToProcessor(proc, { frequency: 100, noise: 0, wowFlutter: 0 })
    const input = sine(440, 0.5, 0.2)
    const out = runProcessor(proc, [input])[0]
    let err = 0
    for (let i = 0; i < input.length; i++) err += (out[i] - input[i]) ** 2
    expect(Math.sqrt(err / input.length)).toBeLessThan(1e-4)
  })

  it('frequency=0 darkens an 8 kHz tone more than frequency=100', () => {
    const dark = new Vinyl404Processor(SR)
    const full = new Vinyl404Processor(SR)
    postToProcessor(dark, { frequency: 0, noise: 0, wowFlutter: 0 })
    postToProcessor(full, { frequency: 100, noise: 0, wowFlutter: 0 })
    expect(rms(runProcessor(dark, [sine(8000, 0.5, 0.2)])[0])).toBeLessThan(
      rms(runProcessor(full, [sine(8000, 0.5, 0.2)])[0]),
    )
  })

  it('noise=100 raises silence rms', () => {
    const proc = new Vinyl404Processor(SR)
    postToProcessor(proc, { frequency: 100, noise: 100, wowFlutter: 0 })
    expect(rms(runProcessor(proc, [new Float32Array(4096)])[0])).toBeGreaterThan(0.002)
  })

  it('stereo-identical input stays stereo-identical output', () => {
    const proc = new Vinyl404Processor(SR)
    postToProcessor(proc, { frequency: 45, noise: 30, wowFlutter: 25 })
    const sig = sine(440, 0.5, 0.25)
    const out = runProcessor(proc, [sig, sig.slice()])
    for (let i = 0; i < out[0].length; i++) expect(out[0][i]).toBeCloseTo(out[1][i], 6)
  })
})
