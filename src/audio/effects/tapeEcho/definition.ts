// ABOUTME: TapeEcho EffectDefinition — wraps the tapeEcho worklet node.
// ABOUTME: Default mix is dry so slot is bypass-eligible until user dials it in.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import tapeEchoUrl from '../../worklets/tapeEcho.worklet.ts?worker&url'
import { TapeEchoPanel } from './panel'

void tapeEchoUrl

type P = { timeMs: number; feedback: number; mix: number; wowFlutter: number; tone: number }

const def: EffectDefinition<'tapeEcho'> = {
  kind: 'tapeEcho',
  displayName: 'TapeEcho',
  defaultParams: { timeMs: 320, feedback: 0.45, mix: 0, wowFlutter: 0.15, tone: 0.6 },
  isNeutral: (p) => p.mix < 0.05,
  build(ctx, params): EffectNode<P> {
    const node = new AudioWorkletNode(ctx, 'tapeEcho')
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
  Panel: TapeEchoPanel,
}

register(def)
