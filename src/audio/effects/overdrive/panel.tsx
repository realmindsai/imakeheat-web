// ABOUTME: Placeholder Overdrive panel for phase2 registry/type surface task.
// ABOUTME: Renders null with typed props until UI controls land in later tasks.

import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'overdrive' }>
  onChange(patch: Partial<{ drive: number; tone: number; level: number; mix: number }>): void
}

export function OverdrivePanel(_: Props) {
  return null
}
