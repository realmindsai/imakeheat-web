// ABOUTME: 303 VinylSim worklet — deterministic compression, wow/flutter delay, and vinyl noise/crackle.
// ABOUTME: Shared modulation and noise are applied identically across channels so identical stereo stays identical.

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

interface Vinyl303Params {
  comp?: number
  noise?: number
  wowFlutter?: number
  level?: number
}

class ChannelState {
  readonly delay = new FractionalDelay(24)
  readonly env = new EnvelopeFollower()
}

export class Vinyl303Processor extends AudioWorkletProcessor {
  private readonly sr: number
  private readonly rng = mulberry32(0x3030f11)
  private readonly rumble = new OnePoleLowpass()
  private readonly hissDc = new OnePoleLowpass()
  private readonly channels = new Map<number, ChannelState>()

  private comp = 0
  private noise = 0
  private wowFlutter = 0
  private level = 1
  private wowPhase = 0
  private flutterPhase = 0
  private crackle = 0
  private crackleDecay = 0.88

  constructor(_sr?: number) {
    super()
    this.sr = typeof _sr === 'number' ? _sr : sampleRate
    ;(this as unknown as { port: MessagePort }).port.onmessage = (ev: MessageEvent) => {
      this.applyParams(ev.data as Vinyl303Params)
    }
  }

  private applyParams(params: Vinyl303Params) {
    if (typeof params.comp === 'number') this.comp = clamp01(params.comp / 100)
    if (typeof params.noise === 'number') this.noise = clamp01(params.noise / 100)
    if (typeof params.wowFlutter === 'number') this.wowFlutter = clamp01(params.wowFlutter / 100)
    if (typeof params.level === 'number') this.level = clamp01(params.level / 100)
  }

  private noiseSample(): number {
    if (this.noise <= 0) return 0
    const white = this.rng() * 2 - 1
    const hiss = white - this.hissDc.process(white, 0.01)
    const rumble = this.rumble.process(white, 0.0008)
    if (this.crackle === 0 && this.rng() < 0.00035 * this.noise * this.noise) {
      this.crackle = (this.rng() * 2 - 1) * (0.025 + 0.045 * this.noise)
      this.crackleDecay = 0.72 + this.rng() * 0.18
    }
    const crackle = this.crackle
    this.crackle *= this.crackleDecay
    if (Math.abs(this.crackle) < 1e-5) this.crackle = 0
    return hiss * (0.0052 * this.noise) + rumble * (0.013 * this.noise) + crackle
  }

  private delaySamples(): number {
    if (this.wowFlutter <= 0) return 0
    this.wowPhase += (2 * Math.PI * (0.18 + 0.52 * this.wowFlutter)) / this.sr
    this.flutterPhase += (2 * Math.PI * (4.2 + 3.8 * this.wowFlutter)) / this.sr
    if (this.wowPhase > Math.PI * 2) this.wowPhase -= Math.PI * 2
    if (this.flutterPhase > Math.PI * 2) this.flutterPhase -= Math.PI * 2
    const lfo = 0.5 + 0.5 * (Math.sin(this.wowPhase) + 0.35 * Math.sin(this.flutterPhase))
    return this.wowFlutter * (3 + 15 * lfo)
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true

    for (let c = 0; c < input.length; c++) {
      if (!this.channels.has(c)) this.channels.set(c, new ChannelState())
    }

    for (let i = 0; i < input[0].length; i++) {
      const delaySamples = this.delaySamples()
      const sharedNoise = this.noiseSample()

      for (let c = 0; c < input.length; c++) {
        const inCh = input[c]
        const outCh = output[c]
        if (!outCh) continue
        const st = this.channels.get(c)!
        let x = inCh[i]

        if (this.comp > 0) {
          const env = st.env.process(Math.abs(x), 0.18, 0.01)
          const threshold = 0.78 - 0.58 * this.comp
          const ratio = 1 + this.comp * 11
          let gain = 1
          if (env > threshold) {
            const target = threshold + (env - threshold) / ratio
            gain = target / Math.max(env, 1e-6)
          }
          x *= gain * (1 + 1.4 * this.comp)
          x = softClip(x, 1 + 1.2 * this.comp)
        }

        if (delaySamples > 0) x = st.delay.process(x, delaySamples)
        x = (x + sharedNoise) * this.level
        outCh[i] = this.level <= 0 ? 0 : x
      }
    }

    return true
  }
}

registerProcessor('vinyl303', Vinyl303Processor)
