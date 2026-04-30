import { renderOffline } from '../../src/audio/graph'
import { filterParams } from '../../src/audio/filter-mapping'
import { pitchRateFromSemitones } from '../../src/audio/pitch'
import bitcrusherUrl from '../../src/audio/worklets/bitcrusher.worklet.ts?worker&url'
import srholdUrl from '../../src/audio/worklets/srhold.worklet.ts?worker&url'
import type { Chain } from '../../src/audio/effects/types'

// Local literal type for the legacy BufferSource render path. Mirrors the
// pre-pedalboard EffectParams snapshot — kept here only to drive the
// `render-legacy` test path that doesn't go through renderOffline.
interface LegacyFx {
  bitDepth: number
  sampleRateHz: number
  pitchSemitones: number
  speed: number
  filterValue: number
}

interface RunPayload {
  kind: 'render' | 'render-legacy'
  sourcePcm: number[][]
  sampleRate: number
  trim: { startSec: number; endSec: number }
  chain?: Chain      // for kind === 'render'
  legacyFx?: LegacyFx // for kind === 'render-legacy'
}

declare global {
  interface Window {
    __run: (payload: RunPayload) => Promise<{ pcm: number[][]; sampleRate: number; length: number }>
  }
}

async function renderLegacy(payload: RunPayload) {
  if (!payload.legacyFx) throw new Error('renderLegacy: missing legacyFx')
  const fx = payload.legacyFx
  // Pre-WSOLA path: BufferSource with playbackRate; pitch couples to duration.
  const pitchRate = pitchRateFromSemitones(fx.pitchSemitones)
  const trimSec = payload.trim.endSec - payload.trim.startSec
  const ctx = new OfflineAudioContext({
    numberOfChannels: payload.sourcePcm.length,
    length: Math.max(1, Math.ceil((trimSec / pitchRate) * payload.sampleRate)),
    sampleRate: payload.sampleRate,
  })
  await ctx.audioWorklet.addModule(bitcrusherUrl)
  await ctx.audioWorklet.addModule(srholdUrl)

  const buffer = ctx.createBuffer(
    payload.sourcePcm.length,
    payload.sourcePcm[0].length,
    payload.sampleRate,
  )
  for (let c = 0; c < payload.sourcePcm.length; c++) {
    buffer.copyToChannel(Float32Array.from(payload.sourcePcm[c]), c)
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = pitchRate

  const bitCrusher = new AudioWorkletNode(ctx, 'bitcrusher')
  bitCrusher.port.postMessage({ bits: fx.bitDepth })
  const srHold = new AudioWorkletNode(ctx, 'srhold')
  const holdFactor = Math.max(
    1,
    Math.floor(ctx.sampleRate / Math.max(1, fx.sampleRateHz)),
  )
  srHold.port.postMessage({ holdFactor })
  const filter = ctx.createBiquadFilter()
  const fp = filterParams(fx.filterValue, ctx.sampleRate)
  filter.type = fp.type
  filter.frequency.value = fp.frequency
  filter.Q.value = fp.Q

  source.connect(bitCrusher)
  bitCrusher.connect(srHold)
  srHold.connect(filter)
  filter.connect(ctx.destination)

  source.start(0, payload.trim.startSec, trimSec)
  const rendered = await ctx.startRendering()
  const pcm: number[][] = []
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    pcm.push(Array.from(rendered.getChannelData(c)))
  }
  return { pcm, sampleRate: rendered.sampleRate, length: rendered.length }
}

async function renderViaWorklet(payload: RunPayload) {
  if (!payload.chain) throw new Error('renderViaWorklet: missing chain')

  const buffer = new AudioBuffer({
    numberOfChannels: payload.sourcePcm.length,
    length: payload.sourcePcm[0].length,
    sampleRate: payload.sampleRate,
  })
  for (let c = 0; c < payload.sourcePcm.length; c++) {
    buffer.copyToChannel(Float32Array.from(payload.sourcePcm[c]), c)
  }

  const rendered = await renderOffline(buffer, payload.trim, payload.chain)
  const pcm: number[][] = []
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    pcm.push(Array.from(rendered.getChannelData(c)))
  }
  return { pcm, sampleRate: rendered.sampleRate, length: rendered.length }
}

window.__run = async (payload) => {
  return payload.kind === 'render-legacy' ? renderLegacy(payload) : renderViaWorklet(payload)
}

document.getElementById('status')!.textContent = 'ready'
