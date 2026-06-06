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
  test.beforeEach(async ({ page }) => {
    await scenarioMock(page, 'empty')
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

  test('all routes load without page error', async ({ page }) => {
    const errorsByRoute: Record<string, string[]> = {}
    page.on('pageerror', (err) => {
      const current = page.url().replace('http://localhost:5173', '')
      if (!errorsByRoute[current]) errorsByRoute[current] = []
      errorsByRoute[current].push(err.message)
    })

    for (const route of ALL_ROUTES) {
      await page.goto(route)
      await page.waitForTimeout(1000)
    }

    const failedRoutes = Object.entries(errorsByRoute).filter(([, errs]) => errs.length > 0)
    if (failedRoutes.length > 0) {
      console.error('Routes with errors:', JSON.stringify(failedRoutes))
    }
    expect(failedRoutes).toEqual([])
  })
})
