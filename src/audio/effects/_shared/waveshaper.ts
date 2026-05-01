// ABOUTME: Shared waveshaper helpers for drive-style effects in the pedalboard.
// ABOUTME: Provides a stable soft-clip curve and output trim mapping from a 0..1 drive amount.

export function makeSoftClipCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2048) as Float32Array<ArrayBuffer>
  const k = Math.max(0, amount)
  const scale = 1 + k * 3
  const norm = Math.tanh(scale)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(scale * x) / norm
  }
  return curve
}

export function outputTrimFromDrive(amount: number): number {
  return 1 / (1 + amount * 0.35)
}
