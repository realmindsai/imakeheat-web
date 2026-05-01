// ABOUTME: Placeholder Distortion panel for phase2 registry/type surface task.
// ABOUTME: Renders null with typed props until UI controls land in later tasks.

import type { Slot } from '../types'

interface Props {
  slot: Extract<Slot, { kind: 'distortion' }>
  onChange(patch: Partial<{ drive: number; tone: number; level: number; mix: number }>): void
}

export function DistortionPanel(_: Props) {
  return null
}
