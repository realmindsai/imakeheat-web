import { describe, it, expect } from 'vitest'
import '../../../src/audio/worklets/processor-shim'
import { CassetteProcessor } from '../../../src/audio/worklets/cassette.worklet'
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

function minWindowRms(buf: Float32Array, size = 256): number {
  let min = Number.POSITIVE_INFINITY
  for (let start = 0; start + size <= buf.length; start += size) {
    let s = 0
    for (let i = start; i < start + size; i++) s += buf[i] * buf[i]
    min = Math.min(min, Math.sqrt(s / size))
  }
  return min
}

describe('CassetteProcessor', () => {
  it('neutral params are transparent within 1e-4 rms error', () => {
    const proc = new CassetteProcessor(SR)
    postToProcessor(proc, { tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 })
    const input = sine(440, 0.5, 0.25)
    const out = runProcessor(proc, [input])[0]
    let err = 0
    for (let i = 0; i < input.length; i++) err += (out[i] - input[i]) ** 2
    expect(Math.sqrt(err / input.length)).toBeLessThan(1e-4)
  })

  it('hiss=100 raises silence rms', () => {
    const proc = new CassetteProcessor(SR)
    postToProcessor(proc, { tone: 50, hiss: 100, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 })
    expect(rms(runProcessor(proc, [new Float32Array(4096)])[0])).toBeGreaterThan(0.0015)
  })

  it('tone=0 darkens an 8 kHz tone more than tone=100', () => {
    const dark = new CassetteProcessor(SR)
    const bright = new CassetteProcessor(SR)
    postToProcessor(dark, { tone: 0, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 })
    postToProcessor(bright, { tone: 100, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 })
    expect(rms(runProcessor(dark, [sine(8000, 0.5, 0.2)])[0])).toBeLessThan(
      rms(runProcessor(bright, [sine(8000, 0.5, 0.2)])[0]),
    )
  })

  it('drive=100 lowers crest factor on a pulsed tone', () => {
    const dry = new CassetteProcessor(SR)
    const wet = new CassetteProcessor(SR)
    const input = sine(220, 0.9, 0.4)
    for (let i = 0; i < input.length; i += 300) input[i] = 1
    postToProcessor(dry, { tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 })
    postToProcessor(wet, { tone: 50, hiss: 0, ageYears: 0, drive: 100, wowFlutter: 0, catch: 0 })
    expect(crest(runProcessor(wet, [input])[0])).toBeLessThan(crest(runProcessor(dry, [input])[0]))
  })

  it('ageYears=60 darkens an 8 kHz tone more than ageYears=0', () => {
    const fresh = new CassetteProcessor(SR)
    const dead = new CassetteProcessor(SR)
    postToProcessor(fresh, { tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 })
    postToProcessor(dead, { tone: 50, hiss: 0, ageYears: 60, drive: 0, wowFlutter: 0, catch: 0 })
    expect(rms(runProcessor(dead, [sine(8000, 0.5, 0.2)])[0])).toBeLessThan(
      rms(runProcessor(fresh, [sine(8000, 0.5, 0.2)])[0]),
    )
  })

  it('catch=100 introduces short level dents on a held tone', () => {
    const dry = new CassetteProcessor(SR)
    const wet = new CassetteProcessor(SR)
    const input = sine(440, 0.45, 0.8)
    postToProcessor(dry, { tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 })
    postToProcessor(wet, { tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 100 })
    expect(minWindowRms(runProcessor(wet, [input])[0])).toBeLessThan(minWindowRms(runProcessor(dry, [input])[0]) * 0.85)
  })

  it('wowFlutter=100 moves the output away from the dry waveform', () => {
    const proc = new CassetteProcessor(SR)
    postToProcessor(proc, { tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 100, catch: 0 })
    const input = sine(440, 0.5, 0.3)
    const out = runProcessor(proc, [input])[0]
    let diff = 0
    for (let i = 0; i < input.length; i++) diff += Math.abs(out[i] - input[i])
    expect(diff / input.length).toBeGreaterThan(1e-3)
  })

  it('deterministic params and seed produce identical output across processors', () => {
    const a = new CassetteProcessor(SR)
    const b = new CassetteProcessor(SR)
    const input = sine(440, 0.45, 0.4)
    const params = { tone: 35, hiss: 40, ageYears: 28, drive: 55, wowFlutter: 45, catch: 30 }
    postToProcessor(a, params)
    postToProcessor(b, params)
    const outA = runProcessor(a, [input])[0]
    const outB = runProcessor(b, [input])[0]
    expect(Array.from(outA)).toEqual(Array.from(outB))
  })

  it('stereo-identical input stays stereo-identical output', () => {
    const proc = new CassetteProcessor(SR)
    postToProcessor(proc, { tone: 35, hiss: 40, ageYears: 28, drive: 55, wowFlutter: 45, catch: 30 })
    const sig = sine(440, 0.5, 0.25)
    const out = runProcessor(proc, [sig, sig.slice()])
    for (let i = 0; i < out[0].length; i++) expect(out[0][i]).toBeCloseTo(out[1][i], 6)
  })
})
