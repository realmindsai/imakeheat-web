// ABOUTME: renderOffline tail-padding — appends 4s of silence to the offline
// ABOUTME: render length when echo or reverb is active so the wet tail survives.

import { test, expect } from '@playwright/test'
import type { Chain } from '../../src/audio/effects/types'

const SR = 48000
const N = SR // 1 second of silence

function buildSilentSource(): number[] {
  return new Array(N).fill(0)
}

test('renderOffline pads 4s when echo is active', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const source = buildSilentSource()
  const chain: Chain = [
    {
      id: 'e',
      kind: 'echo',
      enabled: true,
      params: { timeMs: 250, feedback: 0.4, mix: 0.5 },
    },
  ]
  const result = await page.evaluate(
    async ({ src, chain }) => {
      return await window.__run({
        kind: 'render',
        sourcePcm: [src],
        sampleRate: 48000,
        chain,
        trim: { startSec: 0, endSec: 1 },
      })
    },
    { src: source, chain },
  )
  expect(result.length).toBe(240000)
})

test('renderOffline does NOT pad when echo is at neutral mix=0', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const source = buildSilentSource()
  const chain: Chain = [
    {
      id: 'e',
      kind: 'echo',
      enabled: true,
      params: { timeMs: 250, feedback: 0.4, mix: 0 },
    },
  ]
  const result = await page.evaluate(
    async ({ src, chain }) => {
      return await window.__run({
        kind: 'render',
        sourcePcm: [src],
        sampleRate: 48000,
        chain,
        trim: { startSec: 0, endSec: 1 },
      })
    },
    { src: source, chain },
  )
  expect(result.length).toBe(48000)
})

test('renderOffline pads 4s when reverb is active', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const source = buildSilentSource()
  const chain: Chain = [
    {
      id: 'r',
      kind: 'reverb',
      enabled: true,
      params: { size: 0.5, decay: 0.5, mix: 0.5 },
    },
  ]
  const result = await page.evaluate(
    async ({ src, chain }) => {
      return await window.__run({
        kind: 'render',
        sourcePcm: [src],
        sampleRate: 48000,
        chain,
        trim: { startSec: 0, endSec: 1 },
      })
    },
    { src: source, chain },
  )
  expect(result.length).toBe(240000)
})
