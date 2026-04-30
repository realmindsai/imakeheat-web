// ABOUTME: Echo EffectDefinition — passthrough placeholder; real worklet lands in Task 4.1.
// ABOUTME: Default mix=0 means the slot is bypass-eligible until the user turns it up.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import { EchoPanel } from './panel'

type P = { timeMs: number; feedback: number; mix: number }

const def: EffectDefinition<'echo'> = {
  kind: 'echo',
  displayName: 'Echo',
  defaultParams: { timeMs: 250, feedback: 0.4, mix: 0 },
  isNeutral: (p) => p.mix < 0.05,
  build(ctx): EffectNode<P> {
    const gain = (ctx as AudioContext | OfflineAudioContext).createGain()
    gain.gain.value = 1
    return {
      input: gain, output: gain,
      apply() { /* TODO(Task 4.1): post params to echo worklet */ },
      dispose() { gain.disconnect() },
    }
  },
  Panel: EchoPanel,
}
register(def)
