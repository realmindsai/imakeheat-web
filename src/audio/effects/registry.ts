// ABOUTME: Registry — public lookup table from EffectKind to its EffectDefinition.
// ABOUTME: Importing this module triggers every definition's side-effect registration.

import type { EffectDefinition, EffectKind } from './types'
import { _registry } from './_internal'

export { register } from './_internal'

export const registry: ReadonlyMap<EffectKind, EffectDefinition> = _registry

// Side-effect imports populate the registry; the order here is the canonical UI
// order in the +Add menu. Definitions import `register` from `./_internal` (not
// from this module), so there is no import cycle to race this module's body.
import './crusher/definition'
import './srhold/definition'
import './pitch/definition'
import './filter/definition'
import './echo/definition'
import './reverb/definition'
import './vinyl303/definition'
import './vinyl404/definition'
