// ABOUTME: Crusher effect definition — bit-depth reduction stub.
// ABOUTME: Real build()/Panel arrive in Task 1.4; registry contract only here.

import { register } from '../_internal'

register({
  kind: 'crusher',
  displayName: 'Crusher',
  defaultParams: { bitDepth: 16 as const },
  isNeutral: (p) => p.bitDepth === 16,
  build: () => { throw new Error('crusher.build not yet implemented (Task 1.4-1.8)') },
  Panel: () => null as never,
})
