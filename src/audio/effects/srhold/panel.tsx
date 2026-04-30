// ABOUTME: SR-hold slot panel — sample-rate slider 4–48 kHz.
// ABOUTME: Lift-and-shift from src/screens/EffectsRack.tsx (the legacy non-slot rack).

import { Slider } from '../../../components/Slider'
import { Range } from '../../../components/Range'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'srhold' }>
  onChange(patch: Partial<{ sampleRateHz: number }>): void
}

export function SrHoldPanel({ slot, onChange }: Props) {
  const norm = (slot.params.sampleRateHz - 4000) / (48000 - 4000)
  return (
    <>
      <input type="range" min="4000" max="48000" step="100" value={slot.params.sampleRateHz}
        onChange={(e) => onChange({ sampleRateHz: Number(e.target.value) })}
        className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
      <Slider value={norm} />
      <Range left="4 k" right="48 k" />
    </>
  )
}
