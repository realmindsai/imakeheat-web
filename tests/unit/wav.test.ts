import { describe, it, expect } from 'vitest'
import { wavEncode, readWavHeader } from '../../src/audio/wav'
import { makeSine } from '../helpers/audio-buffer'

describe('wav round-trip', () => {
  it('encodes a mono 1-second 440 Hz sine into a valid WAV blob', async () => {
    const buf = makeSine(1, 48000, 1, 440)
    const blob = await wavEncode(buf)
    const header = await readWavHeader(blob)

    expect(header.riffMagic).toBe('RIFF')
    expect(header.waveMagic).toBe('WAVE')
    expect(header.audioFormat).toBe(1) // PCM
    expect(header.numChannels).toBe(1)
    expect(header.sampleRate).toBe(48000)
    expect(header.bitsPerSample).toBe(16)
    expect(header.byteRate).toBe(48000 * 1 * 16 / 8)
    expect(header.blockAlign).toBe(1 * 16 / 8)
    expect(header.dataChunkSize).toBe(48000 * 1 * 16 / 8) // 1 second of 16-bit mono
    expect(blob.size).toBe(44 + header.dataChunkSize)
  })

  it('encodes stereo correctly (interleaved samples, doubled byte rate)', async () => {
    const buf = makeSine(2, 44100, 0.5, 220)
    const blob = await wavEncode(buf)
    const header = await readWavHeader(blob)

    expect(header.numChannels).toBe(2)
    expect(header.sampleRate).toBe(44100)
    expect(header.byteRate).toBe(44100 * 2 * 16 / 8)
    expect(header.blockAlign).toBe(2 * 16 / 8)
    expect(header.dataChunkSize).toBe(Math.round(44100 * 0.5) * 2 * 2)
  })

  it('does not lie about the sample rate (regression — see walkthrough.md §10)', async () => {
    const buf = makeSine(2, 48000, 0.1, 440)
    const blob = await wavEncode(buf)
    const header = await readWavHeader(blob)
    expect(header.sampleRate).toBe(48000) // not 96000
  })

  it('encodes silence as all-zero PCM', async () => {
    const buf = makeSine(1, 8000, 0.1, 0, 0) // amplitude 0
    const blob = await wavEncode(buf)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    for (let i = 44; i < bytes.length; i++) {
      expect(bytes[i]).toBe(0)
    }
  })
})
