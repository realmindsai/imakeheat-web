// ABOUTME: Placeholder TimeCtrlDly EffectDefinition for phase2 registry/type surface task.
// ABOUTME: Uses passthrough GainNode so kind can be registered without DSP behavior yet.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import { TimeCtrlDlyPanel } from './panel'

type P = { timeMs: number; feedback: number; mix: number; ducking: number }

const def: EffectDefinition<'timeCtrlDly'> = {
  kind: 'timeCtrlDly',
  displayName: 'TimeCtrlDly',
  defaultParams: { timeMs: 280, feedback: 0.35, mix: 0, ducking: 0.2 },
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
  Panel: TimeCtrlDlyPanel,
}

register(def)
