// ABOUTME: Effect-chain types — Slot, Chain, EffectKind, EffectDefinition, EffectNode.
// ABOUTME: Single source of truth for the pedalboard's data + node contracts.

import type { ReactElement } from 'react'

export type EffectKind =
  | 'crusher' | 'srhold' | 'pitch' | 'filter'
  | 'echo' | 'reverb' | 'vinyl303'

export interface SlotBase {
  id: string
  kind: EffectKind
  enabled: boolean
}

export type Slot =
  | (SlotBase & { kind: 'crusher'; params: { bitDepth: 2 | 4 | 8 | 12 | 16 } })
  | (SlotBase & { kind: 'srhold';  params: { sampleRateHz: number } })
  | (SlotBase & { kind: 'pitch';   params: { semitones: number; speed: number } })
  | (SlotBase & { kind: 'filter';  params: { value: number } })
  | (SlotBase & { kind: 'echo';    params: { timeMs: number; feedback: number; mix: number } })
  | (SlotBase & { kind: 'reverb';  params: { size: number; decay: number; mix: number } })
  | (SlotBase & { kind: 'vinyl303'; params: { comp: number; noise: number; wowFlutter: number; level: number } })

export type Chain = Slot[]

export type ParamsOf<K extends EffectKind> = Extract<Slot, { kind: K }>['params']

export interface EffectNode<P> {
  input: AudioNode
  output: AudioNode
  apply(params: P): void
  dispose(): void
}

export interface EffectDefinition<K extends EffectKind = EffectKind> {
  kind: K
  displayName: string
  defaultParams: ParamsOf<K>
  isNeutral(p: ParamsOf<K>): boolean
  build(ctx: BaseAudioContext, params: ParamsOf<K>): EffectNode<ParamsOf<K>>
  Panel: (props: { slot: Extract<Slot, { kind: K }>; onChange(patch: Partial<ParamsOf<K>>): void }) => ReactElement
}
