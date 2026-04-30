// ABOUTME: Reverb slot panel — three sliders (Size, Decay, Mix). onChange is debounced 300 ms.
// ABOUTME: The engine ignores reverb params until Chunk 4 worklet lands.

import { Slider } from '../../../components/Slider'
import { Range } from '../../../components/Range'
import { useDebouncedCallback } from '../_debounce'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'reverb' }>
  onChange(patch: Partial<{ size: number; decay: number; mix: number }>): void
}

export function ReverbPanel({ slot, onChange }: Props) {
  const debouncedOnChange = useDebouncedCallback(onChange, 300)
  const sizeNorm = slot.params.size
  const decayNorm = slot.params.decay
  const mixNorm = slot.params.mix
  return (
    <>
      <input type="range" min="0" max="1" step="0.05" value={slot.params.size}
        onChange={(e) => debouncedOnChange({ size: Number(e.target.value) })}
        className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
      <Slider value={sizeNorm} />
      <Range left="tight" right="huge" />

      <input type="range" min="0" max="1" step="0.05" value={slot.params.decay}
        onChange={(e) => debouncedOnChange({ decay: Number(e.target.value) })}
        className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
      <Slider value={decayNorm} />
      <Range left="0" right="1" />

      <input type="range" min="0" max="1" step="0.05" value={slot.params.mix}
        onChange={(e) => debouncedOnChange({ mix: Number(e.target.value) })}
        className="absolute inset-0 z-10 h-[22px] cursor-pointer opacity-0" />
      <Slider value={mixNorm} />
      <Range left="dry" right="wet" />
    </>
  )
}
