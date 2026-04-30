// ABOUTME: Internal registry storage shared by `registry.ts` and definition modules.
// ABOUTME: Lives in its own module so definitions can import `register` without
// ABOUTME: pulling on the cycle (registry.ts side-effect-imports the definitions).

import type { EffectDefinition, EffectKind } from './types'

export const _registry = new Map<EffectKind, EffectDefinition>()

export function register<K extends EffectKind>(def: EffectDefinition<K>): void {
  _registry.set(def.kind, def as unknown as EffectDefinition)
}
