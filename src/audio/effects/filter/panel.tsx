// ABOUTME: Filter slot panel — single -1..+1 slider, sign picks LP/HP and magnitude is intensity.
// ABOUTME: Lift-and-shift from src/screens/EffectsRack.tsx.

import { Slider } from '../../../components/Slider'
import { Range } from '../../../components/Range'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'filter' }>
  onChange(patch: Partial<{ value: number }>): void
}

export function FilterPanel({ slot, onChange }: Props) {
  const norm = (slot.params.value + 1) / 2
  return (
    <>
      <input type="range" min="-1" max="1" step="0.01" value={slot.params.value}
        onChange={(e) => onChange({ value: Number(e.target.value) })}
        className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
      <Slider value={norm} neutralCenter />
      <Range left="LP" right="HP" centerHint="neutral" />
    </>
  )
}
