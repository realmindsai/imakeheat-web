import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function loadFixtureAndOpenEffects(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.setInputFiles(
    'input[type="file"]',
    path.resolve(__dirname, '../fixtures/sine-440-1s.wav'),
  )
  await expect(page.getByText('review the source')).toBeVisible()
  await page.getByText('to effects').click()
  await expect(page.getByText('effects rack')).toBeVisible()
}

test('first tap on 12 nudges sample-rate display toward 24 kHz', async ({ page }) => {
  await loadFixtureAndOpenEffects(page)

  // The initial SR display reads whatever the engine's AudioContext sample rate is —
  // 48000 in most desktop browsers, 44100 in some CI Chromium configurations.
  // We don't assert on the specific initial value; the contract under test is the
  // post-tap state.
  await expect(page.getByText('24000 Hz')).not.toBeVisible()

  // Tap the "12" button.
  await page.getByRole('button', { name: '12', exact: true }).click()

  // Sample-rate display should now read 24000 Hz.
  await expect(page.getByText('24000 Hz')).toBeVisible()
  await expect(page.getByText('12-bit')).toBeVisible()
})

test('manual SR move blocks the auto-nudge on a later 12-tap', async ({ page }) => {
  await loadFixtureAndOpenEffects(page)

  // Move the SR slider manually first. SR is range index [0] in the rack.
  await page.locator('input[type="range"]').nth(0).evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, '18000')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page.getByText('18000 Hz')).toBeVisible()

  // Now tap "8" then "12". The 12-tap must NOT override the user's 18000 Hz.
  await page.getByRole('button', { name: '8', exact: true }).click()
  await page.getByRole('button', { name: '12', exact: true }).click()

  await expect(page.getByText('12-bit')).toBeVisible()
  await expect(page.getByText('18000 Hz')).toBeVisible()
})
