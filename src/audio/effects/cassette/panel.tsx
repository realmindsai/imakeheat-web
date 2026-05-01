// ABOUTME: Cassette Sim panel — six sliders for tone, hiss, age, drive, wow/flutter, and tape catch.
// ABOUTME: Uses the shared SliderRow so labels and range hitboxes stay consistent with slot-card expectations.

import type { Slot } from '../types'
import { SliderRow } from '../_slider_row'

interface Props {
  slot: Extract<Slot, { kind: 'cassette' }>
  onChange(
    patch: Partial<{
      tone: number
      hiss: number
      ageYears: number
      drive: number
      wowFlutter: number
      catch: number
    }>,
  ): void
}

export function CassettePanel({ slot, onChange }: Props) {
  return (
    <>
      <SliderRow
        label="Tone"
        value={slot.params.tone}
        min={0}
        max={100}
        step={1}
        left="dark"
        right="bright"
        onChange={(tone) => onChange({ tone })}
      />
      <SliderRow
        label="Hiss"
        value={slot.params.hiss}
        min={0}
        max={100}
        step={1}
        left="clean"
        right="dirty"
        onChange={(hiss) => onChange({ hiss })}
        className="mt-2"
      />
      <SliderRow
        label="Age"
        value={slot.params.ageYears}
        min={0}
        max={60}
        step={1}
        left="fresh"
        right="dead"
        onChange={(ageYears) => onChange({ ageYears })}
        className="mt-2"
      />
      <SliderRow
        label="Drive"
        value={slot.params.drive}
        min={0}
        max={100}
        step={1}
        left="clean"
        right="cooked"
        onChange={(drive) => onChange({ drive })}
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
        label="Catch"
        value={slot.params.catch}
        min={0}
        max={100}
        step={1}
        left="smooth"
        right="chewed"
        onChange={(catchValue) => onChange({ catch: catchValue })}
        className="mt-2"
      />
    </>
  )
}
