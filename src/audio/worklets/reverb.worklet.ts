// ABOUTME: Reverb worklet — Schroeder/Freeverb-lite (8 damped combs → 4 series allpasses).
// ABOUTME: Direct port of ReverbEffect.kt; per-channel state buffers; size/decay/mix params.

import './processor-shim'

declare const sampleRate: number

const COMB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
const ALLPASS = [556, 441, 341, 225]
const ALLPASS_FB = 0.5
const DAMP = 0.5
const FEEDBACK_MIN = 0.5
const FEEDBACK_RANGE = 0.45
const SIZE_MIN = 0.5
const SIZE_RANGE = 0.5

class Comb {
  readonly buffer: Float32Array
  readonly bufferLen: number
  writeIdx = 0
  delaySamples: number
  feedback = 0.7
  lastFiltered = 0
  constructor(bufferLen: number) {
    this.bufferLen = bufferLen
    this.buffer = new Float32Array(bufferLen)
    this.delaySamples = bufferLen
  }
  process(input: number): number {
    const r = ((this.writeIdx - this.delaySamples) % this.bufferLen + this.bufferLen) % this.bufferLen
    const out = this.buffer[r]
    this.lastFiltered = out * (1 - DAMP) + this.lastFiltered * DAMP
    this.buffer[this.writeIdx] = input + this.lastFiltered * this.feedback
    this.writeIdx = (this.writeIdx + 1) % this.bufferLen
    return out
  }
}

class Allpass {
  readonly buffer: Float32Array
  readonly bufferLen: number
  writeIdx = 0
  delaySamples: number
  constructor(bufferLen: number) {
    this.bufferLen = bufferLen
    this.buffer = new Float32Array(bufferLen)
    this.delaySamples = bufferLen
  }
  process(input: number): number {
    const r = ((this.writeIdx - this.delaySamples) % this.bufferLen + this.bufferLen) % this.bufferLen
    const buf = this.buffer[r]
    const out = -input + buf
    this.buffer[this.writeIdx] = input + buf * ALLPASS_FB
    this.writeIdx = (this.writeIdx + 1) % this.bufferLen
    return out
  }
}

class ChannelState {
  combs: Comb[]
  allpasses: Allpass[]
  constructor(sr: number) {
    const scale = sr / 44100
    this.combs = COMB.map((d) => new Comb(Math.max(1, Math.round(d * scale))))
    this.allpasses = ALLPASS.map((d) => new Allpass(Math.max(1, Math.round(d * scale))))
  }
  applySize(s: number) {
    const v = SIZE_MIN + SIZE_RANGE * Math.max(0, Math.min(1, s))
    for (const c of this.combs) c.delaySamples = Math.max(1, Math.floor(c.bufferLen * v))
  }
  applyDecay(d: number) {
    const fb = FEEDBACK_MIN + FEEDBACK_RANGE * Math.max(0, Math.min(1, d))
    for (const c of this.combs) c.feedback = fb
  }
}

export class ReverbProcessor extends AudioWorkletProcessor {
  private mix = 0
  private size = 0.5
  private decay = 0.5
  private channels: Map<number, ChannelState> = new Map()
  private sr: number

  constructor(_sr?: number) {
    super()
    this.sr = _sr ?? sampleRate
    ;(this as unknown as { port: MessagePort }).port.onmessage = (ev: MessageEvent) => {
      const d = ev.data as { size?: number; decay?: number; mix?: number }
      if (typeof d.size === 'number') {
        this.size = Math.max(0, Math.min(1, d.size))
        for (const ch of this.channels.values()) ch.applySize(this.size)
      }
      if (typeof d.decay === 'number') {
        this.decay = Math.max(0, Math.min(1, d.decay))
        for (const ch of this.channels.values()) ch.applyDecay(this.decay)
      }
      if (typeof d.mix === 'number') this.mix = Math.max(0, Math.min(1, d.mix))
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0], output = outputs[0]
    if (!input || input.length === 0) return true
    const dry = 1 - this.mix
    for (let c = 0; c < input.length; c++) {
      let st = this.channels.get(c)
      if (!st) {
        st = new ChannelState(this.sr); st.applySize(this.size); st.applyDecay(this.decay)
        this.channels.set(c, st)
      }
      const inCh = input[c], outCh = output[c]
      if (!outCh) continue
      for (let i = 0; i < inCh.length; i++) {
        const x = inCh[i]
        let wet = 0
        for (const cb of st.combs) wet += cb.process(x)
        for (const ap of st.allpasses) wet = ap.process(wet)
        outCh[i] = x * dry + (wet / st.combs.length) * this.mix
      }
    }
    return true
  }
}
registerProcessor('reverb', ReverbProcessor)
