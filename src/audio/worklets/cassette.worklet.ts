// ABOUTME: Cassette Sim worklet — tilt EQ, tape-style drive, worn-media darkening, stronger wow/flutter, catch events, and hiss.
// ABOUTME: Shared modulation/noise are applied identically across channels so identical stereo stays identical and offline renders stay deterministic.

import './processor-shim'
import {
  clamp01,
  mulberry32,
  softClip,
  EnvelopeFollower,
  FractionalDelay,
  OnePoleLowpass,
} from './vintage-core'

declare const sampleRate: number

interface CassetteParams {
  tone?: number
  hiss?: number
  ageYears?: number
  drive?: number
  wowFlutter?: number
  catch?: number
}

class ChannelState {
  readonly tone = new OnePoleLowpass()
  readonly wear = new OnePoleLowpass()
  readonly soften = new OnePoleLowpass()
  readonly env = new EnvelopeFollower()
  readonly delay = new FractionalDelay(96)
}

export class CassetteProcessor extends AudioWorkletProcessor {
  private readonly sr: number
  private readonly rng = mulberry32(0xca55e77e)
  private readonly hissDc = new OnePoleLowpass()
  private readonly rumble = new OnePoleLowpass()
  private readonly channels = new Map<number, ChannelState>()

  private toneTilt = 0
  private hiss = 0
  private age = 0
  private drive = 0
  private wowFlutter = 0
  private catchAmount = 0

  private wowPhase = 0
  private flutterPhase = 0
  private ageJitterPhase = 0

  private catchRemaining = 0
  private catchTotal = 0
  private catchDelayPeak = 0
  private catchDentPeak = 0

  private dropoutRemaining = 0
  private dropoutTotal = 0
  private dropoutDepth = 0

  constructor(_sr?: number) {
    super()
    this.sr = typeof _sr === 'number' ? _sr : sampleRate
    ;(this as unknown as { port: MessagePort }).port.onmessage = (ev: MessageEvent) => {
      this.applyParams(ev.data as CassetteParams)
    }
  }

  private applyParams(params: CassetteParams) {
    if (typeof params.tone === 'number') this.toneTilt = clamp01(params.tone / 100) * 2 - 1
    if (typeof params.hiss === 'number') this.hiss = clamp01(params.hiss / 100)
    if (typeof params.ageYears === 'number') this.age = clamp01(params.ageYears / 60)
    if (typeof params.drive === 'number') this.drive = clamp01(params.drive / 100)
    if (typeof params.wowFlutter === 'number') this.wowFlutter = clamp01(params.wowFlutter / 100)
    if (typeof params.catch === 'number') this.catchAmount = clamp01(params.catch / 100)
  }

  private hissSample(): number {
    if (this.hiss <= 0 && this.age <= 0) return 0
    const white = this.rng() * 2 - 1
    const hiss = white - this.hissDc.process(white, 0.025)
    const rumble = this.rumble.process(white, 0.0012)
    const hissAmt = this.hiss + this.age * 0.18
    return hiss * (0.0046 * hissAmt) + rumble * (0.0014 * hissAmt)
  }

  private maybeStartCatch() {
    if (this.catchAmount <= 0 || this.catchRemaining > 0) return
    const probability = 0.000006 + 0.00006 * this.catchAmount * this.catchAmount
    if (this.rng() >= probability) return
    const durationMs = 18 + this.rng() * 42 + this.catchAmount * 18
    this.catchTotal = Math.max(1, Math.round((durationMs / 1000) * this.sr))
    this.catchRemaining = this.catchTotal
    this.catchDelayPeak = 8 + (22 + 26 * this.rng()) * this.catchAmount
    this.catchDentPeak = 0.18 + (0.28 + 0.24 * this.rng()) * this.catchAmount
  }

  private maybeStartDropout() {
    if (this.age <= 0 || this.dropoutRemaining > 0) return
    const probability = 0.000003 + 0.00002 * this.age * this.age
    if (this.rng() >= probability) return
    const durationMs = 10 + this.rng() * 24 + this.age * 18
    this.dropoutTotal = Math.max(1, Math.round((durationMs / 1000) * this.sr))
    this.dropoutRemaining = this.dropoutTotal
    this.dropoutDepth = 0.08 + this.age * (0.14 + 0.18 * this.rng())
  }

  private catchShape(): { delayBoost: number; dent: number } {
    this.maybeStartCatch()
    if (this.catchRemaining <= 0 || this.catchTotal <= 0) return { delayBoost: 0, dent: 0 }
    const progress = 1 - this.catchRemaining / this.catchTotal
    const shape = Math.sin(progress * Math.PI)
    this.catchRemaining--
    if (this.catchRemaining <= 0) {
      this.catchTotal = 0
      this.catchDelayPeak = 0
      this.catchDentPeak = 0
    }
    return {
      delayBoost: this.catchDelayPeak * shape,
      dent: this.catchDentPeak * shape,
    }
  }

  private dropoutGain(): number {
    this.maybeStartDropout()
    if (this.dropoutRemaining <= 0 || this.dropoutTotal <= 0) return 1
    const progress = 1 - this.dropoutRemaining / this.dropoutTotal
    const shape = Math.sin(progress * Math.PI)
    this.dropoutRemaining--
    if (this.dropoutRemaining <= 0) {
      this.dropoutTotal = 0
      this.dropoutDepth = 0
    }
    return 1 - this.dropoutDepth * shape
  }

  private delaySamples(extraDelay: number): number {
    const modulation = clamp01(this.wowFlutter + this.age * 0.22)
    if (modulation <= 0 && extraDelay <= 0) return 0
    this.wowPhase += (2 * Math.PI * (0.18 + 0.68 * modulation)) / this.sr
    this.flutterPhase += (2 * Math.PI * (4.6 + 7.8 * modulation)) / this.sr
    this.ageJitterPhase += (2 * Math.PI * (0.09 + 0.18 * this.age)) / this.sr
    if (this.wowPhase > Math.PI * 2) this.wowPhase -= Math.PI * 2
    if (this.flutterPhase > Math.PI * 2) this.flutterPhase -= Math.PI * 2
    if (this.ageJitterPhase > Math.PI * 2) this.ageJitterPhase -= Math.PI * 2
    const lfo = 0.5 + 0.5 * (
      Math.sin(this.wowPhase)
      + 0.45 * Math.sin(this.flutterPhase)
      + 0.22 * Math.sin(this.ageJitterPhase)
    )
    return modulation * (2 + 26 * lfo) + extraDelay
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true

    for (let c = 0; c < input.length; c++) {
      if (!this.channels.has(c)) this.channels.set(c, new ChannelState())
    }

    for (let i = 0; i < input[0].length; i++) {
      const catchState = this.catchShape()
      const delaySamples = this.delaySamples(catchState.delayBoost)
      const hiss = this.hissSample()
      const dropoutGain = this.dropoutGain()

      for (let c = 0; c < input.length; c++) {
        const inCh = input[c]
        const outCh = output[c]
        if (!outCh) continue
        const st = this.channels.get(c)!

        let x = inCh[i]

        if (this.toneTilt !== 0) {
          const low = st.tone.process(x, 0.06 + 0.16 * (1 - Math.abs(this.toneTilt) * 0.35))
          const high = x - low
          x = this.toneTilt < 0
            ? low + high * (1 + 0.95 * this.toneTilt)
            : low + high * (1 + 0.7 * this.toneTilt)
        }

        if (this.drive > 0) {
          const env = st.env.process(Math.abs(x), 0.18, 0.012)
          const threshold = 0.84 - 0.46 * this.drive
          const ratio = 1 + 8 * this.drive
          let gain = 1
          if (env > threshold) {
            const target = threshold + (env - threshold) / ratio
            gain = target / Math.max(env, 1e-6)
          }
          x *= gain * (1 + 1.25 * this.drive)
          x = softClip(x, 1 + 2.8 * this.drive)
        }

        if (this.age > 0) {
          const worn = st.wear.process(x, 0.18 - 0.145 * this.age)
          x = x * (1 - 0.58 * this.age) + worn * (0.58 * this.age)
          const softened = st.soften.process(x, 0.22)
          x = x * (1 - 0.22 * this.age) + softened * (0.22 * this.age)
          x *= dropoutGain
        }

        if (delaySamples > 0) x = st.delay.process(x, delaySamples)
        if (catchState.dent > 0) x *= 1 - catchState.dent

        outCh[i] = x + hiss
      }
    }

    return true
  }
}

registerProcessor('cassette', CassetteProcessor)
