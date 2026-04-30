// ABOUTME: 404 VinylSim EffectDefinition — wraps a cleaner vintage worklet with playback-response controls.
// ABOUTME: Neutral params bypass by omission; non-neutral params build one AudioWorkletNode in chain order.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import vinyl404Url from '../../worklets/vinyl404.worklet.ts?worker&url'
import { Vinyl404Panel } from './panel'

void vinyl404Url

type P = { frequency: number; noise: number; wowFlutter: number }

const def: EffectDefinition<'vinyl404'> = {
  kind: 'vinyl404',
  displayName: '404 VinylSim',
  defaultParams: { frequency: 100, noise: 0, wowFlutter: 0 },
  isNeutral: (p) => p.frequency === 100 && p.noise === 0 && p.wowFlutter === 0,
  build(ctx, params): EffectNode<P> {
    const node = new AudioWorkletNode(ctx, 'vinyl404')
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
  Panel: Vinyl404Panel,
}

register(def)
