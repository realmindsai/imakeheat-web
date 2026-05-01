import { expect, test } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

function rms(xs: number[]): number {
  let s = 0
  for (const x of xs) s += x * x
  return Math.sqrt(s / xs.length)
}

function meanAbsDiff(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

async function renderTone(
  page: import('@playwright/test').Page,
  chain: Chain,
  freq = 440,
) {
  return page.evaluate(
    async ({ chainValue, freqValue }) => {
      const sr = 48000
      const dur = 0.5
      const n = Math.round(sr * dur)
      const ch = new Float32Array(n)
      for (let i = 0; i < n; i++) ch[i] = 0.4 * Math.sin((2 * Math.PI * freqValue * i) / sr)
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain: chainValue,
        trim: { startSec: 0, endSec: dur },
      })
    },
    { chainValue: chain, freqValue: freq },
  )
}

test('Phase 1 effects are transparent at neutral defaults and audible when pushed', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const neutralCases: Chain[] = [
    [{ id: 'i', kind: 'isolator', enabled: true, params: { low: 0, mid: 0, high: 0 } }],
    [{
      id: 'e',
      kind: 'equalizer',
      enabled: true,
      params: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 80, midFreq: 1000, highFreq: 8000 },
    }],
    [{
      id: 'f',
      kind: 'filterDrive',
      enabled: true,
      params: { cutoffHz: 16000, resonance: 0, drive: 0, filterType: 'lowpass', lowFreq: 200, lowGain: 0 },
    }],
    [{ id: 'c', kind: 'compressor', enabled: true, params: { sustain: 0, attack: 50, ratio: 0, level: 100 } }],
    [{ id: 'l', kind: 'loFi', enabled: true, params: { preFilt: 1, lofiType: 1, tone: 0, cutoffHz: 8000, balance: 0, level: 100 } }],
  ]

  for (const chain of neutralCases) {
    const dry = await renderTone(page, [])
    const neutral = await renderTone(page, chain)
    expect(meanAbsDiff(dry.pcm[0], neutral.pcm[0])).toBeLessThan(0.002)
  }

  const wetLoFi = await renderTone(page, [
    {
      id: 'l',
      kind: 'loFi',
      enabled: true,
      params: { preFilt: 3, lofiType: 6, tone: -35, cutoffHz: 1200, balance: 100, level: 100 },
    },
  ])
  const dry = await renderTone(page, [])
  expect(meanAbsDiff(dry.pcm[0], wetLoFi.pcm[0])).toBeGreaterThan(0.02)
  expect(rms(wetLoFi.pcm[0])).toBeGreaterThan(0.001)
})

test('Filter+Drive order with Compressor is non-commutative', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const a = await renderTone(page, [
    {
      id: 'f',
      kind: 'filterDrive',
      enabled: true,
      params: { cutoffHz: 1800, resonance: 35, drive: 45, filterType: 'lowpass', lowFreq: 180, lowGain: 6 },
    },
    { id: 'c', kind: 'compressor', enabled: true, params: { sustain: 70, attack: 20, ratio: 60, level: 90 } },
  ])

  const b = await renderTone(page, [
    { id: 'c', kind: 'compressor', enabled: true, params: { sustain: 70, attack: 20, ratio: 60, level: 90 } },
    {
      id: 'f',
      kind: 'filterDrive',
      enabled: true,
      params: { cutoffHz: 1800, resonance: 35, drive: 45, filterType: 'lowpass', lowFreq: 180, lowGain: 6 },
    },
  ])

  expect(meanAbsDiff(a.pcm[0], b.pcm[0])).toBeGreaterThan(0.01)
})
