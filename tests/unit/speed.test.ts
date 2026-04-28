import { describe, it, expect } from 'vitest'
import { sliderToSpeed, speedToSlider } from '../../src/audio/speed'

describe('speed mapping', () => {
  it('identity at slider=0.5 → speed=1.0 exactly', () => {
    expect(sliderToSpeed(0.5)).toBe(1.0)
    expect(speedToSlider(1.0)).toBe(0.5)
  })

  it('endpoints: slider 0 ↔ 0.5x, slider 1 ↔ 2x', () => {
    expect(sliderToSpeed(0)).toBeCloseTo(0.5, 6)
    expect(sliderToSpeed(1)).toBeCloseTo(2.0, 6)
    expect(speedToSlider(0.5)).toBeCloseTo(0, 6)
    expect(speedToSlider(2.0)).toBeCloseTo(1, 6)
  })

  it('round-trips for 11 sample points', () => {
    for (let i = 0; i <= 10; i++) {
      const s = i / 10
      expect(speedToSlider(sliderToSpeed(s))).toBeCloseTo(s, 6)
    }
  })
})
