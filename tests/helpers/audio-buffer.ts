// ABOUTME: Minimal AudioBuffer-shaped fixture for unit tests without a real Web Audio context.
// ABOUTME: Implements only the subset wav.ts uses: numberOfChannels, sampleRate, length, getChannelData.

// Minimal AudioBuffer-shaped object for tests where a real Web Audio
// context is not available. Implements only the subset wav.ts uses.
export interface AudioBufferLike {
  numberOfChannels: number
  sampleRate: number
  length: number
  getChannelData(channel: number): Float32Array
}

export function makeBuffer(
  channels: number,
  sampleRate: number,
  length: number,
  fill: (ch: number, i: number) => number = () => 0,
): AudioBufferLike {
  const data = Array.from({ length: channels }, (_, ch) => {
    const arr = new Float32Array(length)
    for (let i = 0; i < length; i++) arr[i] = fill(ch, i)
    return arr
  })
  return {
    numberOfChannels: channels,
    sampleRate,
    length,
    getChannelData: (ch: number) => data[ch],
  }
}

export function makeSine(
  channels: number,
  sampleRate: number,
  durationSec: number,
  freqHz: number,
  amplitude = 0.5,
): AudioBufferLike {
  const length = Math.round(sampleRate * durationSec)
  return makeBuffer(channels, sampleRate, length, (_ch, i) =>
    amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate),
  )
}
