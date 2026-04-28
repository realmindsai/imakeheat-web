import { test, expect } from '@playwright/test'

test('stereo input with L === R produces stereo output with L === R', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(async () => {
    const sr = 48000
    const dur = 0.5
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch), Array.from(ch)],
      sampleRate: sr,
      effects: { bitDepth: 4, sampleRateHz: 12000, pitchSemitones: -3, filterValue: -0.5 },
      trim: { startSec: 0, endSec: dur },
    })
  })

  expect(result.pcm.length).toBe(2)
  expect(result.length).toBeGreaterThan(0)
  for (let i = 0; i < result.pcm[0].length; i++) {
    expect(result.pcm[0][i]).toBe(result.pcm[1][i])
  }
})
