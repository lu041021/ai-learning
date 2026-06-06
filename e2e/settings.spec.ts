import { test, expect } from '@playwright/test'
import { setupMock } from './helpers'

const CONFIG_BASE = {
  api_key: 'sk-existing-key',
  api_provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  theme: 'dark',
}

test.describe('Settings page', () => {
  test('loads and shows current API key masked', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { get_config: CONFIG_BASE })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('设置')).toBeVisible()
    // API key input should be present
    const input = page.locator('input[type="password"]').first()
    await expect(input).toBeVisible()
    expect(errors).toEqual([])
  })

  test('show/hide button toggles API key visibility', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { get_config: CONFIG_BASE })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const keyInput = page.locator('input[type="password"]').first()
    await expect(keyInput).toBeVisible()

    await page.getByRole('button', { name: '显示' }).first().click()
    await expect(page.locator('input[type="text"]').first()).toBeVisible()

    await page.getByRole('button', { name: '隐藏' }).first().click()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('theme toggle switches between 深色 and 浅色', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { get_config: CONFIG_BASE, set_config: null })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Switch to light theme
    await page.getByRole('button', { name: '浅色' }).click()
    // data-theme attribute should change on documentElement
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(theme).toBe('light')
    expect(errors).toEqual([])
  })

  test('save config shows success toast', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { get_config: CONFIG_BASE, set_config: null })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    await page.getByRole('button', { name: '保存配置' }).click()

    await expect(page.getByText('配置已保存')).toBeVisible({ timeout: 4000 })
    expect(errors).toEqual([])
  })

  test('dangerous zone section is visible', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { get_config: CONFIG_BASE })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('危险区域')).toBeVisible()
    await expect(page.getByRole('button', { name: '清除所有学习数据' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('settings page with empty config loads without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, {
      get_config: { api_key: '', api_provider: 'anthropic', model: '', theme: 'dark' },
    })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})
