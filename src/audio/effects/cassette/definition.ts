// ABOUTME: Cassette Sim EffectDefinition — wraps the cassette worklet with tape-age and transport controls.
// ABOUTME: Neutral params bypass by omission; non-neutral params build one AudioWorkletNode in chain order.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import cassetteUrl from '../../worklets/cassette.worklet.ts?worker&url'
import { CassettePanel } from './panel'

void cassetteUrl

type P = {
  tone: number
  hiss: number
  ageYears: number
  drive: number
  wowFlutter: number
  catch: number
}

const def: EffectDefinition<'cassette'> = {
  kind: 'cassette',
  displayName: 'Cassette Sim',
  defaultParams: { tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 },
  isNeutral: (p) =>
    p.tone === 50
    && p.hiss === 0
    && p.ageYears === 0
    && p.drive === 0
    && p.wowFlutter === 0
    && p.catch === 0,
  build(ctx, params): EffectNode<P> {
    const node = new AudioWorkletNode(ctx, 'cassette')
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
  Panel: CassettePanel,
}

register(def)
