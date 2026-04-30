// ABOUTME: 404 VinylSim worklet — deterministic playback-response darkening, cleaner surface noise, and subtler wow/flutter.
// ABOUTME: Shared modulation/noise are applied identically across channels so identical stereo stays identical.

import './processor-shim'
import { clamp01, mulberry32, FractionalDelay, OnePoleLowpass } from './vintage-core'

declare const sampleRate: number

interface Vinyl404Params {
  frequency?: number
  noise?: number
  wowFlutter?: number
}

class ChannelState {
  readonly delay = new FractionalDelay(10)
  readonly tone = new OnePoleLowpass()
}

export class Vinyl404Processor extends AudioWorkletProcessor {
  private readonly sr: number
  private readonly rng = mulberry32(0x4040f11)
  private readonly hissDc = new OnePoleLowpass()
  private readonly rumble = new OnePoleLowpass()
  private readonly channels = new Map<number, ChannelState>()

  private frequency = 1
  private noise = 0
  private wowFlutter = 0
  private wowPhase = 0
  private flutterPhase = 0

  constructor(_sr?: number) {
    super()
    this.sr = typeof _sr === 'number' ? _sr : sampleRate
    ;(this as unknown as { port: MessagePort }).port.onmessage = (ev: MessageEvent) => {
      this.applyParams(ev.data as Vinyl404Params)
    }
  }

  private applyParams(params: Vinyl404Params) {
    if (typeof params.frequency === 'number') this.frequency = clamp01(params.frequency / 100)
    if (typeof params.noise === 'number') this.noise = clamp01(params.noise / 100)
    if (typeof params.wowFlutter === 'number') this.wowFlutter = clamp01(params.wowFlutter / 100)
  }

  private noiseSample(): number {
    if (this.noise <= 0) return 0
    const white = this.rng() * 2 - 1
    const hiss = white - this.hissDc.process(white, 0.02)
    const rumble = this.rumble.process(white, 0.0012)
    return hiss * (0.0044 * this.noise) + rumble * (0.0022 * this.noise)
  }

  private delaySamples(): number {
    if (this.wowFlutter <= 0) return 0
    this.wowPhase += (2 * Math.PI * (0.12 + 0.28 * this.wowFlutter)) / this.sr
    this.flutterPhase += (2 * Math.PI * (3.1 + 1.9 * this.wowFlutter)) / this.sr
    if (this.wowPhase > Math.PI * 2) this.wowPhase -= Math.PI * 2
    if (this.flutterPhase > Math.PI * 2) this.flutterPhase -= Math.PI * 2
    const lfo = 0.5 + 0.5 * (Math.sin(this.wowPhase) + 0.2 * Math.sin(this.flutterPhase))
    return this.wowFlutter * (0.6 + 4.4 * lfo)
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
      const toneMix = 1 - this.frequency
      const toneAlpha = 0.035 + 0.265 * this.frequency

      for (let c = 0; c < input.length; c++) {
        const inCh = input[c]
        const outCh = output[c]
        if (!outCh) continue
        const st = this.channels.get(c)!

        let x = inCh[i]
        if (delaySamples > 0) x = st.delay.process(x, delaySamples)
        if (toneMix > 0) {
          const filtered = st.tone.process(x, toneAlpha)
          x = x * (1 - toneMix) + filtered * toneMix
        }

        outCh[i] = x + sharedNoise
      }
    }

    return true
  }
}

registerProcessor('vinyl404', Vinyl404Processor)
