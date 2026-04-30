// ABOUTME: Filter effect definition — single-knob lowpass/highpass/peak stub.
// ABOUTME: Real build()/Panel arrive in Task 1.4-1.8; registry contract only here.

import { register } from '../_internal'

register({
  kind: 'filter',
  displayName: 'Filter',
  defaultParams: { value: 0 },
  isNeutral: (p) => Math.abs(p.value) < 0.01,
  build: () => { throw new Error('filter.build not yet implemented (Task 1.4-1.8)') },
  Panel: () => null as never,
})
