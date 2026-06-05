import type { Page } from '@playwright/test'

const mockData: Record<string, unknown> = {
  get_config: { api_key: '', api_provider: 'anthropic', model: 'claude-sonnet-4-20250514', theme: 'dark' },
  list_courses: [],
  get_progress: { completed_lesson_ids: [], quiz_attempts: {} },
  get_user_profile: { id: 1, user_id: 1, experience_level: 'beginner', interests: ['Machine Learning'], learning_goals: 'Learn AI', assessment_completed: true, assessment_responses: [], summary: 'Test' },
  get_recommendations: [],
  get_knowledge_graph: { nodes: [], edges: [], positions: [] },
  get_analytics: { summary: { completion_pct: 0, accuracy_pct: 0, streak: { current: 0, longest: 0 }, review_rate: 0, quiz_attempts: 0 }, per_course: [], weekly_activity: [], accuracy_trend: [], domain_accuracy: [], weak_areas: [], strong_domains: [] },
  get_learning_path: { steps: [], version: 1 },
  list_learning_path_versions: [],
  list_conversations: [],
  get_dashboard_data: { skill_radar: [], course_progress: [], knowledge_tree: [] },
  search_all: [],
  list_feed_subscriptions: [],
  get_user_by_local: { id: 1, username: 'test-user', local_id: 'local-1' },
  get_wrong_answers: [],
}

export async function setupMock(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        invoke: async (cmd: string, _args: Record<string, unknown>) => {
          const mocks: Record<string, unknown> = {
            get_config: { api_key: '', api_provider: 'anthropic', model: 'claude-sonnet-4-20250514', theme: 'dark' },
            list_courses: [],
            get_progress: { completed_lesson_ids: [], quiz_attempts: {} },
            get_user_profile: { id: 1, user_id: 1, experience_level: 'beginner', interests: ['Machine Learning'], learning_goals: 'Learn AI', assessment_completed: true, assessment_responses: [], summary: 'Test' },
            get_recommendations: [],
            get_knowledge_graph: { nodes: [], edges: [], positions: [] },
            get_analytics: { summary: { completion_pct: 0, accuracy_pct: 0, streak: { current: 0, longest: 0 }, review_rate: 0, quiz_attempts: 0 }, per_course: [], weekly_activity: [], accuracy_trend: [], domain_accuracy: [], weak_areas: [], strong_domains: [] },
            get_learning_path: null,
            list_learning_path_versions: [],
            list_conversations: [],
            get_dashboard_data: { skill_radar: [], course_progress: [], knowledge_tree: [] },
            search_all: [],
            list_feed_subscriptions: [],
            get_user_by_local: { id: 1, username: 'test-user', local_id: 'local-1' },
            get_wrong_answers: [],
            create_user: { id: 1, username: 'test-user', local_id: 'local-1' },
          }
          return mocks[cmd] ?? null
        },
      },
      writable: false,
      configurable: true,
    })
  })
}
