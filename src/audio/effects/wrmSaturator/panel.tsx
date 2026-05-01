// ABOUTME: Placeholder WrmSaturator panel for phase2 registry/type surface task.
// ABOUTME: Renders null with typed props until UI controls land in later tasks.

import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'wrmSaturator' }>
  onChange(patch: Partial<{ amount: number; bias: number; tone: number; mix: number; level: number }>): void
}

export function WrmSaturatorPanel(_: Props) {
  return null
}
