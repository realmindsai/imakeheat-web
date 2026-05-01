import { test, expect } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

function chainCassette(
  params: {
    tone: number
    hiss: number
    ageYears: number
    drive: number
    wowFlutter: number
    catch: number
  },
): Chain {
  return [{ id: 'c', kind: 'cassette', enabled: true, params }]
}

function rms(xs: number[]): number {
  let s = 0
  for (const x of xs) s += x * x
  return Math.sqrt(s / xs.length)
}

function crest(xs: number[]): number {
  let peak = 0
  for (const x of xs) peak = Math.max(peak, Math.abs(x))
  return peak / Math.max(1e-9, rms(xs))
}

function minWindowRms(xs: number[], size = 256): number {
  let min = Number.POSITIVE_INFINITY
  for (let start = 0; start + size <= xs.length; start += size) {
    let s = 0
    for (let i = start; i < start + size; i++) s += xs[i] * xs[i]
    min = Math.min(min, Math.sqrt(s / size))
  }
  return min
}

function crossingJitter(xs: number[]): number {
  const crossings: number[] = []
  for (let i = 1; i < xs.length; i++) {
    if (xs[i - 1] <= 0 && xs[i] > 0) crossings.push(i)
  }
  const periods: number[] = []
  for (let i = 1; i < crossings.length; i++) periods.push(crossings[i] - crossings[i - 1])
  const mean = periods.reduce((a, b) => a + b, 0) / Math.max(1, periods.length)
  let variance = 0
  for (const p of periods) variance += (p - mean) ** 2
  return Math.sqrt(variance / Math.max(1, periods.length))
}

test('Cassette Sim hiss raises the silence floor', async ({ page }) => {
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
    { chain: chainCassette({ tone: 50, hiss: 100, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 }) },
  )

  expect(rms(result.pcm[0])).toBeGreaterThan(0.0015)
})

test('Cassette Sim drive reduces crest factor on a pulsed tone', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const result = await page.evaluate(
    async ({ chain }) => {
      const sr = 48000
      const dur = 0.4
      const n = Math.round(sr * dur)
      const ch = new Float32Array(n)
      for (let i = 0; i < n; i++) ch[i] = 0.9 * Math.sin((2 * Math.PI * 220 * i) / sr)
      for (let i = 0; i < n; i += 300) ch[i] = 1
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain,
        trim: { startSec: 0, endSec: dur },
      })
    },
    { chain: chainCassette({ tone: 50, hiss: 0, ageYears: 0, drive: 100, wowFlutter: 0, catch: 0 }) },
  )

  const dryCrest = crest(
    await page.evaluate(async () => {
      const sr = 48000
      const dur = 0.4
      const n = Math.round(sr * dur)
      const ch = new Float32Array(n)
      for (let i = 0; i < n; i++) ch[i] = 0.9 * Math.sin((2 * Math.PI * 220 * i) / sr)
      for (let i = 0; i < n; i += 300) ch[i] = 1
      const dry = await window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain: [],
        trim: { startSec: 0, endSec: dur },
      })
      return dry.pcm[0]
    }),
  )

  expect(crest(result.pcm[0])).toBeLessThan(dryCrest)
})

test('Cassette Sim wow/flutter increases zero-crossing jitter', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const [dry, wet] = await Promise.all([
    page.evaluate(async ({ chain }) => {
      const sr = 48000
      const dur = 0.5
      const n = Math.round(sr * dur)
      const ch = new Float32Array(n)
      for (let i = 0; i < n; i++) ch[i] = 0.45 * Math.sin((2 * Math.PI * 440 * i) / sr)
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain,
        trim: { startSec: 0, endSec: dur },
      })
    }, { chain: chainCassette({ tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 }) }),
    page.evaluate(async ({ chain }) => {
      const sr = 48000
      const dur = 0.5
      const n = Math.round(sr * dur)
      const ch = new Float32Array(n)
      for (let i = 0; i < n; i++) ch[i] = 0.45 * Math.sin((2 * Math.PI * 440 * i) / sr)
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain,
        trim: { startSec: 0, endSec: dur },
      })
    }, { chain: chainCassette({ tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 100, catch: 0 }) }),
  ])

  expect(crossingJitter(wet.pcm[0])).toBeGreaterThan(crossingJitter(dry.pcm[0]) + 0.2)
})

test('Cassette Sim catch introduces intermittent level dents', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const [dry, wet] = await Promise.all([
    page.evaluate(async ({ chain }) => {
      const sr = 48000
      const dur = 0.8
      const n = Math.round(sr * dur)
      const ch = new Float32Array(n)
      for (let i = 0; i < n; i++) ch[i] = 0.45 * Math.sin((2 * Math.PI * 440 * i) / sr)
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain,
        trim: { startSec: 0, endSec: dur },
      })
    }, { chain: chainCassette({ tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 0 }) }),
    page.evaluate(async ({ chain }) => {
      const sr = 48000
      const dur = 0.8
      const n = Math.round(sr * dur)
      const ch = new Float32Array(n)
      for (let i = 0; i < n; i++) ch[i] = 0.45 * Math.sin((2 * Math.PI * 440 * i) / sr)
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain,
        trim: { startSec: 0, endSec: dur },
      })
    }, { chain: chainCassette({ tone: 50, hiss: 0, ageYears: 0, drive: 0, wowFlutter: 0, catch: 100 }) }),
  ])

  expect(minWindowRms(wet.pcm[0])).toBeLessThan(minWindowRms(dry.pcm[0]) * 0.85)
})
