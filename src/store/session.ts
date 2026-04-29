// ABOUTME: Zustand in-memory session store — single source of truth for active audio session.
// ABOUTME: Holds source, effects, trim, playback, render state, engine readiness, and routing.

import { create } from 'zustand'
import type { EffectParams, TrimPoints } from '../audio/types'

export interface Source {
  id: string
  blob: Blob
  buffer: AudioBuffer
  name: string
  durationSec: number
  sampleRateHz: number
  channels: number
}

export interface Playback {
  isPlaying: boolean
  currentSourceTimeSec: number
  looping: boolean
}

export type RenderState =
  | { phase: 'idle' }
  | { phase: 'rendering'; startedAt: number }
  | { phase: 'error'; message: string }

export type Route = 'home' | 'preview' | 'effects' | 'exports'

export const defaultEffects: EffectParams = {
  bitDepth: 16,
  sampleRateHz: 44100,
  pitchSemitones: 0,
  speed: 1,
  filterValue: 0,
}

export const defaultTrim: TrimPoints = { startSec: 0, endSec: 0 }

interface SessionState {
  source: Source | null
  trim: TrimPoints
  effects: EffectParams
  playback: Playback
  render: RenderState
  engineReady: boolean
  route: Route
  srManuallyAdjusted: boolean

  setSource(source: Source): void
  clearSource(): void
  setTrim(trim: TrimPoints): void
  setEffect(patch: Partial<EffectParams>): void
  nudgeSampleRate(hz: number): void
  resetEffects(): void
  setPlayback(patch: Partial<Playback>): void
  setEngineReady(ready: boolean): void
  navigate(route: Route): void
  beginRender(): void
  finishRender(): void
  failRender(message: string): void
  reset(): void
}

const initial: Omit<SessionState, 'setSource' | 'clearSource' | 'setTrim' | 'setEffect' | 'nudgeSampleRate' | 'resetEffects' | 'setPlayback' | 'setEngineReady' | 'navigate' | 'beginRender' | 'finishRender' | 'failRender' | 'reset'> = {
  source: null,
  trim: defaultTrim,
  effects: defaultEffects,
  playback: { isPlaying: false, currentSourceTimeSec: 0, looping: false },
  render: { phase: 'idle' },
  engineReady: false,
  route: 'home',
  srManuallyAdjusted: false,
}

export const useSessionStore = create<SessionState>((set, _get) => ({
  ...initial,

  setSource: (source) =>
    set({
      source,
      effects: { ...defaultEffects, sampleRateHz: source.sampleRateHz },
      trim: { startSec: 0, endSec: source.durationSec },
      playback: { isPlaying: false, currentSourceTimeSec: 0, looping: false },
      render: { phase: 'idle' },
      srManuallyAdjusted: false,
    }),
  clearSource: () =>
    set({ source: null, trim: defaultTrim, playback: { isPlaying: false, currentSourceTimeSec: 0, looping: false } }),
  setTrim: (trim) => set({ trim }),
  setEffect: (patch) => set((s) => ({
    effects: { ...s.effects, ...patch },
    srManuallyAdjusted: 'sampleRateHz' in patch ? true : s.srManuallyAdjusted,
  })),
  nudgeSampleRate: (hz) => set((s) => ({
    effects: { ...s.effects, sampleRateHz: hz },
  })),
  resetEffects: () => set({
    effects: defaultEffects,
    srManuallyAdjusted: false,
  }),
  setPlayback: (patch) => set((s) => ({ playback: { ...s.playback, ...patch } })),
  setEngineReady: (engineReady) => set({ engineReady }),
  navigate: (route) => set({ route }),
  beginRender: () => set({ render: { phase: 'rendering', startedAt: Date.now() } }),
  finishRender: () => set({ render: { phase: 'idle' } }),
  failRender: (message) => set({ render: { phase: 'error', message } }),
  reset: () => set(initial),
}))
