// ABOUTME: Compressor panel — sustain, attack, ratio, and level controls.
// ABOUTME: Uses SliderRow to keep control layout and hitbox behavior consistent across effect panels.

import { SliderRow } from '../_slider_row'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'compressor' }>
  onChange(patch: Partial<{ sustain: number; attack: number; ratio: number; level: number }>): void
}

export function CompressorPanel({ slot, onChange }: Props) {
  return (
    <>
      <SliderRow
        label="Sustain"
        value={slot.params.sustain}
        min={0}
        max={100}
        step={1}
        left="open"
        right="squashed"
        onChange={(sustain) => onChange({ sustain })}
      />
      <SliderRow
        label="Attack"
        value={slot.params.attack}
        min={0}
        max={100}
        step={1}
        left="fast"
        right="slow"
        onChange={(attack) => onChange({ attack })}
        className="mt-2"
      />
      <SliderRow
        label="Ratio"
        value={slot.params.ratio}
        min={0}
        max={100}
        step={1}
        left="gentle"
        right="hard"
        onChange={(ratio) => onChange({ ratio })}
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
