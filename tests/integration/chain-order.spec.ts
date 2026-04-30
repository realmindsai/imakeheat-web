// ABOUTME: Chain-order acceptance gate. Proves the v2 pedalboard actually walks the
// ABOUTME: chain in user-specified order, not a fixed legacy order. RMS(A - B) > 0.01.

import { test, expect } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

const SR = 48000

// mulberry32 PRNG — bit-deterministic across runs/platforms.
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Source: 1s @ 48kHz, mono. Dirac at index 0, then 100ms of pink noise (seeded),
// then silence to the end. Both transient and broadband content so the chain
// has something to mangle differently in each order.
function buildSource(): number[] {
  const N = SR  // 1 second
  const a = new Float32Array(N)
  a[0] = 1.0   // Dirac
  const rng = mulberry32(0xC0FFEE)
  // Pink-ish noise via running average — not spectrally accurate pink, but
  // broadband, deterministic, and sufficient for "order matters" detection.
  let prev = 0
  const noiseEnd = Math.floor(SR * 0.1)
  for (let i = 1; i < noiseEnd; i++) {
    const white = rng() * 2 - 1
    prev = 0.97 * prev + 0.03 * white   // simple lowpass, gives broadband-ish coloration
    a[i] += prev * 0.3
  }
  return Array.from(a)
}

test('chain order matters: [crusher@4bit, reverb] differs from [reverb, crusher@4bit]', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const source = buildSource()

  const chainA: Chain = [
    { id: 'c', kind: 'crusher', enabled: true, params: { bitDepth: 4 } },
    { id: 'r', kind: 'reverb',  enabled: true, params: { size: 0.5, decay: 0.7, mix: 0.6 } },
  ]
  const chainB: Chain = [
    { id: 'r', kind: 'reverb',  enabled: true, params: { size: 0.5, decay: 0.7, mix: 0.6 } },
    { id: 'c', kind: 'crusher', enabled: true, params: { bitDepth: 4 } },
  ]

  const aResult = await page.evaluate(async ({ src, chain }) => {
    return await window.__run({
      kind: 'render', sourcePcm: [src], sampleRate: 48000, chain,
      trim: { startSec: 0, endSec: 1 },
    })
  }, { src: source, chain: chainA })

  const bResult = await page.evaluate(async ({ src, chain }) => {
    return await window.__run({
      kind: 'render', sourcePcm: [src], sampleRate: 48000, chain,
      trim: { startSec: 0, endSec: 1 },
    })
  }, { src: source, chain: chainB })

  expect(aResult.length).toBe(bResult.length)

  const a = aResult.pcm[0]
  const b = bResult.pcm[0]
  let sumSq = 0
  for (let i = 0; i < a.length; i++) sumSq += (a[i] - b[i]) ** 2
  const rms = Math.sqrt(sumSq / a.length)
  expect(rms).toBeGreaterThan(0.01)
})
