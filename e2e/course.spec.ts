import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

test.describe('Course browsing', () => {
  test('home page loads without error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('course page loads with populated data', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/courses')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('course detail page loads', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/courses/machine-learning')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('lesson page loads', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/courses/machine-learning/lessons/1001')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('course page with empty data does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/courses/test-course')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})
