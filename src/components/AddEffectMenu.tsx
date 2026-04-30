// ABOUTME: AddEffectMenu — toggles a dropdown of registered effects; appends one to the chain.
// ABOUTME: Closes on outside click. Effect order in the menu follows registry insertion order.

import { useState, useEffect, useRef } from 'react'
import { registry } from '../audio/effects/registry'
import type { EffectKind } from '../audio/effects/types'

interface Props {
  onAdd(kind: EffectKind): void
}

export function AddEffectMenu({ onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative mt-2">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full rounded-md border border-rmai-border py-2 font-mono text-sm"
      >
        + Add effect
      </button>
      {open ? (
        <div role="menu" className="absolute mt-1 w-full rounded-md border border-rmai-border bg-white">
          {Array.from(registry.values()).map((def) => (
            <button
              key={def.kind}
              role="menuitem"
              onClick={() => {
                onAdd(def.kind)
                setOpen(false)
              }}
              className="block w-full px-3 py-2 text-left font-mono text-sm hover:bg-rmai-bg"
            >
              {def.displayName}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
