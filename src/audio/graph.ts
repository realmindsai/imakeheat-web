// ABOUTME: Audio node graph builders — worklet loader and offline rendering.
// ABOUTME: loadWorklets registers bitcrusher + srhold + wsola processors into any BaseAudioContext.

import type { TrimPoints } from './types'
import type { Chain, EffectNode } from './effects/types'
import { registry } from './effects/registry'

import bitcrusherUrl from './worklets/bitcrusher.worklet.ts?worker&url'
import srholdUrl from './worklets/srhold.worklet.ts?worker&url'
import wsolaUrl from './worklets/wsola.worklet.ts?worker&url'
import echoUrl from './worklets/echo.worklet.ts?worker&url'
import reverbUrl from './worklets/reverb.worklet.ts?worker&url'
import vinyl303Url from './worklets/vinyl303.worklet.ts?worker&url'
import vinyl404Url from './worklets/vinyl404.worklet.ts?worker&url'
import cassetteUrl from './worklets/cassette.worklet.ts?worker&url'

export async function loadWorklets(ctx: BaseAudioContext): Promise<void> {
  await ctx.audioWorklet.addModule(bitcrusherUrl)
  await ctx.audioWorklet.addModule(srholdUrl)
  await ctx.audioWorklet.addModule(wsolaUrl)
  await ctx.audioWorklet.addModule(echoUrl)
  await ctx.audioWorklet.addModule(reverbUrl)
  await ctx.audioWorklet.addModule(vinyl303Url)
  await ctx.audioWorklet.addModule(vinyl404Url)
  await ctx.audioWorklet.addModule(cassetteUrl)
}

function speedFromChain(chain: Chain): number {
  const p = chain.find((s) => s.kind === 'pitch')
  if (!p || !p.enabled) return 1
  return (p.params as { semitones: number; speed: number }).speed ?? 1
}

const TAIL_PADDING_SEC = 4

export async function renderOffline(
  buffer: AudioBuffer,
  trim: TrimPoints,
  chain: Chain,
): Promise<AudioBuffer> {
  const sourceDur = trim.endSec - trim.startSec
  const speed = speedFromChain(chain)
  const baseLen = sourceDur / speed
  // Tail padding: when echo or reverb is active in the chain, append silence
  // to the OfflineAudioContext so the wet tail is captured rather than
  // truncated at audio EOF. Worklets keep producing output as zero-input runs.
  const needsTail = chain.some((s) => {
    if (!s.enabled || (s.kind !== 'echo' && s.kind !== 'reverb')) return false
    const def = registry.get(s.kind)
    if (!def) return false
    return !def.isNeutral(s.params as never)
  })
  const totalLen = baseLen + (needsTail ? TAIL_PADDING_SEC : 0)
  const totalSamples = Math.max(1, Math.ceil(totalLen * buffer.sampleRate))
  const ctx = new OfflineAudioContext({
    numberOfChannels: buffer.numberOfChannels,
    length: totalSamples,
    sampleRate: buffer.sampleRate,
  })
  await loadWorklets(ctx)

  // Build effect nodes via the registry. Pitch is control-only — WSOLA owns it.
  const nodes: EffectNode<unknown>[] = []
  for (const s of chain) {
    if (s.kind === 'pitch') continue
    const def = registry.get(s.kind)
    if (!def) continue
    if (s.enabled && !def.isNeutral(s.params as never)) {
      nodes.push(def.build(ctx, s.params as never) as EffectNode<unknown>)
    }
  }

  const player = new AudioWorkletNode(ctx, 'wsola')

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
      if ((ev.data as { type?: string }).type === 'loaded') resolve()
    }
    player.port.postMessage(
      { type: 'load', channels, sampleRate: buffer.sampleRate },
      transfer,
    )
  })
  player.port.onmessage = null
  player.port.postMessage({ type: 'play', offsetSec: trim.startSec, trim, chain })

  // Wire: player → [active nodes in chain order] → destination.
  let prev: AudioNode = player
  for (const node of nodes) {
    prev.connect(node.input)
    prev = node.output
  }
  prev.connect(ctx.destination)

  return ctx.startRendering()
}
