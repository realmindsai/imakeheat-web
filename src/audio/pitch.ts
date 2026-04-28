// ABOUTME: pitchRateFromSemitones — converts semitone offset to playback rate multiplier.
// ABOUTME: Pure function, no AudioContext required. 2^(semi/12) formula; identity at 0 is exact.

// 2^(semi/12). Identity at semi === 0 is exact because Math.pow(2, 0) === 1.
export function pitchRateFromSemitones(semitones: number): number {
  return Math.pow(2, semitones / 12)
}
