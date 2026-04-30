// ABOUTME: 404 VinylSim panel — three sliders for playback-response shaping, surface noise, and wow/flutter.
// ABOUTME: Uses the shared SliderRow so labels and range hitboxes stay consistent with slot-card expectations.

import type { Slot } from '../types'
import { SliderRow } from '../_slider_row'

interface Props {
  slot: Extract<Slot, { kind: 'vinyl404' }>
  onChange(patch: Partial<{ frequency: number; noise: number; wowFlutter: number }>): void
}

export function Vinyl404Panel({ slot, onChange }: Props) {
  return (
    <>
      <SliderRow
        label="Frequency"
        value={slot.params.frequency}
        min={0}
        max={100}
        step={1}
        left="rolled-off"
        right="full-band"
        onChange={(frequency) => onChange({ frequency })}
      />
      <SliderRow
        label="Noise"
        value={slot.params.noise}
        min={0}
        max={100}
        step={1}
        left="clean"
        right="dusty"
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
        right="wandering"
        onChange={(wowFlutter) => onChange({ wowFlutter })}
        className="mt-2"
      />
    </>
  )
}
