// ABOUTME: Crusher EffectDefinition — wraps the existing bitcrusher worklet as an EffectNode.
// ABOUTME: Real build()/Panel; the worklet module is loaded by the engine before any build() runs.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import bitcrusherUrl from '../../worklets/bitcrusher.worklet.ts?worker&url'
import { CrusherPanel } from './panel'

void bitcrusherUrl

type P = { bitDepth: 2 | 4 | 8 | 12 | 16 }

const def: EffectDefinition<'crusher'> = {
  kind: 'crusher',
  displayName: 'Crusher',
  defaultParams: { bitDepth: 16 },
  isNeutral: (p) => p.bitDepth === 16,
  build(ctx, params): EffectNode<P> {
    // The worklet module is loaded once per ctx by the engine before any build() is called.
    const node = new AudioWorkletNode(ctx, 'bitcrusher')
    node.port.postMessage({ bits: params.bitDepth })
    return {
      input: node,
      output: node,
      apply(p) { node.port.postMessage({ bits: p.bitDepth }) },
      dispose() { node.disconnect() },
    }
  },
  Panel: CrusherPanel,
}
register(def)
