import { test, expect } from '@playwright/test'

function makeSine(freq: number, amp: number, durSec: number, sr: number): number[] {
  const n = Math.floor(durSec * sr)
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr)
  return out
}

function rms(xs: number[]): number {
  let s = 0
  for (const v of xs) s += v * v
  return Math.sqrt(s / xs.length)
}

test('offline render at bitDepth=12 boosts a small-signal sine relative to bitDepth=16', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  // -6 dBFS sine, far below the 12-bit lattice noise floor.
  const sr = 48000
  const sig = makeSine(1000, 0.5, 0.5, sr)
  const inRms = rms(sig)

  const baseEffects = {
    bitDepth: 16 as const,
    sampleRateHz: 48000,
    pitchSemitones: 0,
    speed: 1,
    filterValue: 0,
  }

  const result16 = await page.evaluate(async ({ pcm, sr, effects }) => {
    return await window.__run({
      kind: 'render',
      sourcePcm: [pcm],
      sampleRate: sr,
      effects,
      trim: { startSec: 0, endSec: pcm.length / sr },
    })
  }, { pcm: sig, sr, effects: baseEffects })

  const result12 = await page.evaluate(async ({ pcm, sr, effects }) => {
    return await window.__run({
      kind: 'render',
      sourcePcm: [pcm],
      sampleRate: sr,
      effects: { ...effects, bitDepth: 12 },
      trim: { startSec: 0, endSec: pcm.length / sr },
    })
  }, { pcm: sig, sr, effects: baseEffects })

  const out16Rms = rms(result16.pcm[0])
  const out12Rms = rms(result12.pcm[0])

  // 16-bit path is essentially identity; RMS ~= input.
  expect(Math.abs(out16Rms / inRms - 1)).toBeLessThan(0.05)

  // 12-bit path: +6 dB pre-quantize drive → RMS ratio noticeably above 1.
  // WSOLA + offline rendering introduces some envelope smearing, so we use a
  // looser tolerance than the unit test. Empirically ≈ ×1.625.
  expect(out12Rms / inRms).toBeGreaterThan(1.55)
  expect(out12Rms / inRms).toBeLessThan(1.70)
})
