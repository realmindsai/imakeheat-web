// ABOUTME: WrmSaturator panel — Amount, Bias, Tone, Mix, and Level controls.
// ABOUTME: Uses a centered slider for bias to communicate symmetric/asymmetric shaping.

import { Slider } from '../../../components/Slider'
import { Range } from '../../../components/Range'
import { useDebouncedCallback } from '../_debounce'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'wrmSaturator' }>
  onChange(patch: Partial<{ amount: number; bias: number; tone: number; mix: number; level: number }>): void
}

export function WrmSaturatorPanel({ slot, onChange }: Props) {
  const debouncedOnChange = useDebouncedCallback(onChange, 300)

  return (
    <>
      <div className="relative">
        <input type="range" min="0" max="1" step="0.01" value={slot.params.amount}
          onChange={(e) => debouncedOnChange({ amount: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={slot.params.amount} />
        <Range left="subtle" right="thick" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="-1" max="1" step="0.01" value={slot.params.bias}
          onChange={(e) => debouncedOnChange({ bias: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={(slot.params.bias + 1) / 2} neutralCenter />
        <Range left="neg" right="pos" centerHint="0" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="1" step="0.01" value={slot.params.tone}
          onChange={(e) => debouncedOnChange({ tone: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={slot.params.tone} />
        <Range left="dark" right="bright" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="1" step="0.01" value={slot.params.mix}
          onChange={(e) => debouncedOnChange({ mix: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={slot.params.mix} />
        <Range left="dry" right="wet" />
      </div>

      <div className="relative mt-2">
        <input type="range" min="0" max="1.5" step="0.01" value={slot.params.level}
          onChange={(e) => debouncedOnChange({ level: Number(e.target.value) })}
          className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
        <Slider value={slot.params.level / 1.5} />
        <Range left="quiet" right="loud" />
      </div>
    </>
  )
}
