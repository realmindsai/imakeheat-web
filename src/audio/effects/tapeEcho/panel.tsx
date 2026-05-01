// ABOUTME: Placeholder TapeEcho panel for phase2 registry/type surface task.
// ABOUTME: Renders null with typed props until UI controls land in later tasks.

import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'tapeEcho' }>
  onChange(patch: Partial<{ timeMs: number; feedback: number; mix: number; wowFlutter: number; tone: number }>): void
}

export function TapeEchoPanel(_: Props) {
  return null
}
