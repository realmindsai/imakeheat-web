// ABOUTME: Isolator panel — three shared slider rows for low, mid, and high band gain.
// ABOUTME: Keeps the SP-style kill/boost ranges aligned with the slot-card slider hitbox pattern.

import { SliderRow } from '../_slider_row'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'isolator' }>
  onChange(patch: Partial<{ low: number; mid: number; high: number }>): void
}

export function IsolatorPanel({ slot, onChange }: Props) {
  return (
    <>
      <SliderRow
        label="Low"
        value={slot.params.low}
        min={-60}
        max={12}
        step={1}
        left="kill"
        right="boost"
        onChange={(low) => onChange({ low })}
      />
      <SliderRow
        label="Mid"
        value={slot.params.mid}
        min={-60}
        max={12}
        step={1}
        left="kill"
        right="boost"
        onChange={(mid) => onChange({ mid })}
        className="mt-2"
      />
      <SliderRow
        label="High"
        value={slot.params.high}
        min={-60}
        max={12}
        step={1}
        left="kill"
        right="boost"
        onChange={(high) => onChange({ high })}
        className="mt-2"
      />
    </>
  )
}
