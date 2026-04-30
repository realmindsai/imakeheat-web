// ABOUTME: e2e — Restore button on an export tile reloads the saved chain into the live rack.
// ABOUTME: Renders an export with crusher=4, mutates rack to 16, restores, asserts rack is back at 4.

import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('Restore loads an export\'s chainConfig back into the live rack', async ({ page }) => {
  await page.goto('/')

  // 1. Upload the standard sine fixture and walk through to effects.
  await page.setInputFiles(
    'input[type="file"]',
    path.resolve(__dirname, '../fixtures/sine-440-1s.wav'),
  )
  await expect(page.getByText('review the source')).toBeVisible()
  await page.getByText('to effects').click()
  await expect(page.getByText('effects rack')).toBeVisible()

  // 2. Set crusher to 4-bit (the snapshot we want to capture).
  await page.getByRole('button', { name: '4', exact: true }).click()
  await expect(page.getByRole('group', { name: /Crusher/ })).toContainText('4-bit')

  // 3. Render. Render-success navigates to Exports.
  await page.getByText('render & export').click()
  await expect(page.getByRole('heading', { name: 'my exports' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Restore' }).first()).toBeVisible()

  // 4. Go back to Effects via hash and mutate the chain to 16-bit so we can
  // detect that Restore actually replays the saved chainConfig.
  await page.goto('/#/effects')
  await expect(page.getByText('effects rack')).toBeVisible()
  await page.getByRole('button', { name: '16', exact: true }).click()
  await expect(page.getByRole('group', { name: /Crusher/ })).toContainText('16-bit')

  // 5. Back to exports, click Restore on the most-recent row.
  await page.goto('/#/exports')
  await expect(page.getByRole('heading', { name: 'my exports' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).first().click()

  // 6. We should be on Effects with the snapshot chain (crusher = 4-bit) reapplied.
  await expect(page.getByText('effects rack')).toBeVisible()
  await expect(page.getByRole('group', { name: /Crusher/ })).toContainText('4-bit')
})
