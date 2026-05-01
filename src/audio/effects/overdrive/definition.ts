// ABOUTME: Overdrive EffectDefinition — soft-clip drive with tone, level, and dry/wet mix.
// ABOUTME: Built as a parallel dry/wet graph to preserve bypass identity at mix=0.

import { register } from '../_internal'
import { makeSoftClipCurve, outputTrimFromDrive } from '../_shared/waveshaper'
import type { EffectDefinition, EffectNode } from '../types'
import { OverdrivePanel } from './panel'

type P = { drive: number; tone: number; level: number; mix: number }

const def: EffectDefinition<'overdrive'> = {
  kind: 'overdrive',
  displayName: 'Overdrive',
  defaultParams: { drive: 0.35, tone: 0.5, level: 0.8, mix: 0 },
  isNeutral: (p) => p.mix < 0.05,
  build(ctx, params): EffectNode<P> {
    const input = ctx.createGain()
    const output = ctx.createGain()

    const dry = ctx.createGain()
    const wet = ctx.createGain()

    const pre = ctx.createGain()
    const shaper = ctx.createWaveShaper()
    const tone = ctx.createBiquadFilter()
    const level = ctx.createGain()

    input.connect(dry)
    input.connect(pre)
    pre.connect(shaper)
    shaper.connect(tone)
    tone.connect(level)
    level.connect(wet)

    dry.connect(output)
    wet.connect(output)

    shaper.oversample = '2x'
    tone.type = 'lowpass'

    const applyNow = (p: P) => {
      const drive = Math.max(0, Math.min(1, p.drive))
      const toneNorm = Math.max(0, Math.min(1, p.tone))
      const levelNorm = Math.max(0, Math.min(1.5, p.level))
      const mix = Math.max(0, Math.min(1, p.mix))

      pre.gain.value = 1 + drive * 8
      shaper.curve = makeSoftClipCurve(0.6 + drive * 1.4)
      tone.frequency.value = 400 + toneNorm * 7600
      level.gain.value = levelNorm * outputTrimFromDrive(drive)
      dry.gain.value = 1 - mix
      wet.gain.value = mix
    }

    const applySmooth = (p: P) => {
      const drive = Math.max(0, Math.min(1, p.drive))
      const toneNorm = Math.max(0, Math.min(1, p.tone))
      const levelNorm = Math.max(0, Math.min(1.5, p.level))
      const mix = Math.max(0, Math.min(1, p.mix))

      pre.gain.setTargetAtTime(1 + drive * 8, ctx.currentTime, 0.01)
      shaper.curve = makeSoftClipCurve(0.6 + drive * 1.4)
      tone.frequency.setTargetAtTime(400 + toneNorm * 7600, ctx.currentTime, 0.01)
      level.gain.setTargetAtTime(levelNorm * outputTrimFromDrive(drive), ctx.currentTime, 0.01)
      dry.gain.setTargetAtTime(1 - mix, ctx.currentTime, 0.01)
      wet.gain.setTargetAtTime(mix, ctx.currentTime, 0.01)
    }

    applyNow(params)

    return {
      input,
      output,
      apply(p) {
        applySmooth(p)
      },
      dispose() {
        input.disconnect()
        dry.disconnect()
        pre.disconnect()
        shaper.disconnect()
        tone.disconnect()
        level.disconnect()
        wet.disconnect()
        output.disconnect()
      },
    }
  },
  Panel: OverdrivePanel,
}

register(def)
