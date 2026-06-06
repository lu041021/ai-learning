import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

test.describe('Search', () => {
  test('search page loads without error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/search')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('search page with empty data does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/search')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})
