// ABOUTME: Pitch effect definition — semitone shift + speed stub.
// ABOUTME: Real build()/Panel arrive in Task 1.4-1.8; registry contract only here.

import { register } from '../_internal'

register({
  kind: 'pitch',
  displayName: 'Pitch',
  defaultParams: { semitones: 0, speed: 1 },
  isNeutral: (p) => p.semitones === 0 && p.speed === 1,
  build: () => { throw new Error('pitch.build not yet implemented (Task 1.4-1.8)') },
  Panel: () => null as never,
})
