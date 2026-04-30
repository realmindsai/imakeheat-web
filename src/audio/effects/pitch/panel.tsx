// ABOUTME: Pitch slot panel — semitones slider (-12..+12) and log-mapped speed slider (0.5×..2×).
// ABOUTME: Annotation surfaces the v2 limitation: pitch always applies before all other effects.

import { Slider } from '../../../components/Slider'
import { Range } from '../../../components/Range'
import { sliderToSpeed, speedToSlider } from '../../speed'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'pitch' }>
  onChange(patch: Partial<{ semitones: number; speed: number }>): void
}

export function PitchPanel({ slot, onChange }: Props) {
  const pitchNorm = (slot.params.semitones + 12) / 24
  return (
    <>
      <small className="block text-rmai-mut text-xs">applies before all effects</small>
      <input type="range" min="-12" max="12" step="1" value={slot.params.semitones}
        onChange={(e) => onChange({ semitones: Number(e.target.value) })}
        className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
      <Slider value={pitchNorm} neutralCenter />
      <Range left="−12" right="+12" />
      <input type="range" min="0" max="1" step="0.001"
        value={speedToSlider(slot.params.speed)}
        onChange={(e) => onChange({ speed: sliderToSpeed(Number(e.target.value)) })}
        className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
      <Slider value={speedToSlider(slot.params.speed)} neutralCenter />
      <Range left="0.5×" right="2.0×" centerHint="1.0×" />
    </>
  )
}
