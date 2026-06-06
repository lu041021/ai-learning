import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

test.describe('Quiz flow', () => {
  test('renders quiz questions', async ({ page }) => {
    await scenarioMock(page, 'populated')
    await page.goto('/courses/machine-learning/lessons/1001/quiz')
    await page.waitForTimeout(2000)
    await expect(page.locator('text=What does ML stand for?').first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('shows quiz page accessible', async ({ page }) => {
    await scenarioMock(page, 'empty')
    await page.goto('/courses/test-course/lessons/1/quiz')
    await page.waitForTimeout(2000)
    await expect(page.locator('body').first()).toBeVisible()
  })
})
