// ABOUTME: Compute peak-amplitude bins from an AudioBuffer for waveform display.
// ABOUTME: Returns Float32Array of length `bars`, each value in [0, 1] (peak abs sample).

import type { AudioBufferLike } from './types'

export function peaksFromBuffer(
  buffer: AudioBufferLike,
  bars: number,
  channel = 0,
): Float32Array {
  const out = new Float32Array(bars)
  if (bars <= 0 || buffer.length <= 0) return out

  const ch = Math.min(channel, buffer.numberOfChannels - 1)
  const data = buffer.getChannelData(Math.max(0, ch))
  const samplesPerBin = buffer.length / bars

  for (let b = 0; b < bars; b++) {
    const start = Math.floor(b * samplesPerBin)
    const end = Math.min(buffer.length, Math.floor((b + 1) * samplesPerBin))
    let peak = 0
    for (let i = start; i < end; i++) {
      const a = Math.abs(data[i])
      if (a > peak) peak = a
    }
    out[b] = Math.min(1, peak)
  }
  return out
}
