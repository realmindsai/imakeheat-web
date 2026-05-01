// ABOUTME: Lo-fi panel — pre-filter voicing, degradation type, tone, cutoff, blend, and output controls.
// ABOUTME: Uses SliderRow so all controls obey the shared slot-card slider interaction contract.

import { SliderRow } from '../_slider_row'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'loFi' }>
  onChange(
    patch: Partial<{
      preFilt: number
      lofiType: number
      tone: number
      cutoffHz: number
      balance: number
      level: number
    }>,
  ): void
}

export function LoFiPanel({ slot, onChange }: Props) {
  return (
    <>
      <SliderRow
        label="Pre filt"
        value={slot.params.preFilt}
        min={1}
        max={6}
        step={1}
        left="open"
        right="boxed"
        onChange={(preFilt) => onChange({ preFilt })}
      />
      <SliderRow
        label="Lo-fi type"
        value={slot.params.lofiType}
        min={1}
        max={9}
        step={1}
        left="mild"
        right="wrecked"
        onChange={(lofiType) => onChange({ lofiType })}
        className="mt-2"
      />
      <SliderRow
        label="Tone"
        value={slot.params.tone}
        min={-100}
        max={100}
        step={1}
        left="dark"
        right="bright"
        onChange={(tone) => onChange({ tone })}
        className="mt-2"
      />
      <SliderRow
        label="Cutoff"
        value={slot.params.cutoffHz}
        min={200}
        max={8000}
        step={1}
        left="200"
        right="8000"
        onChange={(cutoffHz) => onChange({ cutoffHz })}
        className="mt-2"
      />
      <SliderRow
        label="Balance"
        value={slot.params.balance}
        min={0}
        max={100}
        step={1}
        left="dry"
        right="wet"
        onChange={(balance) => onChange({ balance })}
        className="mt-2"
      />
      <SliderRow
        label="Level"
        value={slot.params.level}
        min={0}
        max={100}
        step={1}
        left="mute"
        right="unity"
        onChange={(level) => onChange({ level })}
        className="mt-2"
      />
    </>
  )
}
