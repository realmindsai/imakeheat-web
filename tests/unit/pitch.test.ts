import { describe, it, expect } from 'vitest'
import { pitchRateFromSemitones } from '../../src/audio/pitch'

describe('pitchRateFromSemitones', () => {
  it('returns exactly 1.0 at zero semitones (bypass identity)', () => {
    expect(pitchRateFromSemitones(0)).toBe(1.0)
  })

  it('returns 2.0 at +12 semitones (one octave up)', () => {
    expect(pitchRateFromSemitones(12)).toBeCloseTo(2.0, 6)
  })

  it('returns 0.5 at -12 semitones (one octave down)', () => {
    expect(pitchRateFromSemitones(-12)).toBeCloseTo(0.5, 6)
  })

  it('returns ~0.84089 at -3 semitones', () => {
    expect(pitchRateFromSemitones(-3)).toBeCloseTo(0.84089641525, 6)
  })

  it('is symmetric: rate(n) * rate(-n) === 1', () => {
    for (const n of [1, 5, 7, 11]) {
      expect(pitchRateFromSemitones(n) * pitchRateFromSemitones(-n)).toBeCloseTo(1.0, 6)
    }
  })
})
