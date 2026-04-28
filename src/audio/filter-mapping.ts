// ABOUTME: filterParams — maps a -1..+1 filter value to BiquadFilterNode parameters.
// ABOUTME: Negative = lowpass, positive = highpass; dead zone at ±0.05; exponential curve.

export type BiquadKind = 'lowpass' | 'highpass'

export interface FilterParams {
  type: BiquadKind
  frequency: number
  Q: number
}

const Q_BUTTERWORTH = 0.707
const DEAD_ZONE = 0.05

// filterValue: -1..+1. Negative = LP, positive = HP, magnitude is intensity.
// contextRate: AudioContext.sampleRate (Live or Offline).
export function filterParams(filterValue: number, contextRate: number): FilterParams {
  const v = Math.max(-1, Math.min(1, filterValue))
  const intensity = Math.abs(v) - DEAD_ZONE

  if (intensity <= 0) {
    return { type: 'lowpass', frequency: contextRate / 2, Q: Q_BUTTERWORTH }
  }

  const e = Math.pow(intensity / (1 - DEAD_ZONE), 2)

  if (v < 0) {
    const fNeutral = contextRate / 3
    const fMax = 1000
    return {
      type: 'lowpass',
      frequency: fNeutral - e * (fNeutral - fMax),
      Q: Q_BUTTERWORTH,
    }
  }

  return {
    type: 'highpass',
    frequency: 200 + e * (3000 - 200),
    Q: Q_BUTTERWORTH,
  }
}
