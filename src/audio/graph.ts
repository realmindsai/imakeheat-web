// ABOUTME: Audio node graph builders — preview (live AudioContext) and offline rendering.
// ABOUTME: loadWorklets registers bitcrusher + srhold processors into any BaseAudioContext.

import type { EffectParams, TrimPoints } from './types'
import { pitchRateFromSemitones } from './pitch'
import { filterParams } from './filter-mapping'

import bitcrusherUrl from './worklets/bitcrusher.worklet.ts?worker&url'
import srholdUrl from './worklets/srhold.worklet.ts?worker&url'

export interface PreviewGraph {
  ctx: AudioContext
  bitCrusher: AudioWorkletNode
  srHold: AudioWorkletNode
  filter: BiquadFilterNode
  analyser: AnalyserNode
  setSource(source: AudioBufferSourceNode): void
  applyEffects(fx: EffectParams): void
  applyPitch(source: AudioBufferSourceNode, semitones: number): void
}

export async function loadWorklets(ctx: BaseAudioContext): Promise<void> {
  await ctx.audioWorklet.addModule(bitcrusherUrl)
  await ctx.audioWorklet.addModule(srholdUrl)
}

export async function buildPreviewGraph(ctx: AudioContext): Promise<PreviewGraph> {
  await loadWorklets(ctx)

  const bitCrusher = new AudioWorkletNode(ctx, 'bitcrusher')
  const srHold = new AudioWorkletNode(ctx, 'srhold')
  const filter = ctx.createBiquadFilter()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024

  bitCrusher.connect(srHold)
  srHold.connect(filter)
  filter.connect(analyser)
  analyser.connect(ctx.destination)

  return {
    ctx,
    bitCrusher,
    srHold,
    filter,
    analyser,
    setSource(source) {
      source.connect(bitCrusher)
    },
    applyEffects(fx) {
      bitCrusher.port.postMessage({ bits: fx.bitDepth })
      const holdFactor = Math.max(1, Math.floor(ctx.sampleRate / Math.max(1, fx.sampleRateHz)))
      srHold.port.postMessage({ holdFactor })
      const fp = filterParams(fx.filterValue, ctx.sampleRate)
      filter.type = fp.type
      filter.frequency.setTargetAtTime(fp.frequency, ctx.currentTime, 0.01)
      filter.Q.setTargetAtTime(fp.Q, ctx.currentTime, 0.01)
    },
    applyPitch(source, semitones) {
      source.playbackRate.value = pitchRateFromSemitones(semitones)
    },
  }
}

export async function renderOffline(
  ctx: OfflineAudioContext,
  buffer: AudioBuffer,
  trim: TrimPoints,
  fx: EffectParams,
): Promise<AudioBuffer> {
  await loadWorklets(ctx)

  const bitCrusher = new AudioWorkletNode(ctx, 'bitcrusher')
  const srHold = new AudioWorkletNode(ctx, 'srhold')
  const filter = ctx.createBiquadFilter()

  bitCrusher.port.postMessage({ bits: fx.bitDepth })
  const holdFactor = Math.max(1, Math.floor(ctx.sampleRate / Math.max(1, fx.sampleRateHz)))
  srHold.port.postMessage({ holdFactor })
  const fp = filterParams(fx.filterValue, ctx.sampleRate)
  filter.type = fp.type
  filter.frequency.value = fp.frequency
  filter.Q.value = fp.Q

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = pitchRateFromSemitones(fx.pitchSemitones)

  source.connect(bitCrusher)
  bitCrusher.connect(srHold)
  srHold.connect(filter)
  filter.connect(ctx.destination)

  source.start(0, trim.startSec, trim.endSec - trim.startSec)
  return ctx.startRendering()
}
