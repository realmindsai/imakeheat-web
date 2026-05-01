// ABOUTME: Phase 2 integration checks for offline rendering with new delay effects.
// ABOUTME: Verifies delayed/tail energy appears where dry-only output would be silent.

import { test, expect } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

const SR = 48000

function impulseSource(): number[] {
  const a = new Float32Array(SR)
  a[0] = 1
  return Array.from(a)
}

test('offline render: timeCtrlDly produces delayed energy', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const chain: Chain = [
    { id: 'd1', kind: 'timeCtrlDly', enabled: true, params: { timeMs: 120, feedback: 0, mix: 1, ducking: 0 } },
  ]

  const result = await page.evaluate(async ({ src, chain }) => {
    return await window.__run({
      kind: 'render',
      sourcePcm: [src],
      sampleRate: 48000,
      chain,
      trim: { startSec: 0, endSec: 1 },
    })
  }, { src: impulseSource(), chain })

  const out = result.pcm[0]
  const delayIdx = Math.floor(0.12 * SR)
  expect(Math.abs(out[delayIdx])).toBeGreaterThan(0.8)
  expect(Math.abs(out[0])).toBeLessThan(1e-5)
})

test('offline render: tapeEcho produces tail beyond 1s trim window', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const chain: Chain = [
    { id: 't1', kind: 'tapeEcho', enabled: true, params: { timeMs: 400, feedback: 0.6, mix: 1, wowFlutter: 0, tone: 1 } },
  ]

  const result = await page.evaluate(async ({ src, chain }) => {
    return await window.__run({
      kind: 'render',
      sourcePcm: [src],
      sampleRate: 48000,
      chain,
      trim: { startSec: 0, endSec: 1 },
    })
  }, { src: impulseSource(), chain })

  const out = result.pcm[0]
  // Tail must exist in padded region after 1 second.
  const tailStart = SR
  let tailEnergy = 0
  for (let i = tailStart; i < Math.min(out.length, tailStart + SR); i++) {
    tailEnergy += Math.abs(out[i])
  }
  expect(tailEnergy).toBeGreaterThan(0.1)
})
