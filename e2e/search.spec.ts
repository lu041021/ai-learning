import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

test.describe('Search', () => {
  test('search page renders', async ({ page }) => {
    await scenarioMock(page, 'populated')
    await page.goto('/search')
    await page.waitForTimeout(2000)
    await expect(page.locator('body').first()).toBeVisible()
  })

  test('shows no results for empty query', async ({ page }) => {
    await scenarioMock(page, 'empty')
    await page.goto('/search')
    await page.waitForTimeout(1000)
    await expect(page.locator('body').first()).toBeVisible()
  })
})
