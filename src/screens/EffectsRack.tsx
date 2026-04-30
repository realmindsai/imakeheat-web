// ABOUTME: Temporary minimum EffectsRack — slot panels in chain order, no drag/toggle/Add.
// ABOUTME: Real pedalboard UI lands in Chunk 3 (dnd-kit, +Add, ×Remove, Reset).

import { registry } from '../audio/effects/registry'
import { useSessionStore } from '../store/session'
import { engine } from '../audio/engine'

export function EffectsRack() {
  const chain = useSessionStore((s) => s.chain)
  return (
    <div className="px-[22px] pt-[14px]">
      {chain.map((slot) => {
        const def = registry.get(slot.kind)
        if (!def) return null
        const Panel = def.Panel
        return (
          <div key={slot.id} className="mb-3">
            <div className="text-sm font-mono text-rmai-mut">{def.displayName}</div>
            <Panel
              slot={slot as any}
              onChange={(patch) => {
                useSessionStore.getState().setSlotParams(slot.id, patch)
                engine.updateSlotParams(slot.id, { ...slot.params, ...patch })
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
