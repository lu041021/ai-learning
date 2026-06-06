import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

test.describe('Settings page', () => {
  test('renders settings form', async ({ page }) => {
    await scenarioMock(page, 'populated')
    await page.goto('/settings')
    await page.waitForTimeout(1000)
    await expect(page.locator('text=API').first()).toBeVisible({ timeout: 5000 })
  })

  test('shows config options', async ({ page }) => {
    await scenarioMock(page, 'populated')
    await page.goto('/settings')
    await page.waitForTimeout(1000)
    await expect(page.locator('text=anthropic').first()).toBeVisible({ timeout: 5000 })
  })
})
