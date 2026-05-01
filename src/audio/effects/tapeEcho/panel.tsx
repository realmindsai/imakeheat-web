// ABOUTME: TapeEcho panel — Time, Feedback, Mix, Wow/Flutter, and Tone controls.
// ABOUTME: Uses isolated relative slider rows so invisible range inputs remain clickable.

import { Slider } from '../../../components/Slider'
import { Range } from '../../../components/Range'
import { useDebouncedCallback } from '../_debounce'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'tapeEcho' }>
  onChange(patch: Partial<{ timeMs: number; feedback: number; mix: number; wowFlutter: number; tone: number }>): void
}

export function TapeEchoPanel({ slot, onChange }: Props) {
  const debouncedOnChange = useDebouncedCallback(onChange, 300)
  const timeNorm = (slot.params.timeMs - 50) / (1500 - 50)
  const fbNorm = slot.params.feedback / 0.95
  const mixNorm = slot.params.mix
  const wowNorm = slot.params.wowFlutter
  const toneNorm = slot.params.tone

  return (
    <>
      <div className="relative">
        <input type="range" min="50" max="1500" step="10" value={slot.params.timeMs}
          onChange={(e) => debouncedOnChange({ timeMs: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={timeNorm} />
        <Range left="50 ms" right="1500 ms" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="0.95" step="0.05" value={slot.params.feedback}
          onChange={(e) => debouncedOnChange({ feedback: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={fbNorm} />
        <Range left="0" right="0.95" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="1" step="0.05" value={slot.params.mix}
          onChange={(e) => debouncedOnChange({ mix: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={mixNorm} />
        <Range left="dry" right="wet" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="1" step="0.05" value={slot.params.wowFlutter}
          onChange={(e) => debouncedOnChange({ wowFlutter: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={wowNorm} />
        <Range left="steady" right="warped" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="1" step="0.05" value={slot.params.tone}
          onChange={(e) => debouncedOnChange({ tone: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={toneNorm} />
        <Range left="dark" right="bright" />
      </div>
    </>
  )
}
