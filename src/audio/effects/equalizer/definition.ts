// ABOUTME: Equalizer EffectDefinition — a native three-band EQ with user-tunable band gains and center frequencies.
// ABOUTME: Reuses the shared EQ scaffold to match the isolator topology while allowing live frequency sweeps.

import { register } from '../_internal'
import {
  assignThreeBandEqFreqs,
  assignThreeBandEqGains,
  createThreeBandEq,
  smoothThreeBandEqFreqs,
  smoothThreeBandEqGains,
} from '../_shared/eq'
import type { EffectDefinition, EffectNode } from '../types'
import { EqualizerPanel } from './panel'

type P = {
  lowGain: number
  midGain: number
  highGain: number
  lowFreq: number
  midFreq: number
  highFreq: number
}

const def: EffectDefinition<'equalizer'> = {
  kind: 'equalizer',
  displayName: 'Equalizer',
  defaultParams: {
    lowGain: 0,
    midGain: 0,
    highGain: 0,
    lowFreq: 80,
    midFreq: 1000,
    highFreq: 8000,
  },
  isNeutral: (p) => p.lowGain === 0 && p.midGain === 0 && p.highGain === 0,
  build(ctx, params): EffectNode<P> {
    const nodes = createThreeBandEq(ctx, {
      low: params.lowFreq,
      mid: params.midFreq,
      high: params.highFreq,
    })
    assignThreeBandEqFreqs(nodes, {
      low: params.lowFreq,
      mid: params.midFreq,
      high: params.highFreq,
    })
    assignThreeBandEqGains(nodes, {
      low: params.lowGain,
      mid: params.midGain,
      high: params.highGain,
    })
    return {
      input: nodes.input,
      output: nodes.output,
      apply(next) {
        smoothThreeBandEqFreqs(
          nodes,
          { low: next.lowFreq, mid: next.midFreq, high: next.highFreq },
          ctx.currentTime,
        )
        smoothThreeBandEqGains(
          nodes,
          { low: next.lowGain, mid: next.midGain, high: next.highGain },
          ctx.currentTime,
        )
      },
      dispose() {
        nodes.low.disconnect()
        nodes.mid.disconnect()
        nodes.high.disconnect()
      },
    }
  },
  Panel: EqualizerPanel,
}

register(def)
