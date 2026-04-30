import { describe, it, expect } from 'vitest'
import '../../../src/audio/worklets/processor-shim'
import { Vinyl303Processor } from '../../../src/audio/worklets/vinyl303.worklet'
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

function crest(buf: Float32Array): number {
  let peak = 0
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]))
  return peak / Math.max(1e-9, rms(buf))
}

describe('Vinyl303Processor', () => {
  it('neutral params are transparent within 1e-4 rms error', () => {
    const proc = new Vinyl303Processor(SR)
    postToProcessor(proc, { comp: 0, noise: 0, wowFlutter: 0, level: 100 })
    const input = sine(440, 0.5, 0.25)
    const out = runProcessor(proc, [input])[0]
    let err = 0
    for (let i = 0; i < input.length; i++) err += (out[i] - input[i]) ** 2
    expect(Math.sqrt(err / input.length)).toBeLessThan(1e-4)
  })

  it('noise=100 raises silence rms', () => {
    const proc = new Vinyl303Processor(SR)
    postToProcessor(proc, { comp: 0, noise: 100, wowFlutter: 0, level: 100 })
    const out = runProcessor(proc, [new Float32Array(4096)])[0]
    expect(rms(out)).toBeGreaterThan(0.003)
  })

  it('level=0 silences the output', () => {
    const proc = new Vinyl303Processor(SR)
    postToProcessor(proc, { comp: 0, noise: 0, wowFlutter: 0, level: 0 })
    const out = runProcessor(proc, [sine(440, 0.5, 0.1)])[0]
    expect(rms(out)).toBeLessThan(1e-6)
  })

  it('comp=100 lowers crest factor on a pulsed tone', () => {
    const dry = new Vinyl303Processor(SR)
    const wet = new Vinyl303Processor(SR)
    const input = sine(220, 0.9, 0.4)
    for (let i = 0; i < input.length; i += 300) input[i] = 1
    postToProcessor(dry, { comp: 0, noise: 0, wowFlutter: 0, level: 100 })
    postToProcessor(wet, { comp: 100, noise: 0, wowFlutter: 0, level: 100 })
    expect(crest(runProcessor(wet, [input])[0])).toBeLessThan(crest(runProcessor(dry, [input])[0]))
  })

  it('wowFlutter=100 moves the output away from the dry waveform', () => {
    const proc = new Vinyl303Processor(SR)
    postToProcessor(proc, { comp: 0, noise: 0, wowFlutter: 100, level: 100 })
    const input = sine(440, 0.5, 0.3)
    const out = runProcessor(proc, [input])[0]
    let diff = 0
    for (let i = 0; i < input.length; i++) diff += Math.abs(out[i] - input[i])
    expect(diff / input.length).toBeGreaterThan(1e-3)
  })

  it('stereo-identical input stays stereo-identical output', () => {
    const proc = new Vinyl303Processor(SR)
    postToProcessor(proc, { comp: 40, noise: 30, wowFlutter: 25, level: 100 })
    const sig = sine(440, 0.5, 0.25)
    const out = runProcessor(proc, [sig, sig.slice()])
    for (let i = 0; i < out[0].length; i++) expect(out[0][i]).toBeCloseTo(out[1][i], 6)
  })
})
