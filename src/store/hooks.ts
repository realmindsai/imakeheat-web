// ABOUTME: React hooks for the exports store using useSyncExternalStore for tearing-free reads.
// ABOUTME: Lazy-loads on first subscriber; keeps module-level caches to avoid re-fetching on every render.

import { useCallback, useSyncExternalStore } from 'react'
import {
  countExports,
  listExports,
  onExportsChanged,
  type ExportRecord,
} from './exports'

let cachedItems: ExportRecord[] = []
let cachedCount = 0

let itemsLoaded = false
let countLoaded = false

function refreshItems() {
  void listExports().then((all) => {
    cachedItems = all
    for (const cb of itemsListeners) cb()
  })
}
function refreshCount() {
  void countExports().then((n) => {
    cachedCount = n
    for (const cb of countListeners) cb()
  })
}

const itemsListeners = new Set<() => void>()
const countListeners = new Set<() => void>()

onExportsChanged(() => {
  refreshItems()
  refreshCount()
})

export function useExports(): ExportRecord[] {
  const subscribe = useCallback((cb: () => void) => {
    itemsListeners.add(cb)
    if (!itemsLoaded) {
      itemsLoaded = true
      refreshItems()
    }
    return () => {
      itemsListeners.delete(cb)
    }
  }, [])
  const getSnapshot = useCallback(() => cachedItems, [])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useExportsCount(): number {
  const subscribe = useCallback((cb: () => void) => {
    countListeners.add(cb)
    if (!countLoaded) {
      countLoaded = true
      refreshCount()
    }
    return () => {
      countListeners.delete(cb)
    }
  }, [])
  const getSnapshot = useCallback(() => cachedCount, [])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
