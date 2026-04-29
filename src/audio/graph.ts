// ABOUTME: Audio node graph builders — preview (live AudioContext) and offline rendering.
// ABOUTME: loadWorklets registers bitcrusher + srhold + wsola processors into any BaseAudioContext.

import type { EffectParams, TrimPoints } from './types'
import { pitchRateFromSemitones } from './pitch'
import { filterParams } from './filter-mapping'

import bitcrusherUrl from './worklets/bitcrusher.worklet.ts?worker&url'
import srholdUrl from './worklets/srhold.worklet.ts?worker&url'
import wsolaUrl from './worklets/wsola.worklet.ts?worker&url'

export interface PreviewGraph {
  ctx: AudioContext
  player: AudioWorkletNode
  bitCrusher: AudioWorkletNode
  srHold: AudioWorkletNode
  filter: BiquadFilterNode
  analyser: AnalyserNode
  loadBuffer(audioBuffer: AudioBuffer): void
  applyEffects(fx: EffectParams): void
}

export async function loadWorklets(ctx: BaseAudioContext): Promise<void> {
  await ctx.audioWorklet.addModule(bitcrusherUrl)
  await ctx.audioWorklet.addModule(srholdUrl)
  await ctx.audioWorklet.addModule(wsolaUrl)
}

export async function buildPreviewGraph(ctx: AudioContext): Promise<PreviewGraph> {
  await loadWorklets(ctx)

  const player = new AudioWorkletNode(ctx, 'wsola')
  const bitCrusher = new AudioWorkletNode(ctx, 'bitcrusher')
  const srHold = new AudioWorkletNode(ctx, 'srhold')
  const filter = ctx.createBiquadFilter()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024

  player.connect(bitCrusher)
  bitCrusher.connect(srHold)
  srHold.connect(filter)
  filter.connect(analyser)
  analyser.connect(ctx.destination)

  return {
    ctx,
    player,
    bitCrusher,
    srHold,
    filter,
    analyser,
    loadBuffer(audioBuffer) {
      const channels: Float32Array[] = []
      const transfer: ArrayBuffer[] = []
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const data = new Float32Array(audioBuffer.length)
        audioBuffer.copyFromChannel(data, c)
        channels.push(data)
        transfer.push(data.buffer)
      }
      player.port.postMessage(
        { type: 'load', channels, sampleRate: audioBuffer.sampleRate },
        transfer,
      )
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
  }
}

export async function renderOffline(
  ctx: OfflineAudioContext,
  buffer: AudioBuffer,
  trim: TrimPoints,
  fx: EffectParams,
): Promise<AudioBuffer> {
  // TODO(Task 13): rewrite to use WSOLA worklet for offline rendering.
  // For now, stub so engine.ts compiles. This path is not exercised until Task 13.
  throw new Error('not yet implemented (Task 13)')
  // Suppress unused-import lint errors — pitchRateFromSemitones used by the legacy
  // body that Task 13 will replace.
  void pitchRateFromSemitones
  void ctx
  void buffer
  void trim
  void fx
}
