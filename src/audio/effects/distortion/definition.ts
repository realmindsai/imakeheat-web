// ABOUTME: Distortion EffectDefinition — harder clipping curve than Overdrive.
// ABOUTME: Uses parallel dry/wet routing to preserve exact bypass at mix=0.

import { register } from '../_internal'
import { makeSoftClipCurve, outputTrimFromDrive } from '../_shared/waveshaper'
import type { EffectDefinition, EffectNode } from '../types'
import { DistortionPanel } from './panel'

type P = { drive: number; tone: number; level: number; mix: number }

const def: EffectDefinition<'distortion'> = {
  kind: 'distortion',
  displayName: 'Distortion',
  defaultParams: { drive: 0.5, tone: 0.55, level: 0.75, mix: 0 },
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

    shaper.oversample = '4x'
    tone.type = 'highshelf'

    const applyNow = (p: P) => {
      const drive = Math.max(0, Math.min(1, p.drive))
      const toneNorm = Math.max(0, Math.min(1, p.tone))
      const levelNorm = Math.max(0, Math.min(1.5, p.level))
      const mix = Math.max(0, Math.min(1, p.mix))

      pre.gain.value = 1 + drive * 20
      shaper.curve = makeSoftClipCurve(2 + drive * 4)
      tone.frequency.value = 1800
      tone.gain.value = -12 + toneNorm * 24
      level.gain.value = levelNorm * outputTrimFromDrive(drive * 1.6)
      dry.gain.value = 1 - mix
      wet.gain.value = mix
    }

    const applySmooth = (p: P) => {
      const drive = Math.max(0, Math.min(1, p.drive))
      const toneNorm = Math.max(0, Math.min(1, p.tone))
      const levelNorm = Math.max(0, Math.min(1.5, p.level))
      const mix = Math.max(0, Math.min(1, p.mix))

      pre.gain.setTargetAtTime(1 + drive * 20, ctx.currentTime, 0.01)
      shaper.curve = makeSoftClipCurve(2 + drive * 4)
      tone.gain.setTargetAtTime(-12 + toneNorm * 24, ctx.currentTime, 0.01)
      level.gain.setTargetAtTime(levelNorm * outputTrimFromDrive(drive * 1.6), ctx.currentTime, 0.01)
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
  Panel: DistortionPanel,
}

register(def)
