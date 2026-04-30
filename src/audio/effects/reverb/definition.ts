// ABOUTME: Reverb EffectDefinition — wraps the reverb worklet (Android ReverbEffect.kt port).
// ABOUTME: Default mix=0 means the slot is bypass-eligible until the user turns it up.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import reverbUrl from '../../worklets/reverb.worklet.ts?worker&url'
import { ReverbPanel } from './panel'

void reverbUrl // keep side-effect import alive under strict unused-binding lint

type P = { size: number; decay: number; mix: number }

const def: EffectDefinition<'reverb'> = {
  kind: 'reverb',
  displayName: 'Reverb',
  defaultParams: { size: 0.5, decay: 0.5, mix: 0 },
  isNeutral: (p) => p.mix < 0.05,
  build(ctx, params): EffectNode<P> {
    const node = new AudioWorkletNode(ctx, 'reverb')
    node.port.postMessage(params)
    return {
      input: node,
      output: node,
      apply(p) {
        node.port.postMessage(p)
      },
      dispose() {
        node.disconnect()
      },
    }
  },
  Panel: ReverbPanel,
}
register(def)
