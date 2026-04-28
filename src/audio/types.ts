// ABOUTME: Shared types for AudioEngine, graph, recorder, and WAV codec.
// ABOUTME: Single source of truth for EffectParams, TrimPoints, and AudioBufferLike.

export interface EffectParams {
  bitDepth: 2 | 4 | 8 | 12 | 16
  sampleRateHz: number      // perceptual; 4000–48000
  pitchSemitones: number    // -12..+12
  filterValue: number       // -1..+1 (sign picks LP/HP, magnitude is intensity)
}

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
