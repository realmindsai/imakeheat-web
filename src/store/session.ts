// ABOUTME: Zustand in-memory session store — single source of truth for active audio session.
// ABOUTME: Holds source, chain (effect slots), trim, playback, render state, engine readiness, and routing.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TrimPoints } from '../audio/types'
import type { Chain, EffectKind, ParamsOf, Slot } from '../audio/effects/types'
import { registry } from '../audio/effects/registry'

const SP_TARGET_RATE_HZ = 24000

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

export const defaultTrim: TrimPoints = { startSec: 0, endSec: 0 }

export const defaultChain = (sourceRate?: number): Chain => [
  { id: crypto.randomUUID(), kind: 'crusher', enabled: true, params: { bitDepth: 16 } },
  { id: crypto.randomUUID(), kind: 'srhold',  enabled: true, params: { sampleRateHz: sourceRate ?? 44100 } },
  { id: crypto.randomUUID(), kind: 'pitch',   enabled: true, params: { semitones: 0, speed: 1 } },
  { id: crypto.randomUUID(), kind: 'filter',  enabled: true, params: { value: 0 } },
]

interface SessionState {
  source: Source | null
  trim: TrimPoints
  chain: Chain
  playback: Playback
  render: RenderState
  engineReady: boolean
  route: Route
  srManuallyAdjusted: boolean

  setSource(source: Source): void
  clearSource(): void
  setTrim(trim: TrimPoints): void
  addSlot(kind: EffectKind): void
  removeSlot(id: string): void
  reorderSlot(id: string, toIndex: number): void
  toggleEnabled(id: string): void
  setSlotParams(id: string, patch: Partial<ParamsOf<EffectKind>>): void
  setChain(chain: Chain): void
  resetChain(): void
  setPlayback(patch: Partial<Playback>): void
  setEngineReady(ready: boolean): void
  navigate(route: Route): void
  beginRender(): void
  finishRender(): void
  failRender(message: string): void
  reset(): void
}

const initialState = (): Omit<SessionState, 'setSource' | 'clearSource' | 'setTrim' | 'addSlot' | 'removeSlot' | 'reorderSlot' | 'toggleEnabled' | 'setSlotParams' | 'setChain' | 'resetChain' | 'setPlayback' | 'setEngineReady' | 'navigate' | 'beginRender' | 'finishRender' | 'failRender' | 'reset'> => ({
  source: null,
  trim: defaultTrim,
  chain: defaultChain(),
  playback: { isPlaying: false, currentSourceTimeSec: 0, looping: false },
  render: { phase: 'idle' },
  engineReady: false,
  route: 'home',
  srManuallyAdjusted: false,
})

export const useSessionStore = create<SessionState>()(
  persist(
    (set, _get) => ({
  ...initialState(),

  setSource: (source) =>
    set({
      source,
      chain: defaultChain(source.sampleRateHz),
      trim: { startSec: 0, endSec: source.durationSec },
      playback: { isPlaying: false, currentSourceTimeSec: 0, looping: false },
      render: { phase: 'idle' },
      srManuallyAdjusted: false,
    }),
  clearSource: () =>
    set({ source: null, trim: defaultTrim, playback: { isPlaying: false, currentSourceTimeSec: 0, looping: false } }),
  setTrim: (trim) => set({ trim }),

  addSlot: (kind) => set((s) => {
    const def = registry.get(kind)
    if (!def) return {}
    const slot = {
      id: crypto.randomUUID(),
      kind,
      enabled: true,
      params: { ...(def.defaultParams as object) },
    } as Slot
    return { chain: [...s.chain, slot] }
  }),

  removeSlot: (id) => set((s) => ({ chain: s.chain.filter(x => x.id !== id) })),

  reorderSlot: (id, toIndex) => set((s) => {
    const fromIndex = s.chain.findIndex(x => x.id === id)
    if (fromIndex === -1) return {}
    const next = s.chain.slice()
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return { chain: next }
  }),

  toggleEnabled: (id) => set((s) => ({
    chain: s.chain.map(x => x.id === id ? { ...x, enabled: !x.enabled } as Slot : x),
  })),

  setSlotParams: (id, patch) => set((s) => {
    let chain = s.chain.map(x =>
      x.id === id ? { ...x, params: { ...x.params, ...patch } } as Slot : x,
    )
    let srManuallyAdjusted = s.srManuallyAdjusted
    const targetBefore = s.chain.find(x => x.id === id)
    const targetAfter = chain.find(x => x.id === id)
    if (targetAfter?.kind === 'crusher' && (targetAfter.params as any).bitDepth === 12) {
      const wasNot12 = (targetBefore?.params as any).bitDepth !== 12
      if (wasNot12 && !srManuallyAdjusted) {
        chain = chain.map(x =>
          x.kind === 'srhold' ? { ...x, params: { sampleRateHz: SP_TARGET_RATE_HZ } } as Slot : x,
        )
      }
    }
    if (targetAfter?.kind === 'srhold' && 'sampleRateHz' in patch) srManuallyAdjusted = true
    return { chain, srManuallyAdjusted }
  }),

  setChain: (chain) => set({
    chain: chain.map(s => ({ ...s, id: crypto.randomUUID() })),
  }),

  resetChain: () => set((s) => ({
    chain: defaultChain(s.source?.sampleRateHz),
    srManuallyAdjusted: false,
  })),

  setPlayback: (patch) => set((s) => ({ playback: { ...s.playback, ...patch } })),
  setEngineReady: (engineReady) => set({ engineReady }),
  navigate: (route) => set({ route }),
  beginRender: () => set({ render: { phase: 'rendering', startedAt: Date.now() } }),
  finishRender: () => set({ render: { phase: 'idle' } }),
  failRender: (message) => set({ render: { phase: 'error', message } }),
  reset: () => set(initialState()),
    }),
    {
      name: 'imakeheat-chain',
      partialize: (s) => ({ chain: s.chain }),
    },
  ),
)
