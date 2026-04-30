// ABOUTME: Audio node graph builders — worklet loader and offline rendering.
// ABOUTME: loadWorklets registers bitcrusher + srhold + wsola processors into any BaseAudioContext.

import type { EffectParams, TrimPoints } from './types'
import { filterParams } from './filter-mapping'

import bitcrusherUrl from './worklets/bitcrusher.worklet.ts?worker&url'
import srholdUrl from './worklets/srhold.worklet.ts?worker&url'
import wsolaUrl from './worklets/wsola.worklet.ts?worker&url'

export async function loadWorklets(ctx: BaseAudioContext): Promise<void> {
  await ctx.audioWorklet.addModule(bitcrusherUrl)
  await ctx.audioWorklet.addModule(srholdUrl)
  await ctx.audioWorklet.addModule(wsolaUrl)
}

export async function renderOffline(
  ctx: OfflineAudioContext,
  buffer: AudioBuffer,
  trim: TrimPoints,
  fx: EffectParams,
): Promise<AudioBuffer> {
  await loadWorklets(ctx)

  const player = new AudioWorkletNode(ctx, 'wsola')
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

  // Load buffer into the worklet (offline ctx accepts the same messages).
  // We await the 'loaded' ack before startRendering() to avoid a race where the
  // worklet thread processes the load message AFTER the first render quantum runs.
  const channels: Float32Array[] = []
  const transfer: ArrayBuffer[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = new Float32Array(buffer.length)
    buffer.copyFromChannel(data, c)
    channels.push(data)
    transfer.push(data.buffer)
  }
  await new Promise<void>((resolve) => {
    player.port.onmessage = (ev: MessageEvent) => {
      if ((ev.data as { type: string }).type === 'loaded') resolve()
    }
    player.port.postMessage(
      { type: 'load', channels, sampleRate: buffer.sampleRate },
      transfer,
    )
  })
  player.port.onmessage = null
  player.port.postMessage({
    type: 'play',
    offsetSec: trim.startSec,
    trim,
    fx,
  })

  player.connect(bitCrusher)
  bitCrusher.connect(srHold)
  srHold.connect(filter)
  filter.connect(ctx.destination)

  return ctx.startRendering()
}
