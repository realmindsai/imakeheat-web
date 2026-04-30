// ABOUTME: Reverb effect definition — size/decay/mix stub.
// ABOUTME: Real build()/Panel arrive in Task 1.4-1.8; registry contract only here.

import { register } from '../_internal'

register({
  kind: 'reverb',
  displayName: 'Reverb',
  defaultParams: { size: 0.5, decay: 0.5, mix: 0 },
  isNeutral: (p) => p.mix < 0.05,
  build: () => { throw new Error('reverb.build not yet implemented (Task 1.4-1.8)') },
  Panel: () => null as never,
})
