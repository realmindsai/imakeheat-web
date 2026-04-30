// ABOUTME: 303 VinylSim panel — four SP-style macro sliders for compression, noise, wow/flutter, and level.
// ABOUTME: Uses the shared SliderRow so labels and range hitboxes stay consistent with slot-card expectations.

import type { Slot } from '../types'
import { SliderRow } from '../_slider_row'

interface Props {
  slot: Extract<Slot, { kind: 'vinyl303' }>
  onChange(
    patch: Partial<{ comp: number; noise: number; wowFlutter: number; level: number }>,
  ): void
}

export function Vinyl303Panel({ slot, onChange }: Props) {
  return (
    <>
      <SliderRow
        label="Comp"
        value={slot.params.comp}
        min={0}
        max={100}
        step={1}
        left="open"
        right="squashed"
        onChange={(comp) => onChange({ comp })}
      />
      <SliderRow
        label="Noise"
        value={slot.params.noise}
        min={0}
        max={100}
        step={1}
        left="clean"
        right="dirty"
        onChange={(noise) => onChange({ noise })}
        className="mt-2"
      />
      <SliderRow
        label="Wow/flutter"
        value={slot.params.wowFlutter}
        min={0}
        max={100}
        step={1}
        left="steady"
        right="warped"
        onChange={(wowFlutter) => onChange({ wowFlutter })}
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
