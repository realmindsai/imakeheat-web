// ABOUTME: Echo worklet — single-tap circular delay with feedback and dry/wet mix.
// ABOUTME: Direct port of EchoEffect.kt; per-channel state buffers; param ranges hard-clamped.

import './processor-shim'

// `sampleRate` is a real global inside AudioWorkletGlobalScope at runtime.
// TS doesn't know about that scope's globals, so we declare it locally.
declare const sampleRate: number

// MIN_TIME_MS guards against zero-sample delays (which would pass the dry signal
// straight through the feedback path and self-oscillate). The panel enforces a
// 50 ms minimum at the UI; the worklet only enforces "at least 1 sample" so unit
// tests can drive shorter delays against tiny synthetic buffers.
const MIN_TIME_MS = 1
const MAX_TIME_MS = 1000
const MAX_FEEDBACK = 0.95

export class EchoProcessor extends AudioWorkletProcessor {
  private bufferSize: number
  private buffers: Map<number, Float32Array> = new Map()
  private writeIdx: Map<number, number> = new Map()
  private delaySamples = 1
  private feedback = 0.4
  private mix = 0
  private sr: number

  constructor(_sampleRate?: number) {
    super()
    this.sr = _sampleRate ?? sampleRate
    this.bufferSize = Math.floor((this.sr * MAX_TIME_MS) / 1000) + 1
    this.delaySamples = this.clampTime(250)
    ;(this as unknown as { port: MessagePort }).port.onmessage = (ev: MessageEvent) => {
      const d = ev.data as { timeMs?: number; feedback?: number; mix?: number }
      if (typeof d.timeMs === 'number') this.delaySamples = this.clampTime(d.timeMs)
      if (typeof d.feedback === 'number') this.feedback = Math.max(0, Math.min(MAX_FEEDBACK, d.feedback))
      if (typeof d.mix === 'number') this.mix = Math.max(0, Math.min(1, d.mix))
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
    const D = this.delaySamples
    const fb = this.feedback
    const mix = this.mix
    const dry = 1 - mix
    const N = this.bufferSize
    for (let c = 0; c < input.length; c++) {
      let buf = this.buffers.get(c)
      if (!buf) {
        buf = new Float32Array(N)
        this.buffers.set(c, buf)
        this.writeIdx.set(c, 0)
      }
      let w = this.writeIdx.get(c)!
      const inCh = input[c]
      const outCh = output[c]
      if (!outCh) continue
      for (let i = 0; i < inCh.length; i++) {
        const r = (((w - D) % N) + N) % N
        const delayed = buf[r]
        const x = inCh[i]
        buf[w] = x + delayed * fb
        outCh[i] = x * dry + delayed * mix
        w = (w + 1) % N
      }
      this.writeIdx.set(c, w)
    }
    return true
  }
}
registerProcessor('echo', EchoProcessor)
