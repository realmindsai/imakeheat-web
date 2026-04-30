// ABOUTME: SR-hold EffectDefinition — wraps the existing srhold worklet as an EffectNode.
// ABOUTME: holdFactor = floor(ctx.sampleRate / params.sampleRateHz), min 1; param updates re-post.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import srholdUrl from '../../worklets/srhold.worklet.ts?worker&url'
import { SrHoldPanel } from './panel'

void srholdUrl   // keep side-effect import alive under strict unused-binding lint

type P = { sampleRateHz: number }

const def: EffectDefinition<'srhold'> = {
  kind: 'srhold',
  displayName: 'Sample rate',
  defaultParams: { sampleRateHz: 48000 },
  // TODO(Task 2.4): override at engine level using actual source.sampleRateHz.
  // Conservative threshold here keeps slots in the chain unless explicitly maxed.
  isNeutral: (p) => p.sampleRateHz >= 48000,
  build(ctx, params): EffectNode<P> {
    const node = new AudioWorkletNode(ctx, 'srhold')
    const holdFactor = Math.max(1, Math.floor(ctx.sampleRate / Math.max(1, params.sampleRateHz)))
    node.port.postMessage({ holdFactor })
    return {
      input: node, output: node,
      apply(p) {
        const hf = Math.max(1, Math.floor(ctx.sampleRate / Math.max(1, p.sampleRateHz)))
        node.port.postMessage({ holdFactor: hf })
      },
      dispose() { node.disconnect() },
    }
  },
  Panel: SrHoldPanel,
}
register(def)
