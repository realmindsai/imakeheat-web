// ABOUTME: Distortion panel — Drive, Tone, Level, and Mix controls.
// ABOUTME: Mirrors overdrive panel layout with identical interaction semantics.

import { Slider } from '../../../components/Slider'
import { Range } from '../../../components/Range'
import { useDebouncedCallback } from '../_debounce'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'distortion' }>
  onChange(patch: Partial<{ drive: number; tone: number; level: number; mix: number }>): void
}

export function DistortionPanel({ slot, onChange }: Props) {
  const debouncedOnChange = useDebouncedCallback(onChange, 300)

  return (
    <>
      <div className="relative">
        <input type="range" min="0" max="1" step="0.01" value={slot.params.drive}
          onChange={(e) => debouncedOnChange({ drive: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={slot.params.drive} />
        <Range left="mild" right="fuzz" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="1" step="0.01" value={slot.params.tone}
          onChange={(e) => debouncedOnChange({ tone: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={slot.params.tone} />
        <Range left="dark" right="bright" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="1.5" step="0.01" value={slot.params.level}
          onChange={(e) => debouncedOnChange({ level: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={slot.params.level / 1.5} />
        <Range left="quiet" right="loud" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="1" step="0.01" value={slot.params.mix}
          onChange={(e) => debouncedOnChange({ mix: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={slot.params.mix} />
        <Range left="dry" right="wet" />
      </div>
    </>
  )
}
