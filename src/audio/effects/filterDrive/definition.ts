// ABOUTME: Filter+Drive EffectDefinition — resonant filter into waveshaper with low-end compensation.
// ABOUTME: Defaults are conservative and neutral enough to skip from the chain until users push controls.

import { register } from '../_internal'
import { makeSoftClipCurve, outputTrimFromDrive } from '../_shared/waveshaper'
import type { EffectDefinition, EffectNode } from '../types'
import { FilterDrivePanel } from './panel'

type P = {
  cutoffHz: number
  resonance: number
  drive: number
  filterType: 'lowpass' | 'highpass'
  lowFreq: number
  lowGain: number
}

const def: EffectDefinition<'filterDrive'> = {
  kind: 'filterDrive',
  displayName: 'Filter+Drive',
  defaultParams: {
    cutoffHz: 16000,
    resonance: 0,
    drive: 0,
    filterType: 'lowpass',
    lowFreq: 200,
    lowGain: 0,
  },
  isNeutral: (p) =>
    p.cutoffHz === 16000
    && p.resonance === 0
    && p.drive === 0
    && p.filterType === 'lowpass'
    && p.lowFreq === 200
    && p.lowGain === 0,
  build(ctx, params): EffectNode<P> {
    const filter = ctx.createBiquadFilter()
    const shaper = ctx.createWaveShaper()
    const low = ctx.createBiquadFilter()
    const out = ctx.createGain()

    filter.connect(shaper)
    shaper.connect(low)
    low.connect(out)

    low.type = 'lowshelf'
    shaper.oversample = '2x'

    const applyNow = (p: P) => {
      filter.type = p.filterType
      filter.frequency.value = p.cutoffHz
      filter.Q.value = 0.0001 + (p.resonance / 100) * 16
      shaper.curve = makeSoftClipCurve(p.drive / 100)
      low.frequency.value = p.lowFreq
      low.gain.value = p.lowGain
      out.gain.value = outputTrimFromDrive(p.drive / 100)
    }

    const applySmooth = (p: P) => {
      filter.type = p.filterType
      filter.frequency.setTargetAtTime(p.cutoffHz, ctx.currentTime, 0.01)
      filter.Q.setTargetAtTime(0.0001 + (p.resonance / 100) * 16, ctx.currentTime, 0.01)
      shaper.curve = makeSoftClipCurve(p.drive / 100)
      low.frequency.setTargetAtTime(p.lowFreq, ctx.currentTime, 0.01)
      low.gain.setTargetAtTime(p.lowGain, ctx.currentTime, 0.01)
      out.gain.setTargetAtTime(outputTrimFromDrive(p.drive / 100), ctx.currentTime, 0.01)
    }

    applyNow(params)

    return {
      input: filter,
      output: out,
      apply(p) {
        applySmooth(p)
      },
      dispose() {
        filter.disconnect()
        shaper.disconnect()
        low.disconnect()
        out.disconnect()
      },
    }
  },
  Panel: FilterDrivePanel,
}

register(def)
