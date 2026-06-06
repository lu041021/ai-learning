import type { User } from '../../types'

export function createUser(overrides?: Partial<User>): User {
  return {
    id: 1,
    username: 'test-user',
    local_id: 'local-1',
    ...overrides,
  }
}

export function createUserProfile(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    user_id: 1,
    experience_level: 'beginner',
    interests: ['Machine Learning'],
    learning_goals: 'Learn AI fundamentals',
    assessment_completed: true,
    assessment_responses: [],
    summary: 'Beginner interested in AI',
    ...overrides,
  }
}
