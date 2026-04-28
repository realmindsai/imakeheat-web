import { renderOffline } from '../../src/audio/graph'
import type { EffectParams } from '../../src/audio/types'

declare global {
  interface Window {
    __run: (payload: {
      kind: 'render'
      sourcePcm: number[][]
      sampleRate: number
      effects: EffectParams
      trim: { startSec: number; endSec: number }
    }) => Promise<{ pcm: number[][]; sampleRate: number; length: number }>
  }
}

window.__run = async (payload) => {
  const pitchRate = Math.pow(2, payload.effects.pitchSemitones / 12)
  const trimSec = payload.trim.endSec - payload.trim.startSec
  const ctx = new OfflineAudioContext({
    numberOfChannels: payload.sourcePcm.length,
    length: Math.max(1, Math.ceil((trimSec / pitchRate) * payload.sampleRate)),
    sampleRate: payload.sampleRate,
  })

  const buffer = ctx.createBuffer(payload.sourcePcm.length, payload.sourcePcm[0].length, payload.sampleRate)
  for (let c = 0; c < payload.sourcePcm.length; c++) {
    buffer.copyToChannel(Float32Array.from(payload.sourcePcm[c]), c)
  }

  const rendered = await renderOffline(ctx, buffer, payload.trim, payload.effects)
  const pcm: number[][] = []
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    pcm.push(Array.from(rendered.getChannelData(c)))
  }
  return { pcm, sampleRate: rendered.sampleRate, length: rendered.length }
}

document.getElementById('status')!.textContent = 'ready'
