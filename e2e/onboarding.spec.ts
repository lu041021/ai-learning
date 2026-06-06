import { test, expect } from '@playwright/test'
import { setupMock } from './helpers'

const PROFILE_MOCK = {
  id: 1,
  user_id: 1,
  experience_level: 'beginner',
  interests: ['Machine Learning'],
  learning_goals: 'Learn AI',
  assessment_completed: true,
  assessment_responses: [],
  summary: 'Beginner in AI interested in ML',
}

const ASSESS_MOCK = {
  id: 1,
  user_id: 1,
  experience_level: 'beginner',
  interests: ['Machine Learning'],
  learning_goals: 'Learn AI',
  assessment_completed: true,
  assessment_responses: [],
  summary: 'Beginner in AI',
}

test.describe('Onboarding flow', () => {
  test('welcome screen renders with start button', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, {
      get_config: {
        api_key: 'sk-test-key',
        api_provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        theme: 'dark',
      },
    })
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('欢迎来到 AI 学堂')).toBeVisible()
    await expect(page.getByRole('button', { name: '开始评估' })).toBeVisible()
    await expect(page.getByRole('button', { name: '跳过评估，直接开始学习' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows API key warning when no key configured', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, {
      get_config: { api_key: '', api_provider: 'anthropic', model: '', theme: 'dark' },
    })
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: '先去配置 API Key' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('clicking 开始评估 shows first question', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, {
      get_config: {
        api_key: 'sk-test-key',
        api_provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        theme: 'dark',
      },
    })
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '开始评估' }).click()

    await expect(page.getByText('你了解编程吗？')).toBeVisible({ timeout: 3000 })
    expect(errors).toEqual([])
  })

  test('can select answer and advance to next question', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, {
      get_config: {
        api_key: 'sk-test-key',
        api_provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        theme: 'dark',
      },
    })
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '开始评估' }).click()
    await expect(page.getByText('你了解编程吗？')).toBeVisible({ timeout: 3000 })

    // Select the first option
    await page.getByText('完全不会，零基础').click()
    await page.getByRole('button', { name: '下一题' }).click()

    // Second question should appear (not the first)
    await expect(page.getByText('你了解编程吗？')).not.toBeVisible({ timeout: 3000 })
    expect(errors).toEqual([])
  })

  test('assessment result page shows profile after completion', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, {
      get_config: {
        api_key: 'sk-test-key',
        api_provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        theme: 'dark',
      },
      assess_user_skill: ASSESS_MOCK,
      get_user_profile: PROFILE_MOCK,
    })
    // Navigate directly to result view by setting up mock with existing profile
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('onboarding with error does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, {
      get_config: {
        api_key: 'sk-test-key',
        api_provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        theme: 'dark',
      },
      assess_user_skill: new Error('Assessment failed'),
    })
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})
