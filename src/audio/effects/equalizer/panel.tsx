// ABOUTME: Equalizer panel — six slider rows for three band gains and three band frequencies.
// ABOUTME: Uses the shared SliderRow helper to preserve the slot-card range-input hitbox contract.

import { SliderRow } from '../_slider_row'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'equalizer' }>
  onChange(
    patch: Partial<{
      lowGain: number
      midGain: number
      highGain: number
      lowFreq: number
      midFreq: number
      highFreq: number
    }>,
  ): void
}

export function EqualizerPanel({ slot, onChange }: Props) {
  return (
    <>
      <SliderRow
        label="Low gain"
        value={slot.params.lowGain}
        min={-15}
        max={15}
        step={1}
        left="cut"
        right="boost"
        onChange={(lowGain) => onChange({ lowGain })}
      />
      <SliderRow
        label="Mid gain"
        value={slot.params.midGain}
        min={-15}
        max={15}
        step={1}
        left="cut"
        right="boost"
        onChange={(midGain) => onChange({ midGain })}
        className="mt-2"
      />
      <SliderRow
        label="High gain"
        value={slot.params.highGain}
        min={-15}
        max={15}
        step={1}
        left="cut"
        right="boost"
        onChange={(highGain) => onChange({ highGain })}
        className="mt-2"
      />
      <SliderRow
        label="Low freq"
        value={slot.params.lowFreq}
        min={20}
        max={400}
        step={1}
        left="20"
        right="400"
        onChange={(lowFreq) => onChange({ lowFreq })}
        className="mt-2"
      />
      <SliderRow
        label="Mid freq"
        value={slot.params.midFreq}
        min={200}
        max={8000}
        step={1}
        left="200"
        right="8000"
        onChange={(midFreq) => onChange({ midFreq })}
        className="mt-2"
      />
      <SliderRow
        label="High freq"
        value={slot.params.highFreq}
        min={2000}
        max={16000}
        step={1}
        left="2000"
        right="16000"
        onChange={(highFreq) => onChange({ highFreq })}
        className="mt-2"
      />
    </>
  )
}
