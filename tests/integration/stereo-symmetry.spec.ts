import { test, expect } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

test('stereo input with L === R produces stereo output with L === R', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const chain: Chain = [
    { id: 'c', kind: 'crusher', enabled: true, params: { bitDepth: 4 } },
    { id: 's', kind: 'srhold',  enabled: true, params: { sampleRateHz: 12000 } },
    { id: 'p', kind: 'pitch',   enabled: true, params: { semitones: -3, speed: 1 } },
    { id: 'f', kind: 'filter',  enabled: true, params: { value: -0.5 } },
  ]
  const result = await page.evaluate(async ({ chain }) => {
    const sr = 48000
    const dur = 0.5
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch), Array.from(ch)],
      sampleRate: sr,
      chain,
      trim: { startSec: 0, endSec: dur },
    })
  }, { chain })

  expect(result.pcm.length).toBe(2)
  expect(result.length).toBeGreaterThan(0)
  for (let i = 0; i < result.pcm[0].length; i++) {
    expect(result.pcm[0][i]).toBe(result.pcm[1][i])
  }
})

test('reverb-only chain: stereo input with L === R produces stereo output with L === R', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const chain: Chain = [
    { id: 'r', kind: 'reverb', enabled: true, params: { size: 0.5, decay: 0.7, mix: 1 } },
  ]
  const result = await page.evaluate(async ({ chain }) => {
    const sr = 48000
    const dur = 0.5
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch), Array.from(ch)],
      sampleRate: sr,
      chain,
      trim: { startSec: 0, endSec: dur },
    })
  }, { chain })

  expect(result.pcm.length).toBe(2)
  expect(result.length).toBeGreaterThan(0)
  for (let i = 0; i < result.pcm[0].length; i++) {
    expect(result.pcm[0][i]).toBe(result.pcm[1][i])
  }
})
