import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

const ALL_ROUTES = [
  '/',
  '/onboarding',
  '/courses',
  '/courses/test-course',
  '/courses/test-course/lessons/1',
  '/courses/test-course/lessons/1/quiz',
  '/settings',
  '/progress',
  '/learning-path',
  '/import',
  '/import/github',
  '/import/rss',
  '/search',
  '/knowledge-graph',
  '/mcp-playground',
  '/analytics',
]

test.describe('App smoke tests', () => {
  test('app loads without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('onboarding page loads', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('settings page loads', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('mcp playground page loads', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/mcp-playground')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('all routes load without page error', async ({ page }) => {
    const errorsByRoute: Record<string, string[]> = {}
    page.on('pageerror', (err) => {
      const current = page.url().replace('http://localhost:5173', '')
      if (!errorsByRoute[current]) errorsByRoute[current] = []
      errorsByRoute[current].push(err.message)
    })

    await scenarioMock(page, 'empty')
    for (const route of ALL_ROUTES) {
      await page.goto(route)
      await page.waitForTimeout(800)
    }

    const failedRoutes = Object.entries(errorsByRoute).filter(([, errs]) => errs.length > 0)
    expect(failedRoutes).toEqual([])
  })
})
