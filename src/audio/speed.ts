// ABOUTME: sliderToSpeed / speedToSlider — log mapping from 0..1 slider to 0.5..2.0 speed.
// ABOUTME: Pure functions, mirror src/audio/pitch.ts shape. Identity at slider=0.5 is exact.

// 0..1 slider → 0.5..2.0 speed, log-mapped, identity at 0.5 → 1.0 (exact)
export function sliderToSpeed(s: number): number {
  return Math.pow(2, 2 * s - 1)
}

// 0.5..2.0 speed → 0..1 slider, inverse of sliderToSpeed
export function speedToSlider(v: number): number {
  return (Math.log2(v) + 1) / 2
}
