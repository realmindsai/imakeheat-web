// ABOUTME: AudioEngine singleton — owns the AudioContext, graph, source node state machine.
// ABOUTME: Exposes play/pause/seek/trim/effect/record/render API for UI layers.

import { buildPreviewGraph, type PreviewGraph } from './graph'
import { startRecording, type ActiveRecording } from './recorder'
import type { EffectParams, TrimPoints } from './types'

export class AudioEngine {
  private ctx: AudioContext | null = null
  private graph: PreviewGraph | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private currentBuffer: AudioBuffer | null = null
  private pausedOffsetSec = 0
  private playStartedAt = 0
  private isPlaying = false
  private lastTrim: TrimPoints | null = null
  private lastFx: EffectParams | null = null

  async ensureStarted(): Promise<void> {
    if (this.ctx) return
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    this.graph = await buildPreviewGraph(this.ctx)
  }

  get context(): AudioContext | null {
    return this.ctx
  }

  getAnalyser(): AnalyserNode | null {
    return this.graph?.analyser ?? null
  }

  async loadFromBlob(blob: Blob): Promise<AudioBuffer> {
    await this.ensureStarted()
    const buf = await blob.arrayBuffer()
    const decoded = await this.ctx!.decodeAudioData(buf)
    this.currentBuffer = decoded
    this.currentSource = null
    this.pausedOffsetSec = 0
    this.isPlaying = false
    this.lastTrim = null
    this.lastFx = null
    return decoded
  }

  async play(trim: TrimPoints, fx: EffectParams): Promise<void> {
    if (!this.ctx || !this.graph || !this.currentBuffer) throw new Error('engine not loaded')

    if (this.isPlaying) return
    this.lastTrim = trim
    this.lastFx = fx
    this.graph.applyEffects(fx)

    const src = this.ctx.createBufferSource()
    src.buffer = this.currentBuffer
    this.graph.applyPitch(src, fx.pitchSemitones)
    this.graph.setSource(src)

    src.onended = () => {
      if (src === this.currentSource) {
        this.isPlaying = false
        this.currentSource = null
        this.pausedOffsetSec = 0
      }
    }

    // Loop the trim window indefinitely until pause(). pausedOffsetSec
    // is wall-clock time accumulated across pause/resume; mod by span so
    // resume after long playback lands in-window.
    const span = Math.max(0, trim.endSec - trim.startSec)
    const offsetWithinSpan = span > 0 ? this.pausedOffsetSec % span : 0
    const offset = trim.startSec + offsetWithinSpan
    src.loop = true
    src.loopStart = trim.startSec
    src.loopEnd = trim.endSec
    src.start(0, offset)
    this.currentSource = src
    this.playStartedAt = this.ctx.currentTime
    this.isPlaying = true
  }

  pause(): void {
    if (!this.ctx || !this.currentSource) return
    const elapsedSec = this.ctx.currentTime - this.playStartedAt
    this.pausedOffsetSec += elapsedSec
    this.currentSource.stop()
    this.currentSource = null
    this.isPlaying = false
  }

  async seek(sourceTimeSec: number): Promise<void> {
    if (!this.currentBuffer) return
    const wasPlaying = this.isPlaying
    if (this.currentSource) {
      this.currentSource.stop()
      this.currentSource = null
      this.isPlaying = false
    }
    const trim = this.lastTrim ?? { startSec: 0, endSec: this.currentBuffer.duration }
    const clamped = Math.max(trim.startSec, Math.min(trim.endSec, sourceTimeSec))
    this.pausedOffsetSec = clamped - trim.startSec
    if (wasPlaying && this.lastFx) {
      await this.play(trim, this.lastFx)
    }
  }

  async setTrim(trim: TrimPoints): Promise<void> {
    this.lastTrim = trim
    if (!this.isPlaying || !this.lastFx) return
    const cur = this.getCurrentSourceTimeSec(trim)
    await this.seek(cur)
  }

  setEffect(fx: EffectParams): void {
    this.lastFx = fx
    if (!this.graph) return
    this.graph.applyEffects(fx)
    if (this.currentSource) this.graph.applyPitch(this.currentSource, fx.pitchSemitones)
  }

  unload(): void {
    if (this.currentSource) {
      this.currentSource.stop()
      this.currentSource = null
    }
    this.currentBuffer = null
    this.pausedOffsetSec = 0
    this.isPlaying = false
    this.lastTrim = null
    this.lastFx = null
  }

  getCurrentSourceTimeSec(trim: TrimPoints): number {
    if (!this.ctx) return trim.startSec
    if (!this.isPlaying) return trim.startSec + this.pausedOffsetSec
    return trim.startSec + this.pausedOffsetSec + (this.ctx.currentTime - this.playStartedAt)
  }

  async startRecording(): Promise<ActiveRecording> {
    await this.ensureStarted()
    return startRecording(this.ctx!)
  }

  async render(buffer: AudioBuffer, trim: TrimPoints, fx: EffectParams): Promise<AudioBuffer> {
    const sr = buffer.sampleRate
    const length = Math.max(1, Math.ceil(((trim.endSec - trim.startSec) /
      Math.pow(2, fx.pitchSemitones / 12)) * sr))
    const offline = new OfflineAudioContext({
      numberOfChannels: buffer.numberOfChannels,
      length,
      sampleRate: sr,
    })
    const { renderOffline } = await import('./graph')
    return renderOffline(offline, buffer, trim, fx)
  }
}

export const engine = new AudioEngine()
