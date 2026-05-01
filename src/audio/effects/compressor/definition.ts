// ABOUTME: Compressor EffectDefinition — native dynamics compressor with a sustain macro and output level.
// ABOUTME: Defaults are conservative so the slot is neutral until the user pushes controls.

import { register } from '../_internal'
import type { EffectDefinition, EffectNode } from '../types'
import { CompressorPanel } from './panel'

type P = { sustain: number; attack: number; ratio: number; level: number }

function ratioValue(ratio: number): number {
  return 1.5 + (ratio / 100) * 10.5
}

function attackValue(attack: number): number {
  return 0.003 + (attack / 100) * 0.117
}

function thresholdValue(sustain: number): number {
  return -2 - (sustain / 100) * 28
}

function makeupGain(level: number, sustain: number): number {
  const base = level / 100
  const makeup = 1 + (sustain / 100) * 0.6
  return base * makeup
}

const def: EffectDefinition<'compressor'> = {
  kind: 'compressor',
  displayName: 'Compressor',
  defaultParams: { sustain: 0, attack: 50, ratio: 0, level: 100 },
  isNeutral: (p) => p.sustain === 0 && p.attack === 50 && p.ratio === 0 && p.level === 100,
  build(ctx, params): EffectNode<P> {
    const comp = ctx.createDynamicsCompressor()
    const out = ctx.createGain()
    comp.connect(out)

    const applyNow = (p: P) => {
      comp.threshold.value = thresholdValue(p.sustain)
      comp.attack.value = attackValue(p.attack)
      comp.ratio.value = ratioValue(p.ratio)
      comp.knee.value = 18
      comp.release.value = 0.12
      out.gain.value = makeupGain(p.level, p.sustain)
    }

    const applySmooth = (p: P) => {
      comp.threshold.setTargetAtTime(thresholdValue(p.sustain), ctx.currentTime, 0.01)
      comp.attack.setTargetAtTime(attackValue(p.attack), ctx.currentTime, 0.01)
      comp.ratio.setTargetAtTime(ratioValue(p.ratio), ctx.currentTime, 0.01)
      comp.knee.setTargetAtTime(18, ctx.currentTime, 0.01)
      comp.release.setTargetAtTime(0.12, ctx.currentTime, 0.01)
      out.gain.setTargetAtTime(makeupGain(p.level, p.sustain), ctx.currentTime, 0.01)
    }

    applyNow(params)

    return {
      input: comp,
      output: out,
      apply(p) {
        applySmooth(p)
      },
      dispose() {
        comp.disconnect()
        out.disconnect()
      },
    }
  },
  Panel: CompressorPanel,
}

register(def)
