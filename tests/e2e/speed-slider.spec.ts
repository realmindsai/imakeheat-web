import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('speed slider drives the displayed multiplier and reaches 0.50x at the low end', async ({ page }) => {
  await page.goto('/')

  await page.setInputFiles(
    'input[type="file"]',
    path.resolve(__dirname, '../fixtures/sine-440-1s.wav'),
  )

  await expect(page.getByText('review the source')).toBeVisible()
  await page.getByText('to effects').click()
  await expect(page.getByText('effects rack')).toBeVisible()

  // Speed display starts at 1.00x.
  await expect(page.getByText('1.00x')).toBeVisible()

  // The Effects rack has range inputs in panel order:
  //   [0] sample rate, [1] pitch, [2] speed, [3] filter
  // Drag speed (index 2) to the low end.
  // Use React's nativeInputValueSetter trick so the synthetic onChange fires.
  await page.locator('input[type="range"]').nth(2).evaluate((el: HTMLInputElement) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeInputValueSetter?.call(el, '0') // slider 0 → 0.5x
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page.getByText('0.50x')).toBeVisible()
})

test('render at speed=0.5 + pitch=+12 produces an export row', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles(
    'input[type="file"]',
    path.resolve(__dirname, '../fixtures/sine-440-1s.wav'),
  )
  await page.getByText('to effects').click()
  await expect(page.getByText('effects rack')).toBeVisible()

  // pitch (index 1) → +12
  // Use React's nativeInputValueSetter trick so the synthetic onChange fires.
  await page.locator('input[type="range"]').nth(1).evaluate((el: HTMLInputElement) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeInputValueSetter?.call(el, '12')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  // speed (index 2) → 0.5x
  await page.locator('input[type="range"]').nth(2).evaluate((el: HTMLInputElement) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeInputValueSetter?.call(el, '0')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })

  await expect(page.getByText('+12 st')).toBeVisible()
  await expect(page.getByText('0.50x')).toBeVisible()

  await page.getByText('render & export').click()
  await expect(page.getByRole('heading', { name: 'my exports' })).toBeVisible({ timeout: 15000 })
  const firstRow = page.locator('div.font-mono.text-\\[13px\\]').first()
  await expect(firstRow).toContainText('.wav')
})
