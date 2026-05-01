// ABOUTME: Effect-chain types — Slot, Chain, EffectKind, EffectDefinition, EffectNode.
// ABOUTME: Single source of truth for the pedalboard's data + node contracts.

import type { ReactElement } from 'react'

export type EffectKind =
  | 'crusher' | 'srhold' | 'pitch' | 'filter'
  | 'isolator' | 'equalizer' | 'filterDrive' | 'compressor' | 'loFi'
  | 'echo' | 'reverb' | 'vinyl303' | 'vinyl404' | 'cassette'
  | 'timeCtrlDly' | 'tapeEcho' | 'overdrive' | 'distortion' | 'wrmSaturator'

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
  | (SlotBase & { kind: 'isolator'; params: { low: number; mid: number; high: number } })
  | (SlotBase & {
      kind: 'equalizer'
      params: {
        lowGain: number
        midGain: number
        highGain: number
        lowFreq: number
        midFreq: number
        highFreq: number
      }
    })
  | (SlotBase & {
      kind: 'filterDrive'
      params: {
        cutoffHz: number
        resonance: number
        drive: number
        filterType: 'lowpass' | 'highpass'
        lowFreq: number
        lowGain: number
      }
    })
  | (SlotBase & {
      kind: 'compressor'
      params: {
        sustain: number
        attack: number
        ratio: number
        level: number
      }
    })
  | (SlotBase & {
      kind: 'loFi'
      params: {
        preFilt: number
        lofiType: number
        tone: number
        cutoffHz: number
        balance: number
        level: number
      }
    })
  | (SlotBase & { kind: 'echo';    params: { timeMs: number; feedback: number; mix: number } })
  | (SlotBase & { kind: 'timeCtrlDly'; params: { timeMs: number; feedback: number; mix: number; ducking: number } })
  | (SlotBase & { kind: 'tapeEcho'; params: { timeMs: number; feedback: number; mix: number; wowFlutter: number; tone: number } })
  | (SlotBase & { kind: 'overdrive'; params: { drive: number; tone: number; level: number; mix: number } })
  | (SlotBase & { kind: 'distortion'; params: { drive: number; tone: number; level: number; mix: number } })
  | (SlotBase & { kind: 'wrmSaturator'; params: { amount: number; bias: number; tone: number; mix: number; level: number } })
  | (SlotBase & { kind: 'reverb';  params: { size: number; decay: number; mix: number } })
  | (SlotBase & { kind: 'vinyl303'; params: { comp: number; noise: number; wowFlutter: number; level: number } })
  | (SlotBase & { kind: 'vinyl404'; params: { frequency: number; noise: number; wowFlutter: number } })
  | (SlotBase & { kind: 'cassette'; params: { tone: number; hiss: number; ageYears: number; drive: number; wowFlutter: number; catch: number } })

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
