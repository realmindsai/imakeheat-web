// ABOUTME: Placeholder Distortion EffectDefinition for phase2 registry/type surface task.
// ABOUTME: Uses passthrough GainNode so kind can be registered without DSP behavior yet.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import { DistortionPanel } from './panel'

type P = { drive: number; tone: number; level: number; mix: number }

const def: EffectDefinition<'distortion'> = {
  kind: 'distortion',
  displayName: 'Distortion',
  defaultParams: { drive: 0.45, tone: 0.5, level: 1, mix: 0 },
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
  Panel: DistortionPanel,
}

register(def)
