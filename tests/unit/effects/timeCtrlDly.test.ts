import { describe, it, expect } from 'vitest'
import '../../../src/audio/worklets/processor-shim'
import { TimeCtrlDlyProcessor } from '../../../src/audio/worklets/timeCtrlDly.worklet'
import { runProcessor, postToProcessor } from '../../helpers/worklet'

describe('TimeCtrlDlyProcessor', () => {
  it('mix=1, feedback=0: impulse produces single peak at delaySamples', () => {
    const proc = new TimeCtrlDlyProcessor(48000)
    postToProcessor(proc, { timeMs: 10, feedback: 0, mix: 1, ducking: 0 })
    const input = new Float32Array(2048)
    input[0] = 1
    const out = runProcessor(proc, [input])
    expect(out[0][480]).toBeCloseTo(1, 5)
    let nonzero = 0
    for (let i = 0; i < 2048; i++) if (Math.abs(out[0][i]) > 1e-6) nonzero++
    expect(nonzero).toBe(1)
  })

  it('mix=1, feedback=0.5: peaks at n*delaySamples decay geometrically', () => {
    const proc = new TimeCtrlDlyProcessor(48000)
    postToProcessor(proc, { timeMs: 10, feedback: 0.5, mix: 1, ducking: 0 })
    const input = new Float32Array(4096)
    input[0] = 1
    const out = runProcessor(proc, [input])
    expect(out[0][480]).toBeCloseTo(1, 4)
    expect(out[0][960]).toBeCloseTo(0.5, 4)
    expect(out[0][1440]).toBeCloseTo(0.25, 4)
  })

  it('mix=0: bypass identity', () => {
    const proc = new TimeCtrlDlyProcessor(48000)
    postToProcessor(proc, { timeMs: 250, feedback: 0.5, mix: 0, ducking: 0.7 })
    const input = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) input[i] = Math.sin(i / 7)
    const out = runProcessor(proc, [input])
    for (let i = 0; i < 1024; i++) expect(out[0][i]).toBeCloseTo(input[i], 6)
  })

  it('clamps out-of-range params safely', () => {
    const proc = new TimeCtrlDlyProcessor(48000)
    expect(() => postToProcessor(proc, { timeMs: 99999, feedback: 5, mix: 3, ducking: -5 })).not.toThrow()
    const input = new Float32Array(2048)
    input[0] = 1
    expect(() => runProcessor(proc, [input])).not.toThrow()
    const out = runProcessor(proc, [input])
    expect(out[0][960]).toBeLessThanOrEqual(0.95 + 1e-5)
  })

  it('processes stereo channels independently', () => {
    const proc = new TimeCtrlDlyProcessor(48000)
    postToProcessor(proc, { timeMs: 10, feedback: 0.5, mix: 1, ducking: 0 })
    const left = new Float32Array(2048)
    left[0] = 1
    const right = new Float32Array(2048)
    const out = runProcessor(proc, [left, right])
    expect(out.length).toBe(2)
    for (let i = 0; i < 2048; i++) expect(out[1][i]).toBeCloseTo(0, 6)
  })
})
