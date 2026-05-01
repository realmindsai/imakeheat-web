// ABOUTME: Lo-fi EffectDefinition — curated degradation chain built from existing srhold and bitcrusher worklets.
// ABOUTME: Provides SP-style texture controls with dry/wet blend and bypass-safe defaults.

import { register } from '../_internal'
import { setDryWet } from '../_shared/dryWet'
import type { EffectDefinition, EffectNode } from '../types'
import { LoFiPanel } from './panel'

type P = {
  preFilt: number
  lofiType: number
  tone: number
  cutoffHz: number
  balance: number
  level: number
}

function crusherBits(lofiType: number): number {
  return [16, 12, 12, 8, 8, 6, 4, 4, 2][lofiType - 1] ?? 16
}

function heldRate(ctx: BaseAudioContext, lofiType: number): number {
  return [44100, 32000, 24000, 18000, 12000, 8000, 6000, 4000, 3000][lofiType - 1] ?? ctx.sampleRate
}

function preFreq(preFilt: number): number {
  return [16000, 9000, 6000, 3200, 1800, 900][preFilt - 1] ?? 16000
}

const def: EffectDefinition<'loFi'> = {
  kind: 'loFi',
  displayName: 'Lo-fi',
  defaultParams: { preFilt: 1, lofiType: 1, tone: 0, cutoffHz: 8000, balance: 0, level: 100 },
  isNeutral: (p) =>
    p.preFilt === 1
    && p.lofiType === 1
    && p.tone === 0
    && p.cutoffHz === 8000
    && p.balance === 0
    && p.level === 100,
  build(ctx, params): EffectNode<P> {
    const input = ctx.createGain()
    const output = ctx.createGain()
    const dry = ctx.createGain()
    const wetOut = ctx.createGain()
    const pre = ctx.createBiquadFilter()
    const tone = ctx.createBiquadFilter()
    const cutoff = ctx.createBiquadFilter()
    const level = ctx.createGain()
    const srhold = new AudioWorkletNode(ctx, 'srhold')
    const crusher = new AudioWorkletNode(ctx, 'bitcrusher')

    input.connect(dry)
    input.connect(pre)
    pre.connect(srhold)
    srhold.connect(crusher)
    crusher.connect(tone)
    tone.connect(cutoff)
    cutoff.connect(level)
    level.connect(wetOut)
    dry.connect(output)
    wetOut.connect(output)

    pre.type = 'lowpass'
    tone.type = 'highshelf'
    tone.frequency.value = 2200
    cutoff.type = 'lowpass'

    const apply = (p: P) => {
      pre.frequency.setTargetAtTime(preFreq(p.preFilt), ctx.currentTime, 0.01)
      tone.gain.setTargetAtTime((p.tone / 100) * 12, ctx.currentTime, 0.01)
      cutoff.frequency.setTargetAtTime(p.cutoffHz, ctx.currentTime, 0.01)
      level.gain.setTargetAtTime(p.level / 100, ctx.currentTime, 0.01)
      srhold.port.postMessage({ sampleRateHz: heldRate(ctx, p.lofiType) })
      crusher.port.postMessage({ bitDepth: crusherBits(p.lofiType) })
      setDryWet(dry, wetOut, p.balance, ctx.currentTime)
    }

    apply(params)

    return {
      input,
      output,
      apply,
      dispose() {
        input.disconnect()
        dry.disconnect()
        pre.disconnect()
        srhold.disconnect()
        crusher.disconnect()
        tone.disconnect()
        cutoff.disconnect()
        level.disconnect()
        wetOut.disconnect()
        output.disconnect()
      },
    }
  },
  Panel: LoFiPanel,
}

register(def)
