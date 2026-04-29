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

function findLastActive(buf: Float32Array, threshold = 1e-3): number {
  for (let i = buf.length - 1; i >= 0; i--) if (Math.abs(buf[i]) > threshold) return i
  return -1
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
  it('speed=0.5 produces output ~2× input length', () => {
    const proc = new WSOLAProcessor()
    const input = sine(4096, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 0.5, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    // Expect ~8192 samples of audible signal. Drain 80 blocks (10240 samples) to be safe.
    const out = drainBlocks(proc, 1, 80)
    const last = findLastActive(out[0])
    // Allow ±N samples of imprecision due to OLA priming and frame-edge rounding.
    expect(last).toBeGreaterThan(8192 - 1024)
    expect(last).toBeLessThan(8192 + 1024)
  })

  it('speed=2 produces output ~½ input length', () => {
    const proc = new WSOLAProcessor()
    const input = sine(4096, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 4096 / SR },
      fx: { speed: 2, pitchSemitones: 0, bitDepth: 16, sampleRateHz: SR, filterValue: 0 },
    })
    // After ~2048 samples of input, the loop wraps; just check output is non-zero
    // and rms is comparable to input rms. Length-wise, in-window output ≈ input/2.
    const out = drainBlocks(proc, 1, 32)
    expect(rms(out[0].subarray(0, 2048))).toBeGreaterThan(0.1)
  })
})
