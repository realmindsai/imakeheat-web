// ABOUTME: TimeCtrlDly EffectDefinition — wraps the time-controlled delay worklet.
// ABOUTME: Neutral state is dry-leaning mix so slot can be bypass-eligible.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import timeCtrlDlyUrl from '../../worklets/timeCtrlDly.worklet.ts?worker&url'
import { TimeCtrlDlyPanel } from './panel'

void timeCtrlDlyUrl

type P = { timeMs: number; feedback: number; mix: number; ducking: number }

const def: EffectDefinition<'timeCtrlDly'> = {
  kind: 'timeCtrlDly',
  displayName: 'TimeCtrlDly',
  defaultParams: { timeMs: 280, feedback: 0.35, mix: 0, ducking: 0.2 },
  isNeutral: (p) => p.mix < 0.05,
  build(ctx, params): EffectNode<P> {
    const node = new AudioWorkletNode(ctx, 'timeCtrlDly')
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
  Panel: TimeCtrlDlyPanel,
}

register(def)
