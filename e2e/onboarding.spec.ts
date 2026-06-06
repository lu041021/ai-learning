import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

test.describe('Onboarding flow', () => {
  test('onboarding page loads without error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('onboarding with error data does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'error')
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('home page redirects when assessment not completed', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})
