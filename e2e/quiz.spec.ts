import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

test.describe('Quiz flow', () => {
  test('quiz page loads without error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/courses/machine-learning/lessons/1001/quiz')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('quiz page with empty data does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/courses/test-course/lessons/1/quiz')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})
