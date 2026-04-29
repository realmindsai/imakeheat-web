// ABOUTME: WSOLA player worklet — owns the source buffer; emits at chosen speed and pitch.
// ABOUTME: Wraps soundtouchjs for tempo/pitch stretch; neutral fast-path bypass for speed=1 and pitch=0.

import './processor-shim'
import { SoundTouch, SimpleFilter } from 'soundtouchjs'

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
  private pitchSemitones = 0
  private state: 'idle' | 'playing' | 'paused' = 'idle'

  private soundtouch: SoundTouch | null = null
  private filter: SimpleFilter | null = null
  private interleavedBuffer = new Float32Array(0) // reused per process() call

  private blocksSinceReport = 0
  private static readonly REPORT_EVERY_BLOCKS = 8

  constructor() {
    super()
    ;(this as any).port.onmessage = (ev: MessageEvent) => this.onMessage(ev.data as InMsg)
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
        this.initSoundTouch({ speed: 1, pitchSemitones: 0 })
        return
      }
      case 'play': {
        this.trimStart = Math.round(msg.trim.startSec * this.srcSampleRate)
        this.trimEnd = Math.round(msg.trim.endSec * this.srcSampleRate)
        this.readPos = Math.round(msg.offsetSec * this.srcSampleRate)
        this.applyFx(msg.fx)
        this.state = 'playing'
        this.blocksSinceReport = 0
        this.initSoundTouch(msg.fx)
        return
      }
      case 'pause': {
        this.state = 'paused'
        this.blocksSinceReport = 0
        return
      }
      case 'seek': {
        this.readPos = Math.round(msg.sourceTimeSec * this.srcSampleRate)
        // Re-init SoundTouch entirely to flush all internal delay buffers;
        // filter.clear() alone leaves latency artifacts at the splice point.
        if (this.soundtouch) {
          this.initSoundTouch({ speed: this.speed, pitchSemitones: this.pitchSemitones })
        }
        this.blocksSinceReport = 0
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
        if (this.soundtouch) {
          this.soundtouch.tempo = msg.fx.speed
          this.soundtouch.pitchSemitones = msg.fx.pitchSemitones
        }
        return
      }
      case 'unload': {
        this.channels = []
        this.state = 'idle'
        this.soundtouch = null
        this.filter = null
        this.blocksSinceReport = 0
        return
      }
    }
  }

  private applyFx(fx: FxParams): void {
    this.speed = fx.speed
    this.pitchSemitones = fx.pitchSemitones
    this.pitchFactor = Math.pow(2, fx.pitchSemitones / 12)
  }

  private isNeutral(): boolean {
    return this.speed === 1 && this.pitchFactor === 1
  }

  private makeSource() {
    const self = this
    return {
      extract(target: Float32Array, numFrames: number, _sourcePosition: number): number {
        const channels = self.channels
        if (channels.length === 0) {
          target.fill(0)
          return numFrames
        }
        const left = channels[0]
        const right = channels.length > 1 ? channels[1] : channels[0]
        const span = Math.max(1, self.trimEnd - self.trimStart)
        for (let i = 0; i < numFrames; i++) {
          // Wrap readPos into [trimStart, trimEnd)
          let p = self.readPos
          if (p >= self.trimEnd) p = self.trimStart + ((p - self.trimStart) % span)
          if (p < self.trimStart) p = self.trimStart
          const idx = Math.floor(p)
          target[i * 2] = left[idx] ?? 0
          target[i * 2 + 1] = right[idx] ?? 0
          self.readPos = p + 1
        }
        return numFrames
      },
    }
  }

  private initSoundTouch(fx: FxParams): void {
    this.soundtouch = new SoundTouch()
    this.soundtouch.tempo = fx.speed
    this.soundtouch.pitchSemitones = fx.pitchSemitones
    this.filter = new SimpleFilter(this.makeSource(), this.soundtouch)
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
      this.maybeReportPosition()
      return true
    }

    // Non-neutral: extract from SoundTouch pipeline.
    if (!this.filter) {
      for (let c = 0; c < output.length; c++) output[c]?.fill(0)
      return true
    }

    const blockSize = output[0].length
    const need = blockSize * 2 // stereo interleaved
    if (this.interleavedBuffer.length < need) this.interleavedBuffer = new Float32Array(need)
    const framesProduced = this.filter.extract(this.interleavedBuffer, blockSize)

    // De-interleave into output channels. If output is mono, just take L.
    for (let i = 0; i < blockSize; i++) {
      if (i < framesProduced) {
        for (let c = 0; c < output.length && c < 2; c++) {
          output[c][i] = this.interleavedBuffer[i * 2 + c] ?? 0
        }
        if (output.length > 2) {
          for (let c = 2; c < output.length; c++) output[c][i] = 0
        }
      } else {
        for (let c = 0; c < output.length; c++) output[c][i] = 0
      }
    }
    this.maybeReportPosition()
    return true
  }

  private maybeReportPosition(): void {
    this.blocksSinceReport++
    if (this.blocksSinceReport >= WSOLAProcessor.REPORT_EVERY_BLOCKS) {
      this.blocksSinceReport = 0
      ;(this as any).port.postMessage({
        type: 'position',
        readPosSec: this.readPos / this.srcSampleRate,
      })
    }
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
}

registerProcessor('wsola', WSOLAProcessor)
