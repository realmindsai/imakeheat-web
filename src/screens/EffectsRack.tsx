// ABOUTME: Temporary minimum EffectsRack — slot panels in chain order, no drag/toggle/Add.
// ABOUTME: Real pedalboard UI lands in Chunk 3 (dnd-kit, +Add, ×Remove, Reset).

import { Eyebrow } from '../components/Eyebrow'
import { registry } from '../audio/effects/registry'
import { useSessionStore } from '../store/session'
import { engine } from '../audio/engine'
import type { Slot } from '../audio/effects/types'

function valueLabel(slot: Slot): string {
  switch (slot.kind) {
    case 'crusher': return `${slot.params.bitDepth}-bit`
    case 'srhold':  return `${slot.params.sampleRateHz} Hz`
    case 'pitch':   return `${slot.params.semitones >= 0 ? '+' : ''}${slot.params.semitones.toFixed(0)} st  ${slot.params.speed.toFixed(2)}x`
    case 'filter':  {
      const v = slot.params.value
      if (Math.abs(v) < 0.05) return 'neutral'
      return `${v < 0 ? 'LP' : 'HP'} ${Math.round(Math.abs(v) * 100)}%`
    }
    case 'echo':    return `mix ${slot.params.mix.toFixed(2)}`
    case 'reverb':  return `mix ${slot.params.mix.toFixed(2)}`
  }
}

export function EffectsRack() {
  const chain = useSessionStore((s) => s.chain)
  return (
    <div className="px-[22px] pt-[14px]">
      <Eyebrow className="mb-[10px] !text-rmai-mut">effects rack</Eyebrow>
      {chain.map((slot) => {
        const def = registry.get(slot.kind)
        if (!def) return null
        const Panel = def.Panel
        return (
          <div key={slot.id} className="mb-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-mono text-rmai-mut">{def.displayName}</span>
              <span className="font-mono text-[12px] text-rmai-fg1">{valueLabel(slot)}</span>
            </div>
            <Panel
              slot={slot as never}
              onChange={(patch) => {
                useSessionStore.getState().setSlotParams(slot.id, patch as never)
                const updated = useSessionStore.getState().chain.find(s => s.id === slot.id)
                if (updated) engine.updateSlotParams(slot.id, updated.params)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
