import { test, expect } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

function chain404(params: { frequency: number; noise: number; wowFlutter: number }): Chain {
  return [{ id: 'v', kind: 'vinyl404', enabled: true, params }]
}

function rms(xs: number[]): number {
  let s = 0
  for (const x of xs) s += x * x
  return Math.sqrt(s / xs.length)
}

test('frequency=0 attenuates an 8 kHz tone', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(
    async ({ chain }) => {
      const sr = 48000
      const dur = 0.2
      const n = Math.round(sr * dur)
      const ch = new Float32Array(n)
      for (let i = 0; i < n; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 8000 * i) / sr)
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain,
        trim: { startSec: 0, endSec: dur },
      })
    },
    { chain: chain404({ frequency: 0, noise: 0, wowFlutter: 0 }) },
  )

  expect(rms(result.pcm[0])).toBeLessThan(0.2)
})

test('404 VinylSim noise raises the silence floor', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(
    async ({ chain }) => {
      const sr = 48000
      const dur = 0.4
      const n = Math.round(sr * dur)
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(new Float32Array(n))],
        sampleRate: sr,
        chain,
        trim: { startSec: 0, endSec: dur },
      })
    },
    { chain: chain404({ frequency: 100, noise: 100, wowFlutter: 0 }) },
  )

  expect(rms(result.pcm[0])).toBeGreaterThan(0.002)
})
