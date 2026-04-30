import { test, expect } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

function chain303(params: { comp: number; noise: number; wowFlutter: number; level: number }): Chain {
  return [{ id: 'v', kind: 'vinyl303', enabled: true, params }]
}

function rms(xs: number[]): number {
  let s = 0
  for (const x of xs) s += x * x
  return Math.sqrt(s / xs.length)
}

test('neutral 303 VinylSim leaves a tone essentially unchanged', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(async ({ chain }) => {
    const sr = 48000
    const dur = 0.25
    const n = Math.round(sr * dur)
    const ch = new Float32Array(n)
    for (let i = 0; i < n; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch)],
      sampleRate: sr,
      chain,
      trim: { startSec: 0, endSec: dur },
    })
  }, { chain: chain303({ comp: 0, noise: 0, wowFlutter: 0, level: 100 }) })

  const inputRms = 0.5 / Math.sqrt(2)
  expect(Math.abs(rms(result.pcm[0]) - inputRms)).toBeLessThan(0.01)
})

test('303 VinylSim noise raises the silence floor', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(async ({ chain }) => {
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
  }, { chain: chain303({ comp: 0, noise: 100, wowFlutter: 0, level: 100 }) })

  expect(rms(result.pcm[0])).toBeGreaterThan(0.003)
})

test('303 VinylSim preserves stereo symmetry for identical stereo input', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(async ({ chain }) => {
    const sr = 48000
    const dur = 0.3
    const n = Math.round(sr * dur)
    const ch = new Float32Array(n)
    for (let i = 0; i < n; i++) ch[i] = 0.4 * Math.sin((2 * Math.PI * 330 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch), Array.from(ch)],
      sampleRate: sr,
      chain,
      trim: { startSec: 0, endSec: dur },
    })
  }, { chain: chain303({ comp: 45, noise: 25, wowFlutter: 30, level: 100 }) })

  for (let i = 0; i < result.pcm[0].length; i++) {
    expect(result.pcm[0][i]).toBe(result.pcm[1][i])
  }
})
