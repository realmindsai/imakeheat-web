// ABOUTME: v1-parity guard — render legacy 4-effect chain at neutral params and compare
// ABOUTME: against a frozen binary fixture rendered from tag v1. Drift = regression.

import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Chain } from '../../src/audio/effects/types'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE = resolve(HERE, '../fixtures/v1-neutral-render.bin')
const SR = 48000
const N = SR // 1 second

// Build the deterministic source on the Node side; pass as plain number[] across postMessage.
function buildSource(): number[] {
  const a = new Float32Array(N)
  a[0] = 1.0 // Dirac impulse at t=0
  for (let i = 0; i < N; i++) a[i] += 0.5 * Math.sin((2 * Math.PI * 1000 * i) / SR)
  return Array.from(a)
}

test('chain at v1-neutral produces output bit-equal to v1 baseline fixture', async ({ page }) => {
  await page.goto('/tests/integration/index.html')
  await expect(page.locator('#status')).toHaveText('ready')

  const source = buildSource()
  // Equivalent of v1 `defaultEffects` from src/store/session.ts:
  //   bitDepth: 16, sampleRateHz: 44100, pitchSemitones: 0, speed: 1, filterValue: 0
  const chain: Chain = [
    { id: 'c', kind: 'crusher', enabled: true, params: { bitDepth: 16 } },
    { id: 's', kind: 'srhold',  enabled: true, params: { sampleRateHz: 44100 } },
    { id: 'p', kind: 'pitch',   enabled: true, params: { semitones: 0, speed: 1 } },
    { id: 'f', kind: 'filter',  enabled: true, params: { value: 0 } },
  ]
  const result = await page.evaluate(async ({ src, chain }) => {
    return await window.__run({
      kind: 'render',
      sourcePcm: [src], // mono
      sampleRate: 48000,
      chain,
      trim: { startSec: 0, endSec: 1 },
    })
  }, { src: source, chain })

  // Output is { pcm: number[][], sampleRate, length }. Mono → channel 0.
  const out = new Float32Array(result.pcm[0])
  const bytes = Buffer.from(out.buffer, out.byteOffset, out.byteLength)

  if (process.env.UPDATE_FIXTURES === '1') {
    mkdirSync(dirname(FIXTURE), { recursive: true })
    writeFileSync(FIXTURE, bytes)
    console.log(`Wrote ${bytes.length} bytes to ${FIXTURE}`)
    return
  }
  expect(existsSync(FIXTURE)).toBe(true)
  const expected = readFileSync(FIXTURE)
  // Compare lengths first for a clearer error if they differ.
  expect(bytes.length).toBe(expected.length)
  expect(Buffer.compare(bytes, expected)).toBe(0)
})
