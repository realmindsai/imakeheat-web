import { test, expect } from '@playwright/test'

const PRIMING = 128 // one 128-sample block, per spec §5.7
const EPS = 1e-4    // float epsilon for cross-implementation comparison

test('neutral parity: WSOLA path equals legacy BufferSource path', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(async () => {
    const sr = 48000
    const dur = 0.3
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      ch[i] =
        0.3 * Math.sin((2 * Math.PI * 220 * i) / sr) +
        0.2 * Math.sin((2 * Math.PI * 880 * i) / sr) +
        0.1 * Math.sin((2 * Math.PI * 3300 * i) / sr)
    }
    ch[Math.floor(N * 0.5)] += 0.5 // click transient
    const payload = {
      sourcePcm: [Array.from(ch)],
      sampleRate: sr,
      effects: { bitDepth: 16 as const, sampleRateHz: sr, pitchSemitones: 0, speed: 1, filterValue: 0 },
      trim: { startSec: 0, endSec: dur },
    }
    const wsola = await window.__run({ ...payload, kind: 'render' })
    const legacy = await window.__run({ ...payload, kind: 'render-legacy' })
    return { wsola, legacy }
  })

  expect(result.wsola.pcm[0].length).toBeGreaterThan(0)
  expect(result.legacy.pcm[0].length).toBeGreaterThan(0)
  // Lengths within ±1 priming block.
  expect(Math.abs(result.wsola.pcm[0].length - result.legacy.pcm[0].length)).toBeLessThanOrEqual(PRIMING)

  // Both renders must contain meaningful audio — protects against the
  // false-positive where one path silently emits zeros.
  function rms(buf: number[]): number {
    let s = 0
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
    return Math.sqrt(s / buf.length)
  }
  expect(rms(result.wsola.pcm[0])).toBeGreaterThan(0.05)
  expect(rms(result.legacy.pcm[0])).toBeGreaterThan(0.05)

  // Compare from the latest priming offset onward, in the overlap region.
  const start = PRIMING
  const end = Math.min(result.wsola.pcm[0].length, result.legacy.pcm[0].length)
  let maxDiff = 0
  for (let i = start; i < end; i++) {
    const d = Math.abs(result.wsola.pcm[0][i] - result.legacy.pcm[0][i])
    if (d > maxDiff) maxDiff = d
  }
  expect(maxDiff).toBeLessThan(EPS)
})
