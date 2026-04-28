// ABOUTME: Minimal 16-bit PCM WAV encoder and header reader.
// ABOUTME: No AudioContext required; sample rate written is always the buffer's actual rate (no doubling lies).

import type { AudioBufferLike } from './types'

export type { AudioBufferLike }

export interface WavHeader {
  riffMagic: string         // "RIFF"
  waveMagic: string         // "WAVE"
  audioFormat: number       // 1 for PCM
  numChannels: number
  sampleRate: number
  byteRate: number          // sampleRate * channels * bitsPerSample / 8
  blockAlign: number        // channels * bitsPerSample / 8
  bitsPerSample: number
  dataChunkSize: number
}

export async function wavEncode(buffer: AudioBufferLike): Promise<Blob> {
  const channels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const frames = buffer.length
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = channels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = frames * blockAlign
  const totalSize = 44 + dataSize

  const out = new ArrayBuffer(totalSize)
  const view = new DataView(out)

  let p = 0
  const writeAscii = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i))
  }

  // RIFF header
  writeAscii('RIFF')
  view.setUint32(p, totalSize - 8, true); p += 4
  writeAscii('WAVE')
  // fmt chunk
  writeAscii('fmt ')
  view.setUint32(p, 16, true); p += 4
  view.setUint16(p, 1, true); p += 2          // audioFormat = PCM
  view.setUint16(p, channels, true); p += 2
  view.setUint32(p, sampleRate, true); p += 4
  view.setUint32(p, byteRate, true); p += 4
  view.setUint16(p, blockAlign, true); p += 2
  view.setUint16(p, bitsPerSample, true); p += 2
  // data chunk
  writeAscii('data')
  view.setUint32(p, dataSize, true); p += 4

  // Interleaved 16-bit signed PCM
  const channelData: Float32Array[] = []
  for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c))

  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, channelData[c][i]))
      const i16 = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
      view.setInt16(p, i16, true); p += 2
    }
  }

  return new Blob([out], { type: 'audio/wav' })
}

export async function readWavHeader(blob: Blob): Promise<WavHeader> {
  const headerBytes = new Uint8Array(await blob.slice(0, 44).arrayBuffer())
  const view = new DataView(headerBytes.buffer)
  const ascii = (offset: number, length: number) =>
    Array.from(headerBytes.slice(offset, offset + length))
      .map((b) => String.fromCharCode(b))
      .join('')

  return {
    riffMagic: ascii(0, 4),
    waveMagic: ascii(8, 4),
    audioFormat: view.getUint16(20, true),
    numChannels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    dataChunkSize: view.getUint32(40, true),
  }
}
