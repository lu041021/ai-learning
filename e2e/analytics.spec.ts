import { test, expect } from '@playwright/test'
import { scenarioMock, setupMock } from './helpers'

test.describe('Analytics page', () => {
  test('shows page heading and subtitle', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: '学习分析' })).toBeVisible()
    await expect(page.getByText('深入了解你的学习模式和知识掌握情况')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows all four summary stat labels', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('完成率')).toBeVisible()
    await expect(page.getByText('准确率')).toBeVisible()
    await expect(page.getByText('连续学习')).toBeVisible()
    await expect(page.getByText('复习率')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows populated completion percentage', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // populated mock has completion_pct: 33, accuracy_pct: 67
    await expect(page.getByText('33%')).toBeVisible()
    await expect(page.getByText('67%')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows weekly activity section', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('每周学习活动')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows 准确率趋势 section', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('准确率趋势')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows 需要加强 section with weak area data', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'populated')
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('需要加强')).toBeVisible()
    await expect(page.getByText('Supervised Learning')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('loads without crash with empty analytics', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await scenarioMock(page, 'empty')
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: '学习分析' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('loads without crash when get_analytics errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { get_analytics: new Error('fetch failed') })
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    expect(errors).toEqual([])
  })
})
