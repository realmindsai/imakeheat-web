// ABOUTME: Placeholder TapeEcho EffectDefinition for phase2 registry/type surface task.
// ABOUTME: Uses passthrough GainNode so kind can be registered without DSP behavior yet.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import { TapeEchoPanel } from './panel'

type P = { timeMs: number; feedback: number; mix: number; wowFlutter: number; tone: number }

const def: EffectDefinition<'tapeEcho'> = {
  kind: 'tapeEcho',
  displayName: 'TapeEcho',
  defaultParams: { timeMs: 320, feedback: 0.45, mix: 0, wowFlutter: 0.15, tone: 0.6 },
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
  Panel: TapeEchoPanel,
}

register(def)
