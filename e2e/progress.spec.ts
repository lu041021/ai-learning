import { test, expect } from '@playwright/test'
import { scenarioMock, setupMock } from './helpers'

test.describe('Progress page', () => {
  test('shows page heading and key stat labels', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/progress')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: '学习进度' })).toBeVisible()
    await expect(page.getByText('已完成课时')).toBeVisible()
    await expect(page.getByText('已完成测验')).toBeVisible()
    await expect(page.getByText('平均得分')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows skill radar section', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/progress')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('技能雷达')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows course progress section with populated data', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/progress')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('课程进度')).toBeVisible()
    await expect(page.getByText('ML Basics')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows knowledge tree section', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/progress')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('知识树')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('loads without crash with empty data', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/progress')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: '学习进度' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('refresh button is visible', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/progress')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('loads without crash when get_dashboard_data errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { get_dashboard_data: new Error('fetch failed') })
    await page.goto('/progress')
    await page.waitForLoadState('networkidle')

    expect(errors).toEqual([])
  })
})
