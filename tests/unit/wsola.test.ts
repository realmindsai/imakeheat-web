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

// Build a minimal Chain with just a pitch slot — mirrors what engine.play sends.
// Other slots (crusher, filter, etc.) live downstream of the player and don't
// affect WSOLA-internal behavior, so we omit them in worklet-level tests.
function chainWithPitch(speed: number, semitones: number) {
  return [
    { id: 'p', kind: 'pitch', enabled: true, params: { semitones, speed } },
  ]
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
      chain: chainWithPitch(1, 0),
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
      chain: chainWithPitch(0.5, 0),
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
      chain: chainWithPitch(2, 0),
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
      chain: chainWithPitch(1, 0),
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

describe('WSOLAProcessor — control messages', () => {
  it('pause emits silence and holds readPos', () => {
    const proc = new WSOLAProcessor()
    const input = sine(8192, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 8192 / SR },
      chain: chainWithPitch(1, 0),
    })
    drainBlocks(proc, 1, 4)
    postToProcessor(proc, { type: 'pause' })
    const silent = drainBlocks(proc, 1, 4)
    for (let i = 0; i < silent[0].length; i++) {
      expect(silent[0][i]).toBe(0)
    }
  })

  it('pitch({speed:1.5}) mid-process does not cause long zero runs', () => {
    const proc = new WSOLAProcessor()
    const input = sine(16384, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 16384 / SR },
      chain: chainWithPitch(1, 0),
    })
    const phase1 = drainBlocks(proc, 1, 32)
    postToProcessor(proc, {
      type: 'pitch',
      params: { speed: 1.5, semitones: 0 },
    })
    const phase2 = drainBlocks(proc, 1, 32)
    function maxZeroRun(buf: Float32Array): number {
      let cur = 0, max = 0
      for (let i = 0; i < buf.length; i++) {
        if (Math.abs(buf[i]) < 1e-6) cur++
        else { max = Math.max(max, cur); cur = 0 }
      }
      return Math.max(max, cur)
    }
    expect(maxZeroRun(phase1[0].subarray(BLOCK))).toBeLessThan(64)
    expect(maxZeroRun(phase2[0].subarray(BLOCK))).toBeLessThan(64)
  })

  it('seek drops SoundTouch state to avoid splice clicks', () => {
    const proc = new WSOLAProcessor()
    const input = sine(SR, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 1 },
      chain: chainWithPitch(0.7, 0),
    })
    drainBlocks(proc, 1, 16)
    postToProcessor(proc, { type: 'seek', sourceTimeSec: 0.5 })
    const after = drainBlocks(proc, 1, 16)
    expect(Math.abs(after[0][0])).toBeLessThan(0.05)
    for (let i = 1; i < 256; i++) {
      expect(Math.abs(after[0][i] - after[0][i - 1])).toBeLessThan(0.05)
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
      chain: chainWithPitch(1, 12),
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
      chain: chainWithPitch(0.5, 12),
    })
    const out = drainBlocks(proc, 1, 80)
    const measured = dominantFreqHz(out[0].subarray(2048, 6144), SR)
    expect(measured).toBeGreaterThan(420)
    expect(measured).toBeLessThan(460)
    // Length: signal extends past 6144 (input alone is 4096).
    expect(rms(out[0].subarray(4500, 6500))).toBeGreaterThan(0.1)
  })
})

function spyPortPosts(proc: any): any[] {
  const sent: any[] = []
  proc.port = {
    onmessage: proc.port.onmessage,
    postMessage: (data: any) => sent.push(data),
  }
  return sent
}

describe('WSOLAProcessor — position reporting', () => {
  it('emits position messages periodically while playing', () => {
    const proc = new WSOLAProcessor()
    const sent = spyPortPosts(proc)
    const input = sine(SR, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 1 },
      chain: chainWithPitch(1, 0),
    })
    drainBlocks(proc, 1, 32)
    const positions = sent.filter((m) => m.type === 'position')
    expect(positions.length).toBeGreaterThan(0)
    const last = positions[positions.length - 1]
    expect(last.readPosSec).toBeGreaterThan(0)
    expect(last.readPosSec).toBeLessThan(0.1)
  })

  it('does not emit position messages while paused', () => {
    const proc = new WSOLAProcessor()
    const sent = spyPortPosts(proc)
    const input = sine(SR, 440, SR)
    postToProcessor(proc, { type: 'load', channels: [input], sampleRate: SR })
    postToProcessor(proc, {
      type: 'play', offsetSec: 0,
      trim: { startSec: 0, endSec: 1 },
      chain: chainWithPitch(1, 0),
    })
    drainBlocks(proc, 1, 8)
    sent.length = 0
    postToProcessor(proc, { type: 'pause' })
    drainBlocks(proc, 1, 64)
    expect(sent.filter((m) => m.type === 'position').length).toBe(0)
  })
})
