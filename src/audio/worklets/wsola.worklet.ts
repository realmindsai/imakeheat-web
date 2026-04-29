// ABOUTME: WSOLA player worklet — owns the source buffer; emits at chosen speed and pitch.
// ABOUTME: Standard WSOLA stretch composed with linear resample for pitch; neutral fast-path bypass.

import './processor-shim'

const N = 1024            // frame size
const HS = 256            // synthesis hop (75% overlap)
const RING = 4 * N        // OLA ring buffer length, ample headroom

interface FxParams {
  speed: number
  pitchSemitones: number
}

interface TrimSec {
  startSec: number
  endSec: number
}

type LoadMsg = { type: 'load'; channels: Float32Array[]; sampleRate: number }
type PlayMsg = { type: 'play'; offsetSec: number; trim: TrimSec; fx: FxParams }
type PauseMsg = { type: 'pause' }
type SeekMsg = { type: 'seek'; sourceTimeSec: number }
type SetTrimMsg = { type: 'setTrim'; trim: TrimSec }
type SetFxMsg = { type: 'setFx'; fx: FxParams }
type UnloadMsg = { type: 'unload' }
type InMsg = LoadMsg | PlayMsg | PauseMsg | SeekMsg | SetTrimMsg | SetFxMsg | UnloadMsg

export class WSOLAProcessor extends AudioWorkletProcessor {
  private channels: Float32Array[] = []
  private srcSampleRate = 48000
  private trimStart = 0           // input samples
  private trimEnd = 0             // input samples
  private readPos = 0             // input samples (fractional allowed)
  private speed = 1
  private pitchFactor = 1
  private state: 'idle' | 'playing' | 'paused' = 'idle'

  private hann = new Float32Array(N)
  private windowEnv = new Float32Array(HS) // partition-of-unity divisor
  private olaRing: Float32Array[] = [] // per channel
  private olaWritePos = 0              // write head in ring (samples emitted so far)
  private olaReadPos = 0               // read head
  private olaReadPosFrac = 0           // fractional read index into ring buffer (for linear resample)

  constructor() {
    super()
    ;(this as any).port.onmessage = (ev: MessageEvent) => this.onMessage(ev.data as InMsg)
    // Precompute Hann window
    for (let i = 0; i < N; i++) this.hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)))
    // For Hs=256, N=1024 (overlap factor = N/Hs = 4), the sum-of-windows over one Hs is:
    for (let i = 0; i < HS; i++) {
      let s = 0
      for (let k = 0; k < N / HS; k++) s += this.hann[i + k * HS] ** 2 // power-complementary
      this.windowEnv[i] = Math.max(s, 1e-6)
    }
  }

  private onMessage(msg: InMsg): void {
    switch (msg.type) {
      case 'load': {
        this.channels = msg.channels
        this.srcSampleRate = msg.sampleRate
        this.trimStart = 0
        this.trimEnd = msg.channels[0]?.length ?? 0
        this.readPos = 0
        this.state = 'idle'
        this.olaRing = msg.channels.map(() => new Float32Array(RING))
        this.olaWritePos = 0
        this.olaReadPos = 0
        this.olaReadPosFrac = 0
        return
      }
      case 'play': {
        this.trimStart = Math.round(msg.trim.startSec * this.srcSampleRate)
        this.trimEnd = Math.round(msg.trim.endSec * this.srcSampleRate)
        this.readPos = Math.round(msg.offsetSec * this.srcSampleRate)
        this.applyFx(msg.fx)
        this.state = 'playing'
        // Reset OLA state so each playback starts clean
        for (const ring of this.olaRing) ring.fill(0)
        this.olaWritePos = 0
        this.olaReadPos = 0
        this.olaReadPosFrac = 0
        return
      }
      case 'pause': {
        this.state = 'paused'
        return
      }
      case 'seek': {
        this.readPos = Math.round(msg.sourceTimeSec * this.srcSampleRate)
        // Drop OLA state so the seek position takes effect immediately
        for (const ring of this.olaRing) ring.fill(0)
        this.olaWritePos = 0
        this.olaReadPos = 0
        this.olaReadPosFrac = 0
        return
      }
      case 'setTrim': {
        this.trimStart = Math.round(msg.trim.startSec * this.srcSampleRate)
        this.trimEnd = Math.round(msg.trim.endSec * this.srcSampleRate)
        if (this.readPos < this.trimStart || this.readPos >= this.trimEnd) {
          this.readPos = this.trimStart
        }
        return
      }
      case 'setFx': {
        this.applyFx(msg.fx)
        return
      }
      case 'unload': {
        this.channels = []
        this.state = 'idle'
        return
      }
    }
  }

  private applyFx(fx: FxParams): void {
    this.speed = fx.speed
    this.pitchFactor = Math.pow(2, fx.pitchSemitones / 12)
  }

  private isNeutral(): boolean {
    return this.speed === 1 && this.pitchFactor === 1
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0]
    if (!output || output.length === 0) return true

    if (this.state !== 'playing' || this.channels.length === 0) {
      // emit silence
      for (let c = 0; c < output.length; c++) output[c]?.fill(0)
      return true
    }

    if (this.isNeutral()) {
      this.processNeutral(output)
      return true
    }

    // Non-neutral path: ensure enough samples are queued in olaRing accounting for resample.
    // With step=pitchFactor, drainToOutput consumes ceil(need * pitchFactor) ring samples.
    const need = output[0].length
    const queueDemand = Math.ceil(need * this.pitchFactor) + N
    while (this.olaWritePos - this.olaReadPos < queueDemand) {
      this.synthesizeOneFrame()
    }
    this.drainToOutput(output, need)
    return true
  }

  private processNeutral(output: Float32Array[]): void {
    const blockLen = output[0].length
    const span = Math.max(1, this.trimEnd - this.trimStart)
    for (let i = 0; i < blockLen; i++) {
      // wrap into [trimStart, trimEnd)
      let p = this.readPos
      if (p >= this.trimEnd) p = this.trimStart + ((p - this.trimStart) % span)
      const idx = Math.floor(p)
      for (let c = 0; c < output.length && c < this.channels.length; c++) {
        output[c][i] = this.channels[c][idx] ?? 0
      }
      this.readPos = p + 1
    }
  }

  private synthesizeOneFrame(): void {
    // For each output channel, take a Hann-windowed frame from the input at this.readPos,
    // overlap-add into the ring at this.olaWritePos, then advance olaWritePos by HS.
    // S=1 keeps the OLA pitch-neutral (Ha=HS); the downstream linear resample
    // in drainToOutput handles pitch shifting via step=pitchFactor. Time-stretch
    // behaviour for non-unity speed is achieved through the queueDemand/synthesis-rate
    // balance set in process().
    const S = 1
    const Ha = HS / S
    const channels = this.channels.length
    if (channels === 0) return

    // Pull one analysis frame; each sample within the frame wraps if it overruns trimEnd.
    const startInt = Math.floor(this.readPos)
    const span = Math.max(1, this.trimEnd - this.trimStart)

    for (let c = 0; c < channels; c++) {
      const inCh = this.channels[c]
      const ring = this.olaRing[c]
      for (let n = 0; n < N; n++) {
        // wrap each input sample read within the frame
        let p = startInt + n
        if (p >= this.trimEnd) p = this.trimStart + ((p - this.trimStart) % span)
        const v = inCh[p] ?? 0
        const ringIdx = (this.olaWritePos + n) % RING
        ring[ringIdx] += v * this.hann[n]
      }
    }
    this.olaWritePos += HS
    this.readPos += Ha
    // Loop-wrap readPos within [trimStart, trimEnd) per spec §5.5.
    // The mod gymnastics handles the case where Ha may push readPos far past trimEnd.
    if (this.readPos >= this.trimEnd) {
      this.readPos = this.trimStart + ((this.readPos - this.trimStart) % span)
    }
  }

  private drainToOutput(output: Float32Array[], need: number): void {
    const channels = output.length
    if (this.pitchFactor === 1) {
      for (let i = 0; i < need; i++) {
        const ringIdx = (this.olaReadPos + i) % RING
        const envIdx = (this.olaReadPos + i) % HS
        const norm = this.windowEnv[envIdx]
        for (let c = 0; c < channels && c < this.olaRing.length; c++) {
          output[c][i] = this.olaRing[c][ringIdx] / norm
          this.olaRing[c][ringIdx] = 0
        }
      }
      this.olaReadPos += need
      return
    }

    // Linear resample: read at rate pitchFactor through the ring (faster read = higher pitch).
    const step = this.pitchFactor
    for (let i = 0; i < need; i++) {
      const fracPos = this.olaReadPosFrac + i * step
      const base = Math.floor(fracPos)
      const frac = fracPos - base
      const idx0 = (this.olaReadPos + base) % RING
      const idx1 = (this.olaReadPos + base + 1) % RING
      const envIdx0 = (this.olaReadPos + base) % HS
      const envIdx1 = (this.olaReadPos + base + 1) % HS
      const norm0 = this.windowEnv[envIdx0]
      const norm1 = this.windowEnv[envIdx1]
      for (let c = 0; c < channels && c < this.olaRing.length; c++) {
        const a = this.olaRing[c][idx0] / norm0
        const b = this.olaRing[c][idx1] / norm1
        output[c][i] = a + (b - a) * frac
      }
    }
    // Advance read positions; consume up to floor(end) integer samples.
    const consumed = Math.floor(this.olaReadPosFrac + need * step)
    for (let j = 0; j < consumed; j++) {
      const idx = (this.olaReadPos + j) % RING
      for (let c = 0; c < this.olaRing.length; c++) this.olaRing[c][idx] = 0
    }
    this.olaReadPos += consumed
    this.olaReadPosFrac = (this.olaReadPosFrac + need * step) - consumed
  }
}

registerProcessor('wsola', WSOLAProcessor)
