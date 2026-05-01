// ABOUTME: EffectsRack — pedalboard slot list with dnd-kit reorder, +Add, Reset.
// ABOUTME: Each slot renders inside a SlotCard with title, value label, toggle, and remove.

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useSessionStore } from '../store/session'
import { engine } from '../audio/engine'
import { registry } from '../audio/effects/registry'
import { SlotCard } from '../components/SlotCard'
import { AddEffectMenu } from '../components/AddEffectMenu'
import type { EffectKind, Slot } from '../audio/effects/types'

function valueLabel(slot: Slot): string {
  switch (slot.kind) {
    case 'crusher':
      return `${slot.params.bitDepth}-bit`
    case 'srhold':
      return `${slot.params.sampleRateHz} Hz`
    case 'pitch':
      return `${slot.params.semitones >= 0 ? '+' : ''}${slot.params.semitones.toFixed(0)} st  ${slot.params.speed.toFixed(2)}x`
    case 'filter': {
      const v = slot.params.value
      if (Math.abs(v) < 0.05) return 'neutral'
      return `${v < 0 ? 'LP' : 'HP'} ${Math.round(Math.abs(v) * 100)}%`
    }
    case 'echo':
      return `mix ${slot.params.mix.toFixed(2)}`
    case 'reverb':
      return `mix ${slot.params.mix.toFixed(2)}`
    case 'vinyl303':
      return `comp ${slot.params.comp}`
    case 'vinyl404':
      return `freq ${slot.params.frequency}`
    case 'cassette':
      return `age ${slot.params.ageYears}y`
  }
}

export function EffectsRack() {
  const chain = useSessionStore((s) => s.chain)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const newIndex = chain.findIndex((s) => s.id === over.id)
    useSessionStore.getState().reorderSlot(String(active.id), newIndex)
    engine.rebuildChain(useSessionStore.getState().chain)
  }

  return (
    <div className="px-[22px] pt-[14px]">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-rmai-mut">effects rack</span>
        <button
          onClick={() => {
            useSessionStore.getState().resetChain()
            engine.rebuildChain(useSessionStore.getState().chain)
          }}
          className="font-mono text-xs text-rmai-mut"
        >
          Reset
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={chain.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {chain.map((slot, i) => {
            const def = registry.get(slot.kind)
            if (!def) return null
            const Panel = def.Panel
            const defaultExpanded = true  // always open on mount; echo/reverb only appear when user explicitly adds them
            return (
              <SlotCard
                key={slot.id}
                id={slot.id}
                title={def.displayName}
                valueLabel={valueLabel(slot)}
                position={i + 1}
                total={chain.length}
                enabled={slot.enabled}
                defaultExpanded={defaultExpanded}
                onToggleEnabled={() => {
                  useSessionStore.getState().toggleEnabled(slot.id)
                  engine.rebuildChain(useSessionStore.getState().chain)
                }}
                onRemove={() => {
                  useSessionStore.getState().removeSlot(slot.id)
                  engine.rebuildChain(useSessionStore.getState().chain)
                }}
              >
                <Panel
                  slot={slot as never}
                  onChange={(patch) => {
                    useSessionStore.getState().setSlotParams(slot.id, patch as never)
                    const updated = useSessionStore.getState().chain.find((s) => s.id === slot.id)
                    if (updated) engine.updateSlotParams(slot.id, updated.params)
                  }}
                />
              </SlotCard>
            )
          })}
        </SortableContext>
      </DndContext>

      <AddEffectMenu
        onAdd={(kind: EffectKind) => {
          useSessionStore.getState().addSlot(kind)
          engine.rebuildChain(useSessionStore.getState().chain)
        }}
      />
    </div>
  )
}
