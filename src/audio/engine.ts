// ABOUTME: AudioEngine singleton — owns the AudioContext, graph, source node state machine.
// ABOUTME: Exposes play/pause/seek/trim/effect/record/render API for UI layers.

import { buildPreviewGraph, type PreviewGraph } from './graph'
import { startRecording, type ActiveRecording } from './recorder'
import type { EffectParams, TrimPoints } from './types'

export class AudioEngine {
  private ctx: AudioContext | null = null
  private graph: PreviewGraph | null = null
  private currentBuffer: AudioBuffer | null = null
  private pausedSourceTimeSec = 0
  private playStartedAt = 0
  private playStartedAtSrcSec = 0
  private isPlaying = false
  private lastTrim: TrimPoints | null = null
  private lastFx: EffectParams | null = null
  private lastReportedPosSec = 0

  async ensureStarted(): Promise<void> {
    if (this.ctx) return
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    this.graph = await buildPreviewGraph(this.ctx)
    this.graph.player.port.onmessage = (ev) => {
      const data = ev.data as { type?: string; readPosSec?: number }
      if (data.type === 'position' && typeof data.readPosSec === 'number') {
        this.lastReportedPosSec = data.readPosSec
      }
    }
  }

  get context(): AudioContext | null {
    return this.ctx
  }

  get reportedPosSec(): number {
    return this.lastReportedPosSec
  }

  getAnalyser(): AnalyserNode | null {
    return this.graph?.analyser ?? null
  }

  async loadFromBlob(blob: Blob): Promise<AudioBuffer> {
    await this.ensureStarted()
    const buf = await blob.arrayBuffer()
    const decoded = await this.ctx!.decodeAudioData(buf)
    this.currentBuffer = decoded
    this.graph!.loadBuffer(decoded)
    this.pausedSourceTimeSec = 0
    this.playStartedAtSrcSec = 0
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

    // Resume from where pause/seek left us, clamped into the current trim window.
    // First play after load has pausedSourceTimeSec === 0; that clamps up to trim.startSec
    // when trim.startSec > 0. Write the clamped value back to pausedSourceTimeSec so
    // getCurrentSourceTimeSec(...) returns the right anchor before any pause has occurred.
    const offsetSec = Math.max(
      trim.startSec,
      Math.min(trim.endSec, this.pausedSourceTimeSec || trim.startSec),
    )
    this.pausedSourceTimeSec = offsetSec
    this.playStartedAtSrcSec = offsetSec

    this.graph.player.port.postMessage({
      type: 'play',
      offsetSec,
      trim,
      fx,
    })
    this.playStartedAt = this.ctx.currentTime
    this.isPlaying = true
  }

  pause(): void {
    if (!this.ctx || !this.graph) return
    if (!this.isPlaying) return
    const trim = this.lastTrim ?? { startSec: 0, endSec: this.currentBuffer?.duration ?? 0 }
    this.pausedSourceTimeSec = this.getCurrentSourceTimeSec(trim)
    this.graph.player.port.postMessage({ type: 'pause' })
    this.isPlaying = false
  }

  async seek(sourceTimeSec: number): Promise<void> {
    if (!this.currentBuffer || !this.graph) return
    const trim = this.lastTrim ?? { startSec: 0, endSec: this.currentBuffer.duration }
    const clamped = Math.max(trim.startSec, Math.min(trim.endSec, sourceTimeSec))
    this.pausedSourceTimeSec = clamped
    this.graph.player.port.postMessage({ type: 'seek', sourceTimeSec: clamped })
    if (this.isPlaying && this.ctx) {
      this.playStartedAt = this.ctx.currentTime
      this.playStartedAtSrcSec = clamped
    }
  }

  async setTrim(trim: TrimPoints): Promise<void> {
    this.lastTrim = trim
    if (!this.graph) return
    if (this.isPlaying && this.ctx) {
      const cur = this.getCurrentSourceTimeSec(trim)
      this.playStartedAt = this.ctx.currentTime
      this.playStartedAtSrcSec = cur
    }
    this.graph.player.port.postMessage({ type: 'setTrim', trim })
  }

  setEffect(fx: EffectParams): void {
    if (!this.graph || !this.ctx) return
    if (this.isPlaying && this.lastTrim && this.lastFx && this.lastFx.speed !== fx.speed) {
      const cur = this.getCurrentSourceTimeSec(this.lastTrim)
      this.playStartedAt = this.ctx.currentTime
      this.playStartedAtSrcSec = cur
    }
    this.lastFx = fx
    this.graph.applyEffects(fx)
    this.graph.player.port.postMessage({ type: 'setFx', fx })
  }

  unload(): void {
    if (this.graph) this.graph.player.port.postMessage({ type: 'unload' })
    this.currentBuffer = null
    this.pausedSourceTimeSec = 0
    this.playStartedAtSrcSec = 0
    this.isPlaying = false
    this.lastTrim = null
    this.lastFx = null
  }

  getCurrentSourceTimeSec(trim: TrimPoints): number {
    if (!this.ctx) return trim.startSec
    if (!this.isPlaying) return this.pausedSourceTimeSec
    const wall = this.ctx.currentTime - this.playStartedAt
    const speed = this.lastFx?.speed ?? 1
    const pos = this.playStartedAtSrcSec + wall * speed
    const span = trim.endSec - trim.startSec
    if (span <= 0) return trim.startSec
    return trim.startSec + (((pos - trim.startSec) % span) + span) % span
  }

  async startRecording(): Promise<ActiveRecording> {
    await this.ensureStarted()
    return startRecording(this.ctx!)
  }

  async render(buffer: AudioBuffer, trim: TrimPoints, fx: EffectParams): Promise<AudioBuffer> {
    const sr = buffer.sampleRate
    const length = Math.max(1, Math.ceil(((trim.endSec - trim.startSec) / fx.speed) * sr))
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
