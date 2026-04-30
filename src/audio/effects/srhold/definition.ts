// ABOUTME: SR-hold effect definition — sample-rate hold stub.
// ABOUTME: Real build()/Panel arrive in Task 1.4-1.8; registry contract only here.

import { register } from '../_internal'

register({
  kind: 'srhold',
  displayName: 'SR Hold',
  defaultParams: { sampleRateHz: 48000 },
  isNeutral: (p) => p.sampleRateHz >= 48000,
  build: () => { throw new Error('srhold.build not yet implemented (Task 1.4-1.8)') },
  Panel: () => null as never,
})
