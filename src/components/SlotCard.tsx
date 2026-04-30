// ABOUTME: SlotCard — generic wrapper around an effect's Panel; renders drag handle,
// ABOUTME: enabled toggle, expand/collapse caret, remove (×) button, and a value label.

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type ReactElement } from 'react'

interface Props {
  id: string
  title: string
  valueLabel: string
  position: number
  total: number
  enabled: boolean
  defaultExpanded: boolean
  onToggleEnabled(): void
  onRemove(): void
  children: ReactElement
}

export function SlotCard({
  id,
  title,
  valueLabel,
  position,
  total,
  enabled,
  defaultExpanded,
  onToggleEnabled,
  onRemove,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      role="group"
      aria-label={`${title}, position ${position} of ${total}`}
      className="mb-2 rounded-md border border-rmai-border bg-white"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${title}`}
          className="cursor-grab text-rmai-mut"
        >
          ⋮⋮
        </button>
        <div className="flex-1 font-mono text-sm">{title}</div>
        <span className="font-mono text-[12px] text-rmai-fg1">{valueLabel}</span>
        <button
          onClick={onToggleEnabled}
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${title}`}
          aria-pressed={enabled}
          className={enabled ? 'text-rmai-fg1' : 'text-rmai-mut'}
        >
          ●
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
          aria-expanded={expanded}
          className="text-rmai-mut"
        >
          {expanded ? '▼' : '▶'}
        </button>
        <button onClick={onRemove} aria-label={`Remove ${title}`} className="text-rmai-mut">
          ×
        </button>
      </div>
      {expanded ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  )
}
