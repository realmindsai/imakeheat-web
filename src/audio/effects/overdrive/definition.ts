// ABOUTME: Placeholder Overdrive EffectDefinition for phase2 registry/type surface task.
// ABOUTME: Uses passthrough GainNode so kind can be registered without DSP behavior yet.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import { OverdrivePanel } from './panel'

type P = { drive: number; tone: number; level: number; mix: number }

const def: EffectDefinition<'overdrive'> = {
  kind: 'overdrive',
  displayName: 'Overdrive',
  defaultParams: { drive: 0.35, tone: 0.5, level: 1, mix: 0 },
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
  Panel: OverdrivePanel,
}

register(def)
