import { describe, it, expect } from 'vitest'
import '../../src/audio/worklets/processor-shim'
import { WSOLAProcessor } from '../../src/audio/worklets/wsola.worklet'
import { postToProcessor } from '../helpers/worklet'

const SR = 48000
const BLOCK = 128
const PRIMING_BLOCKS = 1 // documented in spec §5.7 risk #3 / §7.1

function ramp(n: number): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = i / n
  return out
}

// Drive the processor with no audio inputs (it owns its buffer);
// collect `blocks` blocks of 128 samples per channel.
function drainBlocks(proc: WSOLAProcessor, channels: number, blocks: number): Float32Array[] {
  const out: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(blocks * BLOCK))
  for (let b = 0; b < blocks; b++) {
    const outBlock = Array.from({ length: channels }, () => new Float32Array(BLOCK))
    proc.process([[]], [outBlock], {})
    for (let c = 0; c < channels; c++) out[c].set(outBlock[c], b * BLOCK)
  }
  return out
}

function sine(n: number, freq: number, sr: number): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / sr)
  return out
}

function rms(buf: Float32Array): number {
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  return Math.sqrt(s / buf.length)
}


describe('WSOLAProcessor', () => {
  it('neutral fast-path is sample-identical to input (mod priming)', () => {
    const proc = new WSOLAProcessor()
    const input = ramp(4096)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play',
      offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 1, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const out = drainBlocks(proc, 1, 32) // 32 * 128 = 4096
    const skip = PRIMING_BLOCKS * BLOCK
    for (let i = skip; i < 4096; i++) {
      expect(out[0][i]).toBeCloseTo(input[i], 6)
    }
  })
})

describe('WSOLAProcessor — stretch', () => {
  it('speed=0.5 produces sustained output past the natural input length', () => {
    const proc = new WSOLAProcessor()
    const input = sine(4096, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 0.5, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const out = drainBlocks(proc, 1, 64) // 8192 samples
    // Skip priming; assert RMS is sustained throughout.
    // At speed=0.5, output rate is half input rate, so 4096 input samples
    // produce 8192 output samples; under loop-wrap the signal continues
    // beyond 8192 indefinitely. RMS in both halves should be ~0.5/sqrt(2).
    expect(rms(out[0].subarray(1024, 4096))).toBeGreaterThan(0.2)
    expect(rms(out[0].subarray(4096, 8192))).toBeGreaterThan(0.2)
  })

  it('speed=2 produces output that loops within the trim window', () => {
    const proc = new WSOLAProcessor()
    const input = sine(4096, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 2, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    // At speed=2, 4096 input samples produce 2048 output before the loop wraps.
    // Drain enough that we observe at least one wrap; assert RMS is sustained.
    const out = drainBlocks(proc, 1, 32) // 4096 samples
    expect(rms(out[0].subarray(0, 2048))).toBeGreaterThan(0.1)
    expect(rms(out[0].subarray(2048, 4096))).toBeGreaterThan(0.1) // post-wrap
  })
})

function dominantFreqHz(buf: Float32Array, sr: number): number {
  let crossings = 0
  for (let i = 1; i < buf.length; i++) {
    if (buf[i - 1] <= 0 && buf[i] > 0) crossings++
  }
  return (crossings * sr) / buf.length
}

describe('WSOLAProcessor — loop wrap', () => {
  it('loops within trim window indefinitely at neutral', () => {
    const proc = new WSOLAProcessor()
    const input = ramp(SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0.4,
      trim: { startSec: 0.4, endSec: 0.6 },
      fx: { speed: 1, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const out = drainBlocks(proc, 1, Math.ceil((9600 * 4) / BLOCK))
    const span = 9600
    for (let rep = 1; rep < 4; rep++) {
      for (let frac = 0.1; frac < 1.0; frac += 0.2) {
        const offset = Math.floor(frac * span)
        const o = rep * span + offset
        const expected = input[19200 + offset]
        expect(out[0][o]).toBeCloseTo(expected, 2)
      }
    }
  })
})

describe('WSOLAProcessor — pitch shift', () => {
  it('speed=1, pitch=+12 on 220 Hz sine produces ~440 Hz', () => {
    const proc = new WSOLAProcessor()
    const input = sine(8192, 220, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 8192 / SR },
      fx: { speed: 1, pitchSemitones: 12, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const out = drainBlocks(proc, 1, 64)
    const measured = dominantFreqHz(out[0].subarray(2048, 6144), SR)
    expect(measured).toBeGreaterThan(420)
    expect(measured).toBeLessThan(460)
  })

  it('speed=0.5, pitch=+12 — output is 2× as long AND ~440 Hz (decoupling)', () => {
    const proc = new WSOLAProcessor()
    const input = sine(4096, 220, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 0.5, pitchSemitones: 12, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    const out = drainBlocks(proc, 1, 80)
    const measured = dominantFreqHz(out[0].subarray(2048, 6144), SR)
    expect(measured).toBeGreaterThan(420)
    expect(measured).toBeLessThan(460)
    // Length: signal extends past 6144 (input alone is 4096).
    expect(rms(out[0].subarray(4500, 6500))).toBeGreaterThan(0.1)
  })
})
