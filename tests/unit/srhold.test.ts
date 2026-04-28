import { describe, it, expect } from 'vitest'
import '../../src/audio/worklets/processor-shim'
import { SRHoldProcessor } from '../../src/audio/worklets/srhold.worklet'
import { runProcessor, postToProcessor } from '../helpers/worklet'

function sine(n: number, freq: number, sr: number): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / sr)
  return out
}

describe('SRHoldProcessor', () => {
  it('preserves length at holdFactor=4', () => {
    const proc = new SRHoldProcessor()
    postToProcessor(proc, { holdFactor: 4 })
    const input = [sine(4096, 440, 48000)]
    const out = runProcessor(proc, input)
    expect(out[0].length).toBe(4096)
  })

  it('every group of holdFactor contiguous samples is identical', () => {
    const proc = new SRHoldProcessor()
    postToProcessor(proc, { holdFactor: 4 })
    const input = [sine(4096, 440, 48000)]
    const out = runProcessor(proc, input)
    for (let i = 0; i < 4096; i += 4) {
      const v = out[0][i]
      for (let j = 1; j < 4 && i + j < 4096; j++) {
        expect(out[0][i + j]).toBe(v)
      }
    }
  })

  it('bypasses at holdFactor=1', () => {
    const proc = new SRHoldProcessor()
    postToProcessor(proc, { holdFactor: 1 })
    const input = [sine(512, 1000, 48000)]
    const out = runProcessor(proc, input)
    for (let i = 0; i < 512; i++) {
      expect(out[0][i]).toBeCloseTo(input[0][i], 6)
    }
  })

  it('hold-counter persists across 128-frame process() blocks', () => {
    const proc = new SRHoldProcessor()
    postToProcessor(proc, { holdFactor: 4 })
    const input = [new Float32Array(130).map((_, i) => i / 130)]
    const out = runProcessor(proc, input, 128)
    expect(out[0][124]).toBeCloseTo(input[0][124], 6)
    expect(out[0][125]).toBe(out[0][124])
    expect(out[0][126]).toBe(out[0][124])
    expect(out[0][127]).toBe(out[0][124])
    expect(out[0][128]).toBeCloseTo(input[0][128], 6)
    expect(out[0][129]).toBe(out[0][128])
  })
})
