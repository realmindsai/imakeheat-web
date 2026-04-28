import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('upload a sine WAV, set bit depth 4, render, see it in exports', async ({ page }) => {
  await page.goto('/')

  await page.setInputFiles(
    'input[type="file"]',
    path.resolve(__dirname, '../fixtures/sine-440-1s.wav'),
  )

  await expect(page.getByText('review the source')).toBeVisible()
  await page.getByText('to effects').click()

  await expect(page.getByText('effects rack')).toBeVisible()
  await page.getByRole('button', { name: '4', exact: true }).click()

  await page.getByText('render & export').click()

  await expect(page.getByRole('heading', { name: 'my exports' })).toBeVisible({ timeout: 10000 })

  const firstRow = page.locator('div.font-mono.text-\\[13px\\]').first()
  await expect(firstRow).toContainText('_crushed_')
  await expect(firstRow).toContainText('.wav')
})
