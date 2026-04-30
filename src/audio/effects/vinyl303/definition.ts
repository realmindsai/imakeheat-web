// ABOUTME: 303 VinylSim EffectDefinition — wraps a dedicated vintage worklet with SP-style macro controls.
// ABOUTME: Neutral params bypass by omission; non-neutral params build one AudioWorkletNode in chain order.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import vinyl303Url from '../../worklets/vinyl303.worklet.ts?worker&url'
import { Vinyl303Panel } from './panel'

void vinyl303Url

type P = { comp: number; noise: number; wowFlutter: number; level: number }

const def: EffectDefinition<'vinyl303'> = {
  kind: 'vinyl303',
  displayName: '303 VinylSim',
  defaultParams: { comp: 0, noise: 0, wowFlutter: 0, level: 100 },
  isNeutral: (p) => p.comp === 0 && p.noise === 0 && p.wowFlutter === 0 && p.level === 100,
  build(ctx, params): EffectNode<P> {
    const node = new AudioWorkletNode(ctx, 'vinyl303')
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
  Panel: Vinyl303Panel,
}

register(def)
