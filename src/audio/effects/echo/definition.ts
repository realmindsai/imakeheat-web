// ABOUTME: Echo EffectDefinition — wraps the echo worklet (Android EchoEffect.kt port).
// ABOUTME: Default mix=0 means the slot is bypass-eligible until the user turns it up.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import echoUrl from '../../worklets/echo.worklet.ts?worker&url'
import { EchoPanel } from './panel'

void echoUrl // keep side-effect import alive under strict unused-binding lint

type P = { timeMs: number; feedback: number; mix: number }

const def: EffectDefinition<'echo'> = {
  kind: 'echo',
  displayName: 'Echo',
  defaultParams: { timeMs: 250, feedback: 0.4, mix: 0 },
  isNeutral: (p) => p.mix < 0.05,
  build(ctx, params): EffectNode<P> {
    const node = new AudioWorkletNode(ctx, 'echo')
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
  Panel: EchoPanel,
}
register(def)
