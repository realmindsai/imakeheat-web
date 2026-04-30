// ABOUTME: Pitch EffectDefinition — control-only slot; build() returns a passthrough GainNode.
// ABOUTME: WSOLA upstream of the chain owns the actual pitch/speed DSP (engine routes apply()).

import { register } from '../_internal'
import type { EffectDefinition } from '../types'
import { buildPitchPassthrough } from '../pitch-control'
import { PitchPanel } from './panel'

const def: EffectDefinition<'pitch'> = {
  kind: 'pitch',
  displayName: 'Pitch',
  defaultParams: { semitones: 0, speed: 1 },
  isNeutral: (p) => p.semitones === 0 && p.speed === 1,
  build: (ctx) => buildPitchPassthrough(ctx),
  Panel: PitchPanel,
}
register(def)
