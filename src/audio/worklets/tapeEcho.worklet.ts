// ABOUTME: TapeEcho worklet — modulated delay with feedback, tone filtering, and wet/dry mix.
// ABOUTME: Keeps deterministic wow/flutter LFO and per-channel state for repeatable tests.

import './processor-shim'

declare const sampleRate: number

const MIN_TIME_MS = 1
const MAX_TIME_MS = 1500
const MAX_FEEDBACK = 0.95

export class TapeEchoProcessor extends AudioWorkletProcessor {
  private bufferSize: number
  private buffers: Map<number, Float32Array> = new Map()
  private writeIdx: Map<number, number> = new Map()
  private wetLP: Map<number, number> = new Map()
  private delaySamples = 1
  private feedback = 0.45
  private mix = 0
  private wowFlutter = 0.15
  private tone = 0.6
  private lfoPhase = 0
  private sr: number

  constructor(_sampleRate?: number) {
    super()
    this.sr = typeof _sampleRate === 'number' ? _sampleRate : sampleRate
    this.bufferSize = Math.floor((this.sr * MAX_TIME_MS) / 1000) + 2
    this.delaySamples = this.clampTime(320)

    ;(this as unknown as { port: MessagePort }).port.onmessage = (ev: MessageEvent) => {
      const d = ev.data as { timeMs?: number; feedback?: number; mix?: number; wowFlutter?: number; tone?: number }
      if (typeof d.timeMs === 'number') this.delaySamples = this.clampTime(d.timeMs)
      if (typeof d.feedback === 'number') this.feedback = Math.max(0, Math.min(MAX_FEEDBACK, d.feedback))
      if (typeof d.mix === 'number') this.mix = Math.max(0, Math.min(1, d.mix))
      if (typeof d.wowFlutter === 'number') this.wowFlutter = Math.max(0, Math.min(1, d.wowFlutter))
      if (typeof d.tone === 'number') this.tone = Math.max(0, Math.min(1, d.tone))
    }
  }

  private clampTime(timeMs: number): number {
    const c = Math.max(MIN_TIME_MS, Math.min(MAX_TIME_MS, timeMs))
    return Math.max(1, Math.floor((this.sr * c) / 1000))
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0) return true

    const mix = this.mix
    const dry = 1 - mix
    const fb = this.feedback
    const N = this.bufferSize
    const toneA = Math.max(0.001, this.tone)

    for (let c = 0; c < input.length; c++) {
      let buf = this.buffers.get(c)
      if (!buf) {
        buf = new Float32Array(N)
        this.buffers.set(c, buf)
        this.writeIdx.set(c, 0)
        this.wetLP.set(c, 0)
      }

      let w = this.writeIdx.get(c)!
      let lp = this.wetLP.get(c)!
      const inCh = input[c]
      const outCh = output[c]
      if (!outCh) continue

      for (let i = 0; i < inCh.length; i++) {
        const wowLfo = Math.sin(this.lfoPhase)
        const depth = Math.floor((this.wowFlutter * 0.06) * this.delaySamples)
        const d = Math.max(1, this.delaySamples + Math.floor(wowLfo * depth))
        const r = (((w - d) % N) + N) % N

        const delayed = buf[r]
        lp += (delayed - lp) * toneA

        const x = inCh[i]
        buf[w] = x + lp * fb
        outCh[i] = x * dry + lp * mix

        w = (w + 1) % N
        this.lfoPhase += (2 * Math.PI * (0.2 + this.wowFlutter * 4.8)) / this.sr
        if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI
      }

      this.writeIdx.set(c, w)
      this.wetLP.set(c, lp)
    }

    return true
  }
}

registerProcessor('tapeEcho', TapeEchoProcessor)
