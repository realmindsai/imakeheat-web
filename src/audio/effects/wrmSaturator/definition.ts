// ABOUTME: Placeholder WrmSaturator EffectDefinition for phase2 registry/type surface task.
// ABOUTME: Uses passthrough GainNode so kind can be registered without DSP behavior yet.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import { WrmSaturatorPanel } from './panel'

type P = { amount: number; bias: number; tone: number; mix: number; level: number }

const def: EffectDefinition<'wrmSaturator'> = {
  kind: 'wrmSaturator',
  displayName: 'WrmSaturator',
  defaultParams: { amount: 0.35, bias: 0.5, tone: 0.5, mix: 0, level: 1 },
  isNeutral: (p) => p.mix < 0.05,
  build(ctx): EffectNode<P> {
    const node = ctx.createGain()
    return {
      input: node,
      output: node,
      apply() {},
      dispose() {
        node.disconnect()
      },
    }
  },
  Panel: WrmSaturatorPanel,
}

register(def)
