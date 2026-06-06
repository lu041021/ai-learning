export const userFixtures = {
  defaultUser: {
    id: 1,
    username: 'test-user',
    local_id: 'local-1',
  },
  beginnerProfile: {
    id: 1,
    user_id: 1,
    experience_level: 'beginner',
    interests: ['Machine Learning'],
    learning_goals: 'Learn AI fundamentals',
    assessment_completed: true,
    assessment_responses: [{ question: 'What is your goal?', answer: 'Career change' }],
    summary: 'Beginner interested in AI and ML',
  },
}
