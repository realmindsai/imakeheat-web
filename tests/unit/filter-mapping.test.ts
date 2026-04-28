import { describe, it, expect } from 'vitest'
import { filterParams } from '../../src/audio/filter-mapping'

const SR = 48000

describe('filterParams', () => {
  it('bypasses at 0 (frequency at Nyquist)', () => {
    const p = filterParams(0, SR)
    expect(p.type).toBe('lowpass')
    expect(p.frequency).toBe(SR / 2)
    expect(p.Q).toBeCloseTo(0.707, 3)
  })

  it('bypasses inside the dead zone of ±0.05', () => {
    expect(filterParams(0.04, SR).frequency).toBe(SR / 2)
    expect(filterParams(-0.04, SR).frequency).toBe(SR / 2)
  })

  it('engages lowpass at -1 with frequency near 1 kHz', () => {
    const p = filterParams(-1, SR)
    expect(p.type).toBe('lowpass')
    expect(p.frequency).toBeCloseTo(1000, 0)
  })

  it('engages highpass at +1 with frequency near 3 kHz', () => {
    const p = filterParams(1, SR)
    expect(p.type).toBe('highpass')
    expect(p.frequency).toBeCloseTo(3000, 0)
  })

  it('uses an exponential curve, not linear', () => {
    const sr = SR
    const fHalf = filterParams(-0.5, sr).frequency
    const fNeutral = sr / 3
    const fMax = 1000
    const linearMid = (fNeutral + fMax) / 2
    expect(fHalf).toBeGreaterThan(linearMid)
  })

  it('always reports Q = 0.707 (Butterworth)', () => {
    for (const v of [-1, -0.5, -0.1, 0.1, 0.5, 1]) {
      expect(filterParams(v, SR).Q).toBeCloseTo(0.707, 3)
    }
  })
})
