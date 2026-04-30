// ABOUTME: Filter EffectDefinition — wraps a BiquadFilterNode driven by the -1..+1 mapping.
// ABOUTME: Live preview ramps frequency/Q smoothly; offline render assigns directly.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import { filterParams } from '../../filter-mapping'
import { FilterPanel } from './panel'

type P = { value: number }

const def: EffectDefinition<'filter'> = {
  kind: 'filter',
  displayName: 'Filter',
  defaultParams: { value: 0 },
  isNeutral: (p) => Math.abs(p.value) < 0.01,
  build(ctx, params): EffectNode<P> {
    const node = ctx.createBiquadFilter()
    const fp = filterParams(params.value, ctx.sampleRate)
    node.type = fp.type
    node.frequency.value = fp.frequency
    node.Q.value = fp.Q
    return {
      input: node, output: node,
      apply(p) {
        const fp2 = filterParams(p.value, ctx.sampleRate)
        node.type = fp2.type
        // setTargetAtTime requires a real-time AudioContext (currentTime advances).
        // OfflineAudioContext also exposes currentTime; the conservative fallback
        // is to assign .value directly when there's no possibility of a click —
        // i.e. when the chain is being initially built (params haven't drifted yet).
        // Using setTargetAtTime in both contexts is fine because OfflineAudioContext
        // schedules deterministically; live preview gets a smooth ramp.
        node.frequency.setTargetAtTime(fp2.frequency, ctx.currentTime, 0.01)
        node.Q.setTargetAtTime(fp2.Q, ctx.currentTime, 0.01)
      },
      dispose() { node.disconnect() },
    }
  },
  Panel: FilterPanel,
}
register(def)
