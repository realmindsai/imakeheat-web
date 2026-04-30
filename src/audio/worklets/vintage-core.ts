// ABOUTME: Shared vintage DSP primitives — deterministic PRNG, envelope follower, tone helpers, and fractional delay.
// ABOUTME: These small building blocks keep vintage-style worklets repeatable across live and offline render paths.

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    let t = (state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function softClip(value: number, drive = 1): number {
  const x = value * Math.max(1, drive)
  return Math.tanh(x) / Math.tanh(Math.max(1, drive))
}

export class EnvelopeFollower {
  private value = 0

  process(input: number, attack: number, release: number): number {
    const coeff = input > this.value ? attack : release
    this.value += (input - this.value) * coeff
    return this.value
  }
}

export class OnePoleLowpass {
  private state = 0

  process(input: number, alpha: number): number {
    this.state += (input - this.state) * clamp01(alpha)
    return this.state
  }
}

export class FractionalDelay {
  private readonly buffer: Float32Array
  private writeIndex = 0

  constructor(maxDelaySamples: number) {
    this.buffer = new Float32Array(Math.max(2, Math.ceil(maxDelaySamples) + 2))
  }

  process(input: number, delaySamples: number): number {
    const len = this.buffer.length
    const clampedDelay = clamp(delaySamples, 0, len - 2)
    this.buffer[this.writeIndex] = input
    let read = this.writeIndex - clampedDelay
    while (read < 0) read += len
    const i0 = Math.floor(read) % len
    const i1 = (i0 + 1) % len
    const frac = read - Math.floor(read)
    const out = this.buffer[i0] * (1 - frac) + this.buffer[i1] * frac
    this.writeIndex = (this.writeIndex + 1) % len
    return out
  }
}
