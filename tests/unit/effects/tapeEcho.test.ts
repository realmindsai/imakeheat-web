import { describe, it, expect } from 'vitest'
import '../../../src/audio/worklets/processor-shim'
import { TapeEchoProcessor } from '../../../src/audio/worklets/tapeEcho.worklet'
import { runProcessor, postToProcessor } from '../../helpers/worklet'

describe('TapeEchoProcessor', () => {
  it('supports delayed impulse and feedback decay', () => {
    const proc = new TapeEchoProcessor(48000)
    postToProcessor(proc, { timeMs: 10, feedback: 0.5, mix: 1, wowFlutter: 0, tone: 1 })
    const input = new Float32Array(4096)
    input[0] = 1
    const out = runProcessor(proc, [input])
    expect(out[0][480]).toBeCloseTo(1, 4)
    expect(out[0][960]).toBeCloseTo(0.5, 3)
  })

  it('wowFlutter changes delay trajectory deterministically', () => {
    const input = new Float32Array(4096)
    input[0] = 1

    const a = new TapeEchoProcessor(48000)
    postToProcessor(a, { timeMs: 20, feedback: 0.4, mix: 1, wowFlutter: 0, tone: 1 })
    const outA = runProcessor(a, [input])[0]

    const b = new TapeEchoProcessor(48000)
    postToProcessor(b, { timeMs: 20, feedback: 0.4, mix: 1, wowFlutter: 1, tone: 1 })
    const outB = runProcessor(b, [input])[0]

    let diff = 0
    for (let i = 0; i < outA.length; i++) diff += Math.abs(outA[i] - outB[i])
    expect(diff).toBeGreaterThan(1e-3)
  })

  it('mix=0 bypass identity', () => {
    const proc = new TapeEchoProcessor(48000)
    postToProcessor(proc, { timeMs: 250, feedback: 0.5, mix: 0, wowFlutter: 0.7, tone: 0.2 })
    const input = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) input[i] = Math.sin(i / 7)
    const out = runProcessor(proc, [input])
    for (let i = 0; i < 1024; i++) expect(out[0][i]).toBeCloseTo(input[i], 6)
  })

  it('clamps out-of-range params safely', () => {
    const proc = new TapeEchoProcessor(48000)
    expect(() => postToProcessor(proc, { timeMs: 99999, feedback: 9, mix: 9, wowFlutter: -5, tone: 99 })).not.toThrow()
    const input = new Float32Array(2048)
    input[0] = 1
    expect(() => runProcessor(proc, [input])).not.toThrow()
  })
})
