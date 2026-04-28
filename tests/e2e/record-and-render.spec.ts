import { test, expect } from '@playwright/test'

test('record 2s with fake mic, render, exports row appears', async ({ page }) => {
  await page.goto('/')

  await page.getByText('record audio').click()
  await page.getByRole('button', { name: 'start recording' }).click()
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'stop & preview' }).click()

  await expect(page.getByText('review the source')).toBeVisible()
  await page.getByText('to effects').click()

  await page.getByText('render & export').click()
  await expect(page.getByRole('heading', { name: 'my exports' })).toBeVisible({ timeout: 10000 })

  await expect(page.locator('div.font-mono.text-\\[13px\\]').first()).toContainText('recording-')
})
