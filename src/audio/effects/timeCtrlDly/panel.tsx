// ABOUTME: Placeholder TimeCtrlDly panel for phase2 registry/type surface task.
// ABOUTME: Renders null with typed props until UI controls land in later tasks.

import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'timeCtrlDly' }>
  onChange(patch: Partial<{ timeMs: number; feedback: number; mix: number; ducking: number }>): void
}

export function TimeCtrlDlyPanel(_: Props) {
  return null
}
