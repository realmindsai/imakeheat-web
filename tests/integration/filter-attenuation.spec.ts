import { test, expect } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

function chainWith(filterValue: number, sr: number): Chain {
  return [
    { id: 'c', kind: 'crusher', enabled: true, params: { bitDepth: 16 } },
    { id: 's', kind: 'srhold',  enabled: true, params: { sampleRateHz: sr } },
    { id: 'p', kind: 'pitch',   enabled: true, params: { semitones: 0, speed: 1 } },
    { id: 'f', kind: 'filter',  enabled: true, params: { value: filterValue } },
  ]
}

test.describe('filter attenuation', () => {
  test('lowpass at filterValue=-1 attenuates 8 kHz tone', async ({ page }) => {
    await page.goto('/tests/integration/index.html')
    await expect(page.locator('#status')).toHaveText('ready')

    const sr = 48000
    const chain = chainWith(-1, sr)
    const result = await page.evaluate(async ({ chain, sr }) => {
      const dur = 0.2
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
    }, { chain, sr })

    const inputRms = 0.5 / Math.sqrt(2)
    const outputRms = Math.sqrt(result.pcm[0].reduce((s: number, v: number) => s + v * v, 0) / result.pcm[0].length)
    const attenuationDb = 20 * Math.log10(outputRms / inputRms)
    expect(attenuationDb).toBeLessThan(-12)
  })

  test('highpass at filterValue=+1 attenuates 200 Hz tone', async ({ page }) => {
    await page.goto('/tests/integration/index.html')
    await expect(page.locator('#status')).toHaveText('ready')

    const sr = 48000
    const chain = chainWith(1, sr)
    const result = await page.evaluate(async ({ chain, sr }) => {
      const dur = 0.2
      const N = Math.round(sr * dur)
      const ch = new Float32Array(N)
      for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 200 * i) / sr)
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain,
        trim: { startSec: 0, endSec: dur },
      })
    }, { chain, sr })

    const inputRms = 0.5 / Math.sqrt(2)
    const outputRms = Math.sqrt(result.pcm[0].reduce((s: number, v: number) => s + v * v, 0) / result.pcm[0].length)
    const attenuationDb = 20 * Math.log10(outputRms / inputRms)
    expect(attenuationDb).toBeLessThan(-12)
  })

  test('bypass at filterValue=0 leaves audio essentially unchanged', async ({ page }) => {
    await page.goto('/tests/integration/index.html')
    await expect(page.locator('#status')).toHaveText('ready')

    const sr = 48000
    const chain = chainWith(0, sr)
    const result = await page.evaluate(async ({ chain, sr }) => {
      const dur = 0.2
      const N = Math.round(sr * dur)
      const ch = new Float32Array(N)
      for (let i = 0; i < N; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / sr)
      return window.__run({
        kind: 'render',
        sourcePcm: [Array.from(ch)],
        sampleRate: sr,
        chain,
        trim: { startSec: 0, endSec: dur },
      })
    }, { chain, sr })

    const inputRms = 0.5 / Math.sqrt(2)
    const outputRms = Math.sqrt(result.pcm[0].reduce((s: number, v: number) => s + v * v, 0) / result.pcm[0].length)
    const attenuationDb = 20 * Math.log10(outputRms / inputRms)
    expect(Math.abs(attenuationDb)).toBeLessThan(0.5)
  })
})
