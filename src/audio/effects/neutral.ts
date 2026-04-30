// ABOUTME: Dispatches isNeutral(slot) to the slot's registered EffectDefinition.
// ABOUTME: Used by graph builders to skip slots that would be sonic no-ops.

import { registry } from './registry'
import type { Slot } from './types'

export function isNeutral(slot: Slot): boolean {
  const def = registry.get(slot.kind)
  if (!def) return true
  return def.isNeutral(slot.params as never)
}
