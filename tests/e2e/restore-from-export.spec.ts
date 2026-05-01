// ABOUTME: e2e — Restore button on an export tile reloads the saved chain into the live rack.
// ABOUTME: Renders an export with crusher=4, mutates rack to 16, restores, asserts rack is back at 4.

import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function setRangeValue(locator: import('@playwright/test').Locator, value: number) {
  await locator.evaluate((node, nextValue) => {
    const input = node as HTMLInputElement
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setValue?.call(input, String(nextValue))
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }, value)
}

test('Restore loads an export\'s chainConfig back into the live rack, including all vintage slots', async ({ page }) => {
  await page.goto('/')

  // 1. Upload the standard sine fixture and walk through to effects.
  await page.setInputFiles(
    'input[type="file"]',
    path.resolve(__dirname, '../fixtures/sine-440-1s.wav'),
  )
  await expect(page.getByText('review the source')).toBeVisible()
  await page.getByText('to effects').click()
  await expect(page.getByText('effects rack')).toBeVisible()

  // 2. Add the three vintage slots and set distinctive params we can assert
  // after restore.
  for (const name of ['303 VinylSim', '404 VinylSim', 'Cassette Sim']) {
    await page.getByRole('button', { name: '+ Add effect' }).click()
    await page.getByRole('menuitem', { name }).click()
  }
  await expect(page.getByRole('group')).toHaveCount(7)

  await page.getByRole('button', { name: '4', exact: true }).click()
  await expect(page.getByRole('group', { name: /Crusher/ })).toContainText('4-bit')

  const vinyl303 = page.getByRole('group', { name: /303 VinylSim, position 5 of 7/ })
  await setRangeValue(vinyl303.locator('input[type="range"]').first(), 40)
  await expect(vinyl303).toContainText('comp 40')

  const vinyl404 = page.getByRole('group', { name: /404 VinylSim, position 6 of 7/ })
  await setRangeValue(vinyl404.locator('input[type="range"]').first(), 20)
  await expect(vinyl404).toContainText('freq 20')

  const cassette = page.getByRole('group', { name: /Cassette Sim, position 7 of 7/ })
  await setRangeValue(cassette.locator('input[type="range"]').nth(2), 27)
  await expect(cassette).toContainText('age 27y')

  // 3. Render. Render-success navigates to Exports.
  await page.getByText('render & export').click()
  await expect(page.getByRole('heading', { name: 'my exports' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Restore' }).first()).toBeVisible()

  // 4. Go back to Effects via hash and clear the rack extras so we can detect
  // that Restore actually replays the saved chainConfig.
  await page.goto('/#/effects')
  await expect(page.getByText('effects rack')).toBeVisible()
  await page
    .locator('button.font-mono.text-xs.text-rmai-mut', { hasText: 'Reset' })
    .dispatchEvent('click')
  await expect(page.getByRole('group')).toHaveCount(4)
  await expect(page.getByRole('group', { name: /303 VinylSim/ })).toHaveCount(0)
  await expect(page.getByRole('group', { name: /404 VinylSim/ })).toHaveCount(0)
  await expect(page.getByRole('group', { name: /Cassette Sim/ })).toHaveCount(0)

  // 5. Back to exports, click Restore on the most-recent row.
  await page.goto('/#/exports')
  await expect(page.getByRole('heading', { name: 'my exports' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).first().click()

  // 6. We should be on Effects with the full snapshot chain reapplied.
  await expect(page.getByText('effects rack')).toBeVisible()
  await expect(page.getByRole('group')).toHaveCount(7)
  await expect(page.getByRole('group', { name: /Crusher/ })).toContainText('4-bit')
  await expect(page.getByRole('group', { name: /303 VinylSim/ })).toContainText('comp 40')
  await expect(page.getByRole('group', { name: /404 VinylSim/ })).toContainText('freq 20')
  await expect(page.getByRole('group', { name: /Cassette Sim/ })).toContainText('age 27y')
})
