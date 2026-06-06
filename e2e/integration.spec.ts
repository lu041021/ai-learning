/**
 * Integration tests for 3 critical user flows:
 *  1. Learning path generation: empty → generate → steps appear
 *  2. Import URL error: network failure → error UI → retry resets form
 *  3. AI tutor send: panel is open by default → type → user message appears in chat
 */
import { test, expect, type Page } from '@playwright/test'
import { setupMock } from './helpers'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CORRECT_PATH: Record<string, unknown> = {
  id: 1,
  user_id: 1,
  generated_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  steps: [
    {
      order: 1,
      title: 'What is ML?',
      description: 'Introduction to machine learning concepts',
      step_type: 'course_lesson',
      course_id: 1,
      lesson_id: 1001,
      status: 'available',
      estimated_minutes: 20,
    },
    {
      order: 2,
      title: 'Types of ML',
      description: 'Supervised vs unsupervised learning',
      step_type: 'course_lesson',
      course_id: 1,
      lesson_id: 1002,
      status: 'locked',
      estimated_minutes: 25,
    },
    {
      order: 3,
      title: 'Linear Regression',
      description: 'Practical regression models',
      step_type: 'course_lesson',
      course_id: 1,
      lesson_id: 1003,
      status: 'locked',
      estimated_minutes: 30,
    },
  ],
}

// ---------------------------------------------------------------------------
// Test 1 — Learning path generation flow
// ---------------------------------------------------------------------------

test.describe('Learning path generation flow', () => {
  /** Use a stateful initScript so get_learning_path returns null initially,
   *  then returns the full path after generate_learning_path is called. */
  async function setupStatefulMock(page: Page) {
    await page.addInitScript(() => {
      let generated = false

      const path = {
        id: 1,
        user_id: 1,
        generated_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        steps: [
          {
            order: 1,
            title: 'What is ML?',
            description: 'Introduction to machine learning',
            step_type: 'course_lesson',
            course_id: 1,
            lesson_id: 1001,
            status: 'available',
            estimated_minutes: 20,
          },
          {
            order: 2,
            title: 'Types of ML',
            description: 'Supervised vs unsupervised',
            step_type: 'course_lesson',
            course_id: 1,
            lesson_id: 1002,
            status: 'locked',
            estimated_minutes: 25,
          },
        ],
      }

      const invokeImpl = async (cmd: string) => {
        switch (cmd) {
          case 'get_config':
            return {
              api_key: 'test-key',
              api_provider: 'anthropic',
              model: 'claude-sonnet-4-20250514',
              theme: 'dark',
            }
          case 'get_user_by_local':
            return { id: 1, username: 'test-user', local_id: 'local-1' }
          case 'get_user_profile':
            return {
              id: 1,
              user_id: 1,
              experience_level: 'beginner',
              interests: ['Machine Learning'],
              learning_goals: 'Learn AI',
              assessment_completed: true,
              assessment_responses: [],
              summary: 'Beginner learner',
            }
          case 'get_learning_path':
            return generated ? path : null
          case 'generate_learning_path':
            generated = true
            return path
          case 'create_user':
            return { id: 1, username: 'test-user', local_id: 'local-1' }
          case 'list_learning_path_versions':
            return []
          case 'list_courses':
            return []
          case 'get_progress':
            return { completed_lesson_ids: [], quiz_scores: {} }
          case 'get_recommendations':
            return []
          case 'get_analytics':
            return {
              summary: {
                completion_pct: 0,
                accuracy_pct: 0,
                streak: { current: 0, longest: 0 },
                review_rate: 0,
                quiz_attempts: 0,
              },
              per_course: [],
              weekly_activity: [],
              accuracy_trend: [],
              domain_accuracy: [],
              weak_areas: [],
              strong_domains: [],
            }
          case 'get_knowledge_graph':
            return { nodes: [], edges: [], positions: [] }
          case 'list_conversations':
            return []
          case 'get_messages':
            return []
          case 'search_all':
            return []
          case 'list_feed_subscriptions':
            return []
          case 'get_wrong_answers':
            return []
          case 'get_dashboard_data':
            return { skill_radar: [], course_progress: [], knowledge_tree: [] }
          default:
            return null
        }
      }

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: { invoke: invokeImpl },
        writable: false,
        configurable: true,
      })
    })
  }

  test('shows empty state then displays path steps after generation', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await setupStatefulMock(page)
    await page.goto('/learning-path')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Initially no path → empty state
    await expect(page.getByText('还没有学习路线')).toBeVisible()

    // Click "标准生成"
    await page.getByRole('button', { name: '标准生成' }).click()

    // Path steps should appear after generation
    await expect(page.getByText('What is ML?')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Types of ML')).toBeVisible()

    // Empty state should be gone
    await expect(page.getByText('还没有学习路线')).not.toBeVisible()

    expect(errors).toEqual([])
  })

  test('renders existing path steps from store correctly', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    // Use correct LearningPathOut shape (populatedMocks uses wrong field names)
    await setupMock(page, {
      get_learning_path: CORRECT_PATH,
      list_learning_path_versions: [
        {
          id: 1,
          version: 1,
          is_active: true,
          generated_at: '2025-01-01',
          step_count: 3,
        },
      ],
    })

    await page.goto('/learning-path')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    // All 3 step titles should be visible
    await expect(page.getByText('What is ML?')).toBeVisible()
    await expect(page.getByText('Types of ML')).toBeVisible()
    await expect(page.getByText('Linear Regression')).toBeVisible()

    // Regenerate button should be present (path already exists)
    await expect(page.getByRole('button', { name: '重新生成' })).toBeVisible()

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Import URL error handling
// ---------------------------------------------------------------------------

test.describe('Import URL error handling', () => {
  test('shows error UI on import failure and retry resets to idle', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.addInitScript(() => {
      const invokeImpl = async (cmd: string) => {
        switch (cmd) {
          case 'get_config':
            return {
              api_key: 'test-key',
              api_provider: 'anthropic',
              model: 'claude-sonnet-4-20250514',
              theme: 'dark',
            }
          case 'get_user_by_local':
            return { id: 1, username: 'test-user', local_id: 'local-1' }
          case 'get_user_profile':
            return {
              id: 1,
              user_id: 1,
              experience_level: 'beginner',
              interests: [],
              learning_goals: '',
              assessment_completed: true,
              assessment_responses: [],
              summary: '',
            }
          case 'check_import_url':
            return { exists: false }
          case 'import_from_url':
            throw 'Error: failed to fetch URL - connection refused'
          case 'create_user':
            return { id: 1, username: 'test-user', local_id: 'local-1' }
          case 'list_courses':
            return []
          case 'get_progress':
            return { completed_lesson_ids: [], quiz_scores: {} }
          case 'get_recommendations':
            return []
          case 'list_feed_subscriptions':
            return []
          case 'get_analytics':
            return {
              summary: {
                completion_pct: 0,
                accuracy_pct: 0,
                streak: { current: 0, longest: 0 },
                review_rate: 0,
                quiz_attempts: 0,
              },
              per_course: [],
              weekly_activity: [],
              accuracy_trend: [],
              domain_accuracy: [],
              weak_areas: [],
              strong_domains: [],
            }
          case 'get_knowledge_graph':
            return { nodes: [], edges: [], positions: [] }
          case 'list_conversations':
            return []
          case 'get_messages':
            return []
          case 'search_all':
            return []
          case 'get_wrong_answers':
            return []
          case 'get_dashboard_data':
            return { skill_radar: [], course_progress: [], knowledge_tree: [] }
          default:
            return null
        }
      }

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: { invoke: invokeImpl },
        writable: false,
        configurable: true,
      })
    })

    await page.goto('/import')
    await page.waitForLoadState('networkidle')

    // Fill the URL input — use placeholder to avoid matching the AI panel textarea
    const input = page.getByPlaceholder('https://example.com/ai-tutorial')
    await input.fill('https://example.com/nonexistent-tutorial')

    // Wait for button to become enabled and click
    const importBtn = page.getByRole('button', { name: '开始导入' })
    await expect(importBtn).toBeEnabled()
    await importBtn.click()

    // Error UI should appear
    await expect(page.getByText('导入失败')).toBeVisible({ timeout: 6000 })
    await expect(page.getByText(/connection refused/)).toBeVisible()

    // "重试" button resets to idle state
    const retryBtn = page.getByRole('button', { name: '重试' })
    await expect(retryBtn).toBeVisible()
    await retryBtn.click()

    // Error banner should disappear
    await expect(page.getByText('导入失败')).not.toBeVisible({ timeout: 3000 })

    // Import button should be available again
    await expect(importBtn).toBeVisible()

    expect(errors).toEqual([])
  })

  test('shows duplicate warning when URL already exists', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.addInitScript(() => {
      const invokeImpl = async (cmd: string) => {
        switch (cmd) {
          case 'get_config':
            return {
              api_key: 'key',
              api_provider: 'anthropic',
              model: 'claude-sonnet-4-20250514',
              theme: 'dark',
            }
          case 'get_user_by_local':
            return { id: 1, username: 'test-user', local_id: 'local-1' }
          case 'get_user_profile':
            return {
              id: 1,
              user_id: 1,
              experience_level: 'beginner',
              interests: [],
              learning_goals: '',
              assessment_completed: true,
              assessment_responses: [],
              summary: '',
            }
          case 'check_import_url':
            return {
              exists: true,
              existing_course_slug: 'machine-learning',
              existing_course_title: 'ML Basics',
            }
          case 'create_user':
            return { id: 1, username: 'test-user', local_id: 'local-1' }
          case 'list_courses':
            return []
          case 'get_progress':
            return { completed_lesson_ids: [], quiz_scores: {} }
          case 'get_recommendations':
            return []
          case 'list_feed_subscriptions':
            return []
          default:
            return null
        }
      }

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: { invoke: invokeImpl },
        writable: false,
        configurable: true,
      })
    })

    await page.goto('/import')
    await page.waitForLoadState('networkidle')

    await page
      .getByPlaceholder('https://example.com/ai-tutorial')
      .fill('https://example.com/ml-tutorial')
    const importBtn = page.getByRole('button', { name: '开始导入' })
    await expect(importBtn).toBeEnabled()
    await importBtn.click()

    // Duplicate warning should appear
    await expect(page.getByText('该链接已导入过')).toBeVisible({ timeout: 6000 })
    await expect(page.getByText('ML Basics')).toBeVisible()

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 3 — AI tutor: send message, user bubble appears
// (aiPanelOpen defaults to true in UIStore — panel is open on load)
// ---------------------------------------------------------------------------

test.describe('AI tutor send message flow', () => {
  /** Full mock with Tauri event system shim so listen() resolves without crashing. */
  async function setupAITutorMock(page: Page) {
    await page.addInitScript(() => {
      let _uid = 0
      const uid = () => ++_uid

      // Store callbacks in a Map rather than window[id] — browsers reject
      // numeric-indexed property assignment on Window (Tauri's WebView allows it,
      // regular Chromium does not).
      const _cbMap = new Map<number, { fn: ((r: unknown) => void) | null; once: boolean }>()

      const transformCallback = (callback: ((result: unknown) => void) | null, once = false) => {
        const identifier = uid()
        _cbMap.set(identifier, { fn: callback, once })
        return identifier
      }

      const invokeImpl = async (cmd: string) => {
        // Tauri event system plumbing — listen() calls invoke('plugin:event|listen')
        if (cmd === 'plugin:event|listen') return uid()
        if (cmd === 'plugin:event|unlisten') return null

        switch (cmd) {
          case 'get_config':
            return {
              api_key: 'test-key',
              api_provider: 'anthropic',
              model: 'claude-sonnet-4-20250514',
              theme: 'dark',
            }
          case 'get_user_by_local':
            return { id: 1, username: 'test-user', local_id: 'local-1' }
          case 'get_user_profile':
            return {
              id: 1,
              user_id: 1,
              experience_level: 'beginner',
              interests: ['Machine Learning'],
              learning_goals: 'Learn AI',
              assessment_completed: true,
              assessment_responses: [],
              summary: 'Beginner',
            }
          case 'get_course':
            return {
              id: 1,
              slug: 'machine-learning',
              title: 'Machine Learning Basics',
              description: '',
              difficulty: 'beginner',
              duration_minutes: 120,
              lesson_count: 1,
              tags: [],
              chapters: [
                {
                  id: 101,
                  title: 'Introduction',
                  sort_order: 1,
                  lessons: [
                    {
                      id: 1001,
                      chapter_id: 101,
                      title: 'What is ML?',
                      sort_order: 1,
                      duration_minutes: 20,
                    },
                  ],
                },
              ],
            }
          case 'get_lesson':
            return {
              id: 1001,
              chapter_id: 101,
              title: 'What is ML?',
              content: '# What is ML?\n\nMachine learning is a subset of AI.',
              sort_order: 1,
              duration_minutes: 20,
            }
          case 'get_progress':
            return { completed_lesson_ids: [], quiz_scores: {} }
          case 'list_courses':
            return [
              {
                id: 1,
                slug: 'machine-learning',
                title: 'ML Basics',
                description: '',
                difficulty: 'beginner',
                duration_minutes: 120,
                lesson_count: 1,
                tags: [],
                created_at: '2025-01-01',
                updated_at: '2025-01-01',
              },
            ]
          case 'list_conversations':
            return []
          case 'get_messages':
            return []
          case 'send_chat':
            // Return a conversation ID; streaming tokens won't arrive (no backend)
            // but the user message is added to store state before this call.
            return 1
          case 'create_user':
            return { id: 1, username: 'test-user', local_id: 'local-1' }
          case 'cancel_chat':
            return null
          case 'get_recommendations':
            return []
          case 'get_analytics':
            return {
              summary: {
                completion_pct: 0,
                accuracy_pct: 0,
                streak: { current: 0, longest: 0 },
                review_rate: 0,
                quiz_attempts: 0,
              },
              per_course: [],
              weekly_activity: [],
              accuracy_trend: [],
              domain_accuracy: [],
              weak_areas: [],
              strong_domains: [],
            }
          case 'get_knowledge_graph':
            return { nodes: [], edges: [], positions: [] }
          case 'search_all':
            return []
          case 'list_feed_subscriptions':
            return []
          case 'get_wrong_answers':
            return []
          case 'get_dashboard_data':
            return { skill_radar: [], course_progress: [], knowledge_tree: [] }
          case 'get_learning_path':
            return null
          case 'list_learning_path_versions':
            return []
          default:
            return null
        }
      }

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: { invoke: invokeImpl, transformCallback },
        writable: false,
        configurable: true,
      })
    })
  }

  test('user message appears in chat after clicking send', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await setupAITutorMock(page)
    await page.goto('/courses/machine-learning/lessons/1001')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // AI panel is open by default (aiPanelOpen=true in UIStore)
    // The panel header has the exact text "AI 导师"
    await expect(page.getByText('AI 导师', { exact: true })).toBeVisible()

    // Empty state message should show
    await expect(page.getByText('你的 AI 导师')).toBeVisible()

    // Type a question in the textarea
    const textarea = page.getByPlaceholder('提问课程内容...')
    await expect(textarea).toBeVisible()
    await textarea.fill('什么是机器学习？')

    // Wait for the send button to be enabled (needs non-empty input + no streaming)
    const sendBtn = page.getByRole('button', { name: '发送' })
    await expect(sendBtn).toBeEnabled({ timeout: 3000 })

    // Click send button
    await sendBtn.click()

    // Input should be cleared immediately after sending
    await expect(textarea).toHaveValue('', { timeout: 3000 })

    // Send button switches to streaming state ("...")
    await expect(page.getByRole('button', { name: '...' })).toBeVisible({ timeout: 3000 })

    // User message bubble should appear in the messages area (not inside the textarea)
    await expect(page.locator('aside').getByText('什么是机器学习？')).toBeVisible({ timeout: 4000 })

    expect(errors).toEqual([])
  })

  test('AI tutor panel open and close via sidebar toggle', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await setupAITutorMock(page)
    await page.goto('/courses/machine-learning/lessons/1001')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    // Panel is open by default
    await expect(page.getByText('AI 导师', { exact: true })).toBeVisible()

    // Close via the X button inside the panel
    await page.getByRole('button', { name: '关闭 AI 面板' }).click()
    await expect(page.getByText('AI 导师', { exact: true })).not.toBeVisible({ timeout: 3000 })

    // Re-open via sidebar toggle
    await page.getByRole('button', { name: '切换 AI 面板' }).click()
    await expect(page.getByText('AI 导师', { exact: true })).toBeVisible({ timeout: 3000 })

    // Empty state message appears (no messages in new session)
    await expect(page.getByText('你的 AI 导师')).toBeVisible()

    expect(errors).toEqual([])
  })
})
