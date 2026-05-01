// ABOUTME: Filter+Drive panel — cutoff, resonance, drive, type, and low-shelf recovery controls.
// ABOUTME: Uses SliderRow for consistent interaction with the slot-card's invisible range-input hitboxes.

import { SliderRow } from '../_slider_row'
import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'filterDrive' }>
  onChange(
    patch: Partial<{
      cutoffHz: number
      resonance: number
      drive: number
      filterType: 'lowpass' | 'highpass'
      lowFreq: number
      lowGain: number
    }>,
  ): void
}

export function FilterDrivePanel({ slot, onChange }: Props) {
  return (
    <>
      <SliderRow
        label="Cutoff"
        value={slot.params.cutoffHz}
        min={20}
        max={16000}
        step={1}
        left="20"
        right="16000"
        onChange={(cutoffHz) => onChange({ cutoffHz })}
      />
      <SliderRow
        label="Resonance"
        value={slot.params.resonance}
        min={0}
        max={100}
        step={1}
        left="soft"
        right="sharp"
        onChange={(resonance) => onChange({ resonance })}
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
      <div className="mt-2 flex gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-rmai-mut">
        <button
          className={slot.params.filterType === 'lowpass' ? 'underline' : ''}
          onClick={() => onChange({ filterType: 'lowpass' })}
        >
          LPF
        </button>
        <button
          className={slot.params.filterType === 'highpass' ? 'underline' : ''}
          onClick={() => onChange({ filterType: 'highpass' })}
        >
          HPF
        </button>
      </div>
      <SliderRow
        label="Low freq"
        value={slot.params.lowFreq}
        min={20}
        max={16000}
        step={1}
        left="20"
        right="16000"
        onChange={(lowFreq) => onChange({ lowFreq })}
        className="mt-2"
      />
      <SliderRow
        label="Low gain"
        value={slot.params.lowGain}
        min={-24}
        max={24}
        step={1}
        left="cut"
        right="boost"
        onChange={(lowGain) => onChange({ lowGain })}
        className="mt-2"
      />
    </>
  )
}
