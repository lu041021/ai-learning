import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

test.describe('Course browsing', () => {
  test('shows empty state when no courses', async ({ page }) => {
    await scenarioMock(page, 'empty')
    await page.goto('/')
    await page.waitForTimeout(2000)
    await expect(page.getByText('AI 学堂').first()).toBeVisible({ timeout: 3000 })
  })

  test('renders course list when courses exist', async ({ page }) => {
    await scenarioMock(page, 'populated')
    await page.goto('/courses')
    await page.waitForTimeout(2000)
    await expect(page.locator('text=Machine Learning Basics').first()).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('text=Deep Learning').first()).toBeVisible({ timeout: 3000 })
  })

  test('navigates to course detail', async ({ page }) => {
    await scenarioMock(page, 'populated')
    await page.goto('/courses/machine-learning')
    await page.waitForTimeout(2000)
    await expect(page.locator('text=What is ML?').first()).toBeVisible({ timeout: 5000 })
  })

  test('renders lesson content', async ({ page }) => {
    await scenarioMock(page, 'populated')
    await page.goto('/courses/machine-learning/lessons/1001')
    await page.waitForTimeout(2000)
    await expect(page.locator('text=What is ML?').first()).toBeVisible({ timeout: 5000 })
  })

  test('shows sidebar navigation on course page', async ({ page }) => {
    await scenarioMock(page, 'populated')
    await page.goto('/courses/machine-learning')
    await page.waitForTimeout(2000)
    await expect(page.getByText('AI 学堂').first()).toBeVisible({ timeout: 3000 })
  })
})
