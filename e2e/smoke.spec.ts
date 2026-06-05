import { test, expect } from '@playwright/test'
import { setupMock } from './helpers'

test.describe('App smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupMock(page)
  })

  test('app loads without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/')
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
  })

  test('onboarding page renders', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForTimeout(1000)

    await expect(page.locator('text=评估').first()).toBeVisible({ timeout: 5000 })
  })

  test('sidebar navigation is visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)

    await expect(page.getByText('AI 学堂').first()).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('搜索').first()).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('MCP Playground').first()).toBeVisible({ timeout: 3000 })
  })

  test('settings page accessible', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForTimeout(1000)

    await expect(page.locator('text=API').first()).toBeVisible({ timeout: 5000 })
  })

  test('mcp playground page accessible', async ({ page }) => {
    await page.goto('/mcp-playground')
    await page.waitForTimeout(1000)

    await expect(page.getByText('MCP Playground').first()).toBeVisible({ timeout: 5000 })
  })
})
