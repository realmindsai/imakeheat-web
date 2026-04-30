// ABOUTME: Crusher slot panel — bit-depth segmented selector (lift-and-shift from EffectsRack).
// ABOUTME: Receives the current Slot and an onChange callback; emits {bitDepth} patches.

import type { Slot } from '../types'

const bitDepths = [2, 4, 8, 12, 16] as const

interface Props {
  slot: Extract<Slot, { kind: 'crusher' }>
  onChange(patch: Partial<{ bitDepth: 2 | 4 | 8 | 12 | 16 }>): void
}

export function CrusherPanel({ slot, onChange }: Props) {
  return (
    <div className="mt-2 flex gap-1">
      {bitDepths.map((b) => (
        <button
          key={b}
          onClick={() => onChange({ bitDepth: b })}
          className={`flex-1 rounded-md py-[7px] font-mono text-[12px] font-semibold ${
            slot.params.bitDepth === b
              ? 'border border-rmai-fg1 bg-rmai-fg1 text-white'
              : 'border border-rmai-border bg-white text-rmai-fg1'
          }`}
        >
          {b}
        </button>
      ))}
    </div>
  )
}
