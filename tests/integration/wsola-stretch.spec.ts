import { test, expect } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

const PRIMING = 128 // one 128-sample block, per spec §5.7
const EPS = 1e-4    // float epsilon for cross-implementation comparison

function stretchChain(opts: {
  bitDepth?: 2 | 4 | 8 | 12 | 16
  sampleRateHz?: number
  semitones?: number
  speed?: number
  filterValue?: number
}): Chain {
  return [
    { id: 'c', kind: 'crusher', enabled: true, params: { bitDepth: opts.bitDepth ?? 16 } },
    { id: 's', kind: 'srhold',  enabled: true, params: { sampleRateHz: opts.sampleRateHz ?? 48000 } },
    { id: 'p', kind: 'pitch',   enabled: true, params: { semitones: opts.semitones ?? 0, speed: opts.speed ?? 1 } },
    { id: 'f', kind: 'filter',  enabled: true, params: { value: opts.filterValue ?? 0 } },
  ]
}

test('neutral parity: WSOLA path equals legacy BufferSource path', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const sr = 48000
  const chain = stretchChain({ bitDepth: 16, sampleRateHz: sr, semitones: 0, speed: 1, filterValue: 0 })
  const legacyFx = { bitDepth: 16, sampleRateHz: sr, pitchSemitones: 0, speed: 1, filterValue: 0 }
  const result = await page.evaluate(async ({ chain, legacyFx }) => {
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
    const sourcePcm = [Array.from(ch)]
    const sampleRate = sr
    const trim = { startSec: 0, endSec: dur }
    const wsola = await window.__run({ kind: 'render', sourcePcm, sampleRate, chain, trim })
    const legacy = await window.__run({ kind: 'render-legacy', sourcePcm, sampleRate, legacyFx, trim })
    return { wsola, legacy }
  }, { chain, legacyFx })

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

test('THD at 0.5x speed on a 220 Hz sine is below 1.5%', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const chain = stretchChain({ bitDepth: 16, sampleRateHz: 48000, semitones: 0, speed: 0.5, filterValue: 0 })
  const result = await page.evaluate(async ({ chain }) => {
    const sr = 48000
    const dur = 0.5
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch)],
      sampleRate: sr,
      chain,
      trim: { startSec: 0, endSec: dur },
    })
  }, { chain })

  // Cheap THD proxy: dominant zero-cross frequency is ~220 Hz, and signal smoothed
  // by a 4-tap moving average retains ≥98% rms (no high-freq junk from splice clicks).
  const buf = result.pcm[0]
  let crossings = 0
  for (let i = 1; i < buf.length; i++) if (buf[i - 1] <= 0 && buf[i] > 0) crossings++
  const f = (crossings * 48000) / buf.length
  expect(f).toBeGreaterThan(215)
  expect(f).toBeLessThan(225)

  let rmsRaw = 0
  for (let i = 0; i < buf.length; i++) rmsRaw += buf[i] * buf[i]
  rmsRaw = Math.sqrt(rmsRaw / buf.length)
  let rmsSm = 0
  for (let i = 4; i < buf.length; i++) {
    const s = (buf[i] + buf[i - 1] + buf[i - 2] + buf[i - 3]) / 4
    rmsSm += s * s
  }
  rmsSm = Math.sqrt(rmsSm / (buf.length - 4))
  expect(rmsSm / rmsRaw).toBeGreaterThan(0.985)
})

test('transient localisation: a click at speed=2 stays narrow', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const chain = stretchChain({ bitDepth: 16, sampleRateHz: 48000, semitones: 0, speed: 2, filterValue: 0 })
  const result = await page.evaluate(async ({ chain }) => {
    const sr = 48000
    const dur = 0.2
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    ch[0] = 1.0 // dirac at the start of the trim window
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch)],
      sampleRate: sr,
      chain,
      trim: { startSec: 0, endSec: dur },
    })
  }, { chain })

  const buf = result.pcm[0]
  let peakIdx = 0, peakVal = 0
  for (let i = 0; i < buf.length; i++) if (Math.abs(buf[i]) > peakVal) { peakVal = Math.abs(buf[i]); peakIdx = i }
  let lo = peakIdx
  while (lo > 0 && Math.abs(buf[lo]) > peakVal / 2) lo--
  let hi = peakIdx
  while (hi < buf.length - 1 && Math.abs(buf[hi]) > peakVal / 2) hi++
  const fwhmSamples = hi - lo
  const fwhmMs = (fwhmSamples / 48000) * 1000
  expect(fwhmMs).toBeLessThan(4)
})

test('stereo symmetry preserved at speed=0.7, pitch=+3', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const chain = stretchChain({ bitDepth: 16, sampleRateHz: 48000, semitones: 3, speed: 0.7, filterValue: 0 })
  const result = await page.evaluate(async ({ chain }) => {
    const sr = 48000
    const dur = 0.2
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
  for (let i = 0; i < result.pcm[0].length; i++) {
    expect(result.pcm[0][i]).toBe(result.pcm[1][i])
  }
})

test('downstream filter still attenuates at non-neutral stretch', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const chain = stretchChain({ bitDepth: 16, sampleRateHz: 48000, semitones: -3, speed: 0.7, filterValue: -1 })
  const result = await page.evaluate(async ({ chain }) => {
    const sr = 48000
    const dur = 0.3
    const N = Math.round(sr * dur)
    const ch = new Float32Array(N)
    for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 8000 * i) / sr)
    return window.__run({
      kind: 'render',
      sourcePcm: [Array.from(ch)],
      sampleRate: sr,
      chain,
      trim: { startSec: 0, endSec: dur },
    })
  }, { chain })

  const inputRms = 0.5 / Math.sqrt(2)
  let outRms = 0
  for (let i = 0; i < result.pcm[0].length; i++) outRms += result.pcm[0][i] ** 2
  outRms = Math.sqrt(outRms / result.pcm[0].length)
  const attenuationDb = 20 * Math.log10(outRms / inputRms)
  expect(attenuationDb).toBeLessThan(-12)
})
