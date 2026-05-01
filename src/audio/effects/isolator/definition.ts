// ABOUTME: Isolator EffectDefinition — a native three-band performance EQ with fixed crossover points.
// ABOUTME: Reuses the shared EQ scaffold so later Phase 1 EQ-style effects can build on the same chain shape.

import { register } from '../_internal'
import {
  assignThreeBandEqGains,
  createThreeBandEq,
  smoothThreeBandEqGains,
} from '../_shared/eq'
import type { EffectDefinition, EffectNode } from '../types'
import { IsolatorPanel } from './panel'

type P = { low: number; mid: number; high: number }

const def: EffectDefinition<'isolator'> = {
  kind: 'isolator',
  displayName: 'Isolator',
  defaultParams: { low: 0, mid: 0, high: 0 },
  isNeutral: (p) => p.low === 0 && p.mid === 0 && p.high === 0,
  build(ctx, params): EffectNode<P> {
    const nodes = createThreeBandEq(ctx, { low: 120, mid: 1000, high: 6000 })
    assignThreeBandEqGains(nodes, params)
    return {
      input: nodes.input,
      output: nodes.output,
      apply(next) {
        smoothThreeBandEqGains(nodes, next, ctx.currentTime)
      },
      dispose() {
        nodes.low.disconnect()
        nodes.mid.disconnect()
        nodes.high.disconnect()
      },
    }
  },
  Panel: IsolatorPanel,
}

register(def)
