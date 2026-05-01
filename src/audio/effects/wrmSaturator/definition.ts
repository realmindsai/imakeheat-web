// ABOUTME: WrmSaturator EffectDefinition — asymmetric saturation with bias and tone shaping.
// ABOUTME: Uses dry/wet parallel graph with level trim for predictable output control.

import { register } from '../_internal'
import { outputTrimFromDrive } from '../_shared/waveshaper'
import type { EffectDefinition, EffectNode } from '../types'
import { WrmSaturatorPanel } from './panel'

type P = { amount: number; bias: number; tone: number; mix: number; level: number }

function makeAsymCurve(amount: number, bias: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2048) as Float32Array<ArrayBuffer>
  const k = 1 + amount * 6
  const b = bias * 0.6
  const normPos = Math.tanh(k * (1 + b))
  const normNeg = Math.tanh(k * (1 - b))

  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    if (x >= 0) {
      curve[i] = Math.tanh(k * (x + b * 0.5)) / normPos
    } else {
      curve[i] = Math.tanh(k * (x - b * 0.5)) / normNeg
    }
  }

  return curve
}

const def: EffectDefinition<'wrmSaturator'> = {
  kind: 'wrmSaturator',
  displayName: 'WrmSaturator',
  defaultParams: { amount: 0.4, bias: 0, tone: 0.5, mix: 0, level: 0.8 },
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
    tone.type = 'peaking'
    tone.frequency.value = 1200

    const applyNow = (p: P) => {
      const amount = Math.max(0, Math.min(1, p.amount))
      const bias = Math.max(-1, Math.min(1, p.bias))
      const toneNorm = Math.max(0, Math.min(1, p.tone))
      const mix = Math.max(0, Math.min(1, p.mix))
      const levelNorm = Math.max(0, Math.min(1.5, p.level))

      pre.gain.value = 1 + amount * 6
      shaper.curve = makeAsymCurve(amount, bias)
      tone.Q.value = 0.4 + toneNorm * 3
      tone.gain.value = -6 + toneNorm * 12
      level.gain.value = levelNorm * outputTrimFromDrive(amount)
      dry.gain.value = 1 - mix
      wet.gain.value = mix
    }

    const applySmooth = (p: P) => {
      const amount = Math.max(0, Math.min(1, p.amount))
      const bias = Math.max(-1, Math.min(1, p.bias))
      const toneNorm = Math.max(0, Math.min(1, p.tone))
      const mix = Math.max(0, Math.min(1, p.mix))
      const levelNorm = Math.max(0, Math.min(1.5, p.level))

      pre.gain.setTargetAtTime(1 + amount * 6, ctx.currentTime, 0.01)
      shaper.curve = makeAsymCurve(amount, bias)
      tone.Q.setTargetAtTime(0.4 + toneNorm * 3, ctx.currentTime, 0.01)
      tone.gain.setTargetAtTime(-6 + toneNorm * 12, ctx.currentTime, 0.01)
      level.gain.setTargetAtTime(levelNorm * outputTrimFromDrive(amount), ctx.currentTime, 0.01)
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
  Panel: WrmSaturatorPanel,
}

register(def)
