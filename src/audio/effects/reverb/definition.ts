// ABOUTME: Reverb EffectDefinition — passthrough placeholder; real worklet lands in Task 4.2.
// ABOUTME: Default mix=0 means the slot is bypass-eligible until the user turns it up.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import { ReverbPanel } from './panel'

type P = { size: number; decay: number; mix: number }

const def: EffectDefinition<'reverb'> = {
  kind: 'reverb',
  displayName: 'Reverb',
  defaultParams: { size: 0.5, decay: 0.5, mix: 0 },
  isNeutral: (p) => p.mix < 0.05,
  build(ctx): EffectNode<P> {
    const gain = (ctx as AudioContext | OfflineAudioContext).createGain()
    gain.gain.value = 1
    return {
      input: gain, output: gain,
      apply() { /* TODO(Task 4.2): post params to reverb worklet */ },
      dispose() { gain.disconnect() },
    }
  },
  Panel: ReverbPanel,
}
register(def)
