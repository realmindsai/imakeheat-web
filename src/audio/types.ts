// ABOUTME: Shared types for AudioEngine, graph, recorder, and WAV codec.
// ABOUTME: Single source of truth for TrimPoints and AudioBufferLike.

export interface TrimPoints {
  startSec: number
  endSec: number
}

export interface AudioBufferLike {
  numberOfChannels: number
  sampleRate: number
  length: number
  getChannelData(channel: number): Float32Array
}
