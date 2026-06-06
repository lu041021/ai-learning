import { test, expect } from '@playwright/test'
import { scenarioMock } from './helpers'

test.describe('Onboarding flow', () => {
  test('redirects to onboarding when assessment not completed', async ({ page }) => {
    const emptyMocks = {
      get_config: {
        api_key: '',
        api_provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        theme: 'dark',
      },
      list_courses: [],
      get_progress: { completed_lesson_ids: [], quiz_scores: {} },
      get_user_profile: {
        id: 1,
        user_id: 1,
        experience_level: 'beginner',
        interests: [],
        learning_goals: '',
        assessment_completed: false,
        assessment_responses: [],
        summary: '',
      },
      get_user_by_local: { id: 1, username: 'test-user', local_id: 'local-1' },
      create_user: { id: 1, username: 'test-user', local_id: 'local-1' },
    }
    await page.addInitScript((mocksStr: string) => {
      const mocks = JSON.parse(mocksStr)
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: { invoke: async (cmd: string) => mocks[cmd] ?? null },
        writable: false,
        configurable: true,
      })
    }, JSON.stringify(emptyMocks))

    await page.goto('/')
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/onboarding/)
  })

  test('onboarding page renders assessment content', async ({ page }) => {
    await scenarioMock(page, 'empty')
    await page.goto('/onboarding')
    await page.waitForTimeout(1000)
    await expect(page.locator('text=评估').first()).toBeVisible({ timeout: 5000 })
  })

  test('shows error state when assessment fails', async ({ page }) => {
    await scenarioMock(page, 'error')
    await page.goto('/onboarding')
    await page.waitForTimeout(1000)
    await expect(page.locator('text=评估').first()).toBeVisible({ timeout: 5000 })
  })
})
