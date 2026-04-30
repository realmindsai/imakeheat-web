// ABOUTME: AudioEngine singleton — owns the AudioContext, chain graph, and player state machine.
// ABOUTME: Exposes play/pause/seek/trim/rebuildChain/updateSlotParams/record/render API for UI layers.

import { loadWorklets, renderOffline } from './graph'
import { startRecording, type ActiveRecording } from './recorder'
import { registry } from './effects/registry'
import type { Chain, EffectNode, Slot } from './effects/types'
import type { TrimPoints } from './types'

import wsolaUrl from './worklets/wsola.worklet.ts?worker&url'

void wsolaUrl // keep side-effect import alive under strict unused-binding lint

const REBUILD_COALESCE_MS = 8

interface LiveSlotEntry {
  slot: Slot
  node: EffectNode<unknown>
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private player: AudioWorkletNode | null = null
  private analyser: AnalyserNode | null = null
  private master: GainNode | null = null
  private currentBuffer: AudioBuffer | null = null

  private liveNodes: Map<string, LiveSlotEntry> = new Map()
  private pendingChain: Chain | null = null
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null

  private pausedSourceTimeSec = 0
  private playStartedAt = 0
  private playStartedAtSrcSec = 0
  private isPlaying = false
  private lastTrim: TrimPoints | null = null
  private lastChain: Chain | null = null
  private lastReportedPosSec = 0

  async ensureStarted(): Promise<void> {
    if (this.ctx) return
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    await loadWorklets(this.ctx)
    this.player = new AudioWorkletNode(this.ctx, 'wsola')
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.master = this.ctx.createGain()
    this.master.gain.value = 1

    // Default wiring with no slots: player → analyser → master → destination.
    this.player.connect(this.analyser)
    this.analyser.connect(this.master)
    this.master.connect(this.ctx.destination)

    this.player.port.onmessage = (ev) => {
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
    return this.analyser
  }

  async loadFromBlob(blob: Blob): Promise<AudioBuffer> {
    await this.ensureStarted()
    const buf = await blob.arrayBuffer()
    const decoded = await this.ctx!.decodeAudioData(buf)
    this.currentBuffer = decoded
    this.loadBufferIntoPlayer(decoded)
    this.pausedSourceTimeSec = 0
    this.playStartedAtSrcSec = 0
    this.isPlaying = false
    this.lastTrim = null
    this.lastChain = null
    return decoded
  }

  private loadBufferIntoPlayer(audioBuffer: AudioBuffer): void {
    if (!this.player) return
    const channels: Float32Array[] = []
    const transfer: ArrayBuffer[] = []
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      const data = new Float32Array(audioBuffer.length)
      audioBuffer.copyFromChannel(data, c)
      channels.push(data)
      transfer.push(data.buffer)
    }
    this.player.port.postMessage(
      { type: 'load', channels, sampleRate: audioBuffer.sampleRate },
      transfer,
    )
  }

  async play(trim: TrimPoints, chain: Chain): Promise<void> {
    if (!this.ctx || !this.player || !this.currentBuffer) throw new Error('engine not loaded')
    if (this.isPlaying) return
    this.lastTrim = trim
    this.rebuildChain(chain)

    const offsetSec = Math.max(
      trim.startSec,
      Math.min(trim.endSec, this.pausedSourceTimeSec || trim.startSec),
    )
    this.pausedSourceTimeSec = offsetSec
    this.playStartedAtSrcSec = offsetSec

    this.player.port.postMessage({
      type: 'play',
      offsetSec,
      trim,
      chain,
    })
    this.playStartedAt = this.ctx.currentTime
    this.isPlaying = true
  }

  pause(): void {
    if (!this.ctx || !this.player) return
    if (!this.isPlaying) return
    const trim = this.lastTrim ?? { startSec: 0, endSec: this.currentBuffer?.duration ?? 0 }
    this.pausedSourceTimeSec = this.getCurrentSourceTimeSec(trim)
    this.player.port.postMessage({ type: 'pause' })
    this.isPlaying = false
  }

  async seek(sourceTimeSec: number): Promise<void> {
    if (!this.currentBuffer || !this.player) return
    const trim = this.lastTrim ?? { startSec: 0, endSec: this.currentBuffer.duration }
    const clamped = Math.max(trim.startSec, Math.min(trim.endSec, sourceTimeSec))
    this.pausedSourceTimeSec = clamped
    this.player.port.postMessage({ type: 'seek', sourceTimeSec: clamped })
    if (this.isPlaying && this.ctx) {
      this.playStartedAt = this.ctx.currentTime
      this.playStartedAtSrcSec = clamped
    }
  }

  async setTrim(trim: TrimPoints): Promise<void> {
    this.lastTrim = trim
    if (!this.player) return
    if (this.isPlaying && this.ctx) {
      const cur = this.getCurrentSourceTimeSec(trim)
      this.playStartedAt = this.ctx.currentTime
      this.playStartedAtSrcSec = cur
    }
    this.player.port.postMessage({ type: 'setTrim', trim })
  }

  /**
   * Replace the live chain. Coalesces bursts within REBUILD_COALESCE_MS into a
   * single rewire so a sequence of UI changes (drag-reorder, +Add, ×Remove)
   * doesn't tear down/build up the graph multiple times in one frame.
   */
  rebuildChain(chain: Chain): void {
    this.pendingChain = chain
    if (this.rebuildTimer != null) return
    this.rebuildTimer = setTimeout(() => {
      this.rebuildTimer = null
      const next = this.pendingChain
      this.pendingChain = null
      if (next) this.applyChain(next)
    }, REBUILD_COALESCE_MS)
  }

  private applyChain(chain: Chain): void {
    if (!this.ctx || !this.player || !this.analyser) return
    const ctx = this.ctx

    // Speed change requires resetting the playback anchor so getCurrentSourceTimeSec
    // doesn't lurch when speed changes mid-play.
    const oldSpeed = speedFromChain(this.lastChain)
    const newSpeed = speedFromChain(chain)
    if (this.isPlaying && this.lastTrim && oldSpeed !== newSpeed) {
      const cur = this.getCurrentSourceTimeSec(this.lastTrim)
      this.playStartedAt = ctx.currentTime
      this.playStartedAtSrcSec = cur
    }

    this.lastChain = chain

    // Forward chain semantics to the WSOLA player.
    this.player.port.postMessage({ type: 'setChain', chain })

    // Decide which slots are "active" in the audio graph. Pitch is control-only
    // (WSOLA owns it), and disabled or neutral slots are skipped.
    const activeSlots = chain.filter((s) => s.enabled && s.kind !== 'pitch' && !isSlotNeutral(s))

    // Build/keep nodes per slot id; dispose anything missing from the new chain.
    const nextLive: Map<string, LiveSlotEntry> = new Map()
    for (const slot of activeSlots) {
      const existing = this.liveNodes.get(slot.id)
      if (existing && existing.slot.kind === slot.kind) {
        // Same kind — keep node, push params.
        existing.node.apply(slot.params as never)
        existing.slot = slot
        nextLive.set(slot.id, existing)
      } else {
        const def = registry.get(slot.kind)
        if (!def) continue
        const node = def.build(ctx, slot.params as never) as EffectNode<unknown>
        nextLive.set(slot.id, { slot, node })
      }
    }
    for (const [id, entry] of this.liveNodes) {
      if (!nextLive.has(id)) {
        try { entry.node.dispose() } catch { /* ignore */ }
      }
    }

    // Rewire: player → [active nodes in chain order] → analyser → master → destination.
    // We tear down outgoing connections for every node we own, then reconnect.
    try { this.player.disconnect() } catch { /* ignore */ }
    for (const entry of nextLive.values()) {
      try { entry.node.input.disconnect() } catch { /* ignore */ }
      try { entry.node.output.disconnect() } catch { /* ignore */ }
    }

    let head: AudioNode = this.player
    for (const slot of activeSlots) {
      const entry = nextLive.get(slot.id)
      if (!entry) continue
      head.connect(entry.node.input)
      head = entry.node.output
    }
    head.connect(this.analyser)

    this.liveNodes = nextLive
  }

  /**
   * Push parameter changes for a single slot without tearing down the graph.
   * Pitch slot is special-cased: WSOLA owns the DSP.
   */
  updateSlotParams(slotId: string, params: unknown): void {
    if (!this.lastChain) return
    // Update lastChain in-place so future speed/playhead math sees the new params.
    this.lastChain = this.lastChain.map((s) =>
      s.id === slotId ? ({ ...s, params: { ...(s.params as object), ...(params as object) } } as Slot) : s,
    )
    const slot = this.lastChain.find((s) => s.id === slotId)
    if (!slot) return

    if (slot.kind === 'pitch') {
      // Reset playback anchor on speed change.
      const p = slot.params as { semitones: number; speed: number }
      if (this.isPlaying && this.lastTrim && this.ctx) {
        const cur = this.getCurrentSourceTimeSec(this.lastTrim)
        this.playStartedAt = this.ctx.currentTime
        this.playStartedAtSrcSec = cur
      }
      this.player?.port.postMessage({ type: 'pitch', params: { semitones: p.semitones, speed: p.speed } })
      return
    }

    const entry = this.liveNodes.get(slotId)
    if (entry) {
      entry.node.apply(slot.params as never)
      entry.slot = slot
      return
    }
    // No live node yet (slot was neutral/disabled). Falling back to a full
    // rebuild ensures a slot toggling out of neutrality wires itself in.
    this.rebuildChain(this.lastChain)
  }

  unload(): void {
    if (this.player) this.player.port.postMessage({ type: 'unload' })
    for (const entry of this.liveNodes.values()) {
      try { entry.node.dispose() } catch { /* ignore */ }
    }
    this.liveNodes.clear()
    this.currentBuffer = null
    this.pausedSourceTimeSec = 0
    this.playStartedAtSrcSec = 0
    this.isPlaying = false
    this.lastTrim = null
    this.lastChain = null
  }

  getCurrentSourceTimeSec(trim: TrimPoints): number {
    if (!this.ctx) return trim.startSec
    if (!this.isPlaying) return this.pausedSourceTimeSec
    const wall = this.ctx.currentTime - this.playStartedAt
    const speed = speedFromChain(this.lastChain)
    const pos = this.playStartedAtSrcSec + wall * speed
    const span = trim.endSec - trim.startSec
    if (span <= 0) return trim.startSec
    return trim.startSec + (((pos - trim.startSec) % span) + span) % span
  }

  async startRecording(): Promise<ActiveRecording> {
    await this.ensureStarted()
    return startRecording(this.ctx!)
  }

  async render(buffer: AudioBuffer, trim: TrimPoints, chain: Chain): Promise<AudioBuffer> {
    return renderOffline(buffer, trim, chain)
  }
}

export const engine = new AudioEngine()

function speedFromChain(chain: Chain | null): number {
  if (!chain) return 1
  const p = chain.find((s) => s.kind === 'pitch')
  if (!p || !p.enabled) return 1
  return (p.params as { speed: number }).speed ?? 1
}

function isSlotNeutral(slot: Slot): boolean {
  const def = registry.get(slot.kind)
  if (!def) return true
  return def.isNeutral(slot.params as never)
}
