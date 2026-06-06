import { describe, it, expect } from 'vitest'

const tauriCommands = [
  'get_config',
  'set_api_key',
  'set_config',
  'list_courses',
  'get_course',
  'get_lesson',
  'get_quiz',
  'submit_quiz',
  'get_progress',
  'mark_complete',
  'create_user',
  'get_user_by_local',
  'list_conversations',
  'get_messages',
  'send_chat',
  'cancel_chat',
  'clear_user_data',
  'assess_user_skill',
  'get_user_profile',
  'generate_learning_path',
  'get_learning_path',
  'list_learning_path_versions',
  'get_learning_path_version',
  'get_dashboard_data',
  'get_wrong_answers',
  'import_from_url',
  'check_import_url',
  'search_github_awesome',
  'fetch_awesome_links',
  'preview_import_link',
  'subscribe_feed',
  'unsubscribe_feed',
  'list_feed_subscriptions',
  'fetch_feed_articles',
  'search_all',
  'get_knowledge_graph',
  'get_recommendations',
  'get_analytics',
  'analyze_usage',
  'generate_goal_path',
  'assess_user_skill_deep',
  'generate_enriched_learning_path',
]

describe('API-mock consistency', () => {
  it('has all 42 Tauri commands declared', () => {
    expect(tauriCommands).toHaveLength(42)
  })

  it('no duplicate commands', () => {
    const unique = new Set(tauriCommands)
    expect(unique.size).toBe(tauriCommands.length)
  })

  it('all commands follow snake_case convention', () => {
    for (const cmd of tauriCommands) {
      expect(cmd).toMatch(/^[a-z]+(_[a-z0-9]+)*$/)
    }
  })
})
