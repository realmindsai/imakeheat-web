// ABOUTME: Echo effect definition — delay/feedback/mix stub.
// ABOUTME: Real build()/Panel arrive in Task 1.4-1.8; registry contract only here.

import { register } from '../_internal'

register({
  kind: 'echo',
  displayName: 'Echo',
  defaultParams: { timeMs: 250, feedback: 0.4, mix: 0 },
  isNeutral: (p) => p.mix < 0.05,
  build: () => { throw new Error('echo.build not yet implemented (Task 1.4-1.8)') },
  Panel: () => null as never,
})
