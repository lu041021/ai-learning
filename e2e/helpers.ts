import type { Page } from '@playwright/test'

type ScenarioName = 'empty' | 'populated' | 'error'

const emptyMocks: Record<string, unknown> = {
  get_config: {
    api_key: '',
    api_provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    theme: 'dark',
  },
  list_courses: [],
  get_course: null,
  get_lesson: null,
  get_quiz: null,
  get_progress: { completed_lesson_ids: [], quiz_scores: {} },
  get_user_profile: {
    id: 1,
    user_id: 1,
    experience_level: 'beginner',
    interests: ['Machine Learning'],
    learning_goals: 'Learn AI',
    assessment_completed: true,
    assessment_responses: [],
    summary: 'Test',
  },
  get_recommendations: [],
  get_knowledge_graph: { nodes: [], edges: [], positions: [] },
  get_analytics: {
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
  },
  get_learning_path: null,
  list_learning_path_versions: [],
  list_conversations: [],
  get_messages: [],
  get_dashboard_data: { skill_radar: [], course_progress: [], knowledge_tree: [] },
  search_all: [],
  list_feed_subscriptions: [],
  get_user_by_local: { id: 1, username: 'test-user', local_id: 'local-1' },
  get_wrong_answers: [],
  create_user: { id: 1, username: 'test-user', local_id: 'local-1' },
  submit_quiz: { score: 0, total: 3, correct: 0, feedback: 'Keep trying!' },
  assess_user_skill: {
    id: 1,
    user_id: 1,
    experience_level: 'beginner',
    interests: [],
    learning_goals: '',
    assessment_completed: true,
    assessment_responses: [],
    summary: '',
  },
  generate_learning_path: { steps: [], version: 1 },
  send_chat: 1,
  cancel_chat: null,
  import_from_url: { course: null },
  check_import_url: { exists: false },
  subscribe_feed: { id: 1, url: '', title: '' },
  unsubscribe_feed: null,
  fetch_feed_articles: [],
  fetch_awesome_links: [],
  search_github_awesome: [],
  preview_import_link: null,
  clear_user_data: null,
  mark_complete: null,
  set_config: null,
  analyze_usage: null,
  generate_goal_path: null,
  assess_user_skill_deep: null,
  generate_enriched_learning_path: null,
}

const populatedMocks: Record<string, unknown> = {
  ...emptyMocks,
  list_courses: [
    {
      id: 1,
      slug: 'machine-learning',
      title: 'Machine Learning Basics',
      description: 'Intro to ML concepts',
      difficulty: 'beginner',
      duration_minutes: 120,
      lesson_count: 3,
      tags: ['ML', 'AI'],
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    },
    {
      id: 2,
      slug: 'deep-learning',
      title: 'Deep Learning',
      description: 'Neural networks and beyond',
      difficulty: 'intermediate',
      duration_minutes: 180,
      lesson_count: 4,
      tags: ['DL', 'AI'],
      created_at: '2025-02-01',
      updated_at: '2025-02-02',
    },
    {
      id: 3,
      slug: 'nlp-course',
      title: 'Natural Language Processing',
      description: 'Text and language AI',
      difficulty: 'advanced',
      duration_minutes: 240,
      lesson_count: 5,
      tags: ['NLP', 'AI'],
      created_at: '2025-03-01',
      updated_at: '2025-03-02',
    },
  ],
  get_course: {
    id: 1,
    slug: 'machine-learning',
    title: 'Machine Learning Basics',
    description: 'Intro to ML concepts',
    difficulty: 'beginner',
    duration_minutes: 120,
    lesson_count: 3,
    tags: ['ML', 'AI'],
    chapters: [
      {
        id: 101,
        title: 'Introduction',
        sort_order: 1,
        lessons: [
          { id: 1001, chapter_id: 101, title: 'What is ML?', sort_order: 1, duration_minutes: 20 },
          { id: 1002, chapter_id: 101, title: 'Types of ML', sort_order: 2, duration_minutes: 25 },
        ],
      },
      {
        id: 102,
        title: 'Supervised Learning',
        sort_order: 2,
        lessons: [
          {
            id: 1003,
            chapter_id: 102,
            title: 'Linear Regression',
            sort_order: 1,
            duration_minutes: 30,
          },
        ],
      },
    ],
  },
  get_lesson: {
    id: 1001,
    chapter_id: 101,
    title: 'What is ML?',
    content_md: '# What is ML?\n\nMachine learning is a subset of AI.',
    order_index: 1,
  },
  get_quiz: {
    id: 1,
    lesson_id: 1001,
    passing_score: 60,
    questions: [
      {
        id: 1,
        question: 'What does ML stand for?',
        type: 'single_choice',
        options: ['Machine Learning', 'Markup Language', 'Meta Logic', 'Micro Learning'],
        answer: 0,
        explanation: 'ML = Machine Learning',
      },
      {
        id: 2,
        question: 'Which is supervised?',
        type: 'single_choice',
        options: ['Clustering', 'Classification', 'PCA', 'Autoencoder'],
        answer: 1,
        explanation: 'Classification uses labeled data',
      },
      {
        id: 3,
        question: 'Is deep learning part of ML?',
        type: 'single_choice',
        options: ['Yes', 'No'],
        answer: 0,
        explanation: 'DL is a subset of ML',
      },
    ],
  },
  get_progress: { completed_lesson_ids: [1001], quiz_scores: { 1: 67 } },
  get_dashboard_data: {
    skill_radar: [
      { domain: 'ML Basics', score: 70 },
      { domain: 'Deep Learning', score: 30 },
      { domain: 'NLP', score: 10 },
    ],
    course_progress: [
      { course_id: 1, course_title: 'ML Basics', completed_lessons: 1, total_lessons: 3, pct: 33 },
    ],
    knowledge_tree: [],
  },
  search_all: [
    {
      source_type: 'course',
      source_id: 1,
      title: 'Machine Learning Basics',
      snippet: 'Intro to ML concepts',
      context_slug: 'machine-learning',
    },
    {
      source_type: 'lesson',
      source_id: 1001,
      title: 'What is ML?',
      snippet: 'Machine learning is...',
      context_slug: 'machine-learning',
      context_id: 101,
    },
  ],
  get_recommendations: [
    {
      course_id: 2,
      course_slug: 'deep-learning',
      course_title: 'Deep Learning',
      reason: 'Next step after ML Basics',
      score: 0.9,
    },
  ],
  submit_quiz: {
    score: 67,
    total: 3,
    correct: 2,
    feedback: 'Good effort!',
    next_step_recommendation: 'Review linear regression',
  },
  get_wrong_answers: [
    {
      question_id: 2,
      question_text: 'Which is supervised?',
      user_answer: 3,
      correct_answer: 1,
      explanation: 'Classification uses labeled data',
    },
  ],
  get_learning_path: {
    steps: [
      {
        step: 1,
        lesson_id: 1001,
        lesson_title: 'What is ML?',
        course_slug: 'machine-learning',
        reason: 'Foundation',
      },
      {
        step: 2,
        lesson_id: 1002,
        lesson_title: 'Types of ML',
        course_slug: 'machine-learning',
        reason: 'Build on basics',
      },
      {
        step: 3,
        lesson_id: 1003,
        lesson_title: 'Linear Regression',
        course_slug: 'machine-learning',
        reason: 'Practical application',
      },
    ],
    version: 1,
  },
  list_conversations: [
    {
      id: 1,
      title: 'Help with ML',
      lesson_id: null,
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    },
  ],
  get_messages: [
    { id: 1, role: 'user', content: 'What is ML?', created_at: '2025-01-01' },
    {
      id: 2,
      role: 'assistant',
      content: 'ML is a subset of AI that enables systems to learn from data.',
      created_at: '2025-01-01',
    },
  ],
  get_user_profile: {
    id: 1,
    user_id: 1,
    experience_level: 'beginner',
    interests: ['Machine Learning', 'Deep Learning'],
    learning_goals: 'Become an AI engineer',
    assessment_completed: true,
    assessment_responses: [{ question: 'What is your goal?', answer: 'Career change' }],
    summary: 'Beginner in AI',
  },
  get_analytics: {
    summary: {
      completion_pct: 33,
      accuracy_pct: 67,
      streak: { current: 3, longest: 5 },
      review_rate: 0.5,
      quiz_attempts: 3,
    },
    per_course: [
      {
        course_id: 1,
        course_title: 'ML Basics',
        completed_lessons: 1,
        total_lessons: 3,
        accuracy_pct: 67,
      },
    ],
    weekly_activity: [{ week: '2025-W01', lessons_completed: 2, quizzes_taken: 1 }],
    accuracy_trend: [
      { quiz_id: 1, score_pct: 50 },
      { quiz_id: 1, score_pct: 67 },
      { quiz_id: 2, score_pct: 80 },
    ],
    domain_accuracy: [{ domain: 'ML Basics', accuracy_pct: 67 }],
    weak_areas: [{ domain: 'ML Basics', topic: 'Supervised Learning', accuracy_pct: 33 }],
    strong_domains: [{ domain: 'ML Basics', accuracy_pct: 80 }],
  },
  get_knowledge_graph: {
    nodes: [
      { id: 'ml', label: 'Machine Learning', type: 'domain', group: 'AI' },
      { id: 'supervised', label: 'Supervised', type: 'topic', group: 'AI' },
      { id: 'unsupervised', label: 'Unsupervised', type: 'topic', group: 'AI' },
    ],
    edges: [
      { source: 'ml', target: 'supervised', weight: 1 },
      { source: 'ml', target: 'unsupervised', weight: 0.5 },
    ],
    positions: { ml: { x: 0, y: 0 }, supervised: { x: 1, y: -1 }, unsupervised: { x: 1, y: 1 } },
  },
}

const errorMocks: Record<string, unknown> = {
  ...emptyMocks,
  list_courses: new Error('Network error'),
  get_user_profile: new Error('Failed to fetch'),
  search_all: new Error('Search unavailable'),
  assess_user_skill: new Error('Assessment failed'),
}

const scenarioMocks: Record<ScenarioName, Record<string, unknown>> = {
  empty: emptyMocks,
  populated: populatedMocks,
  error: errorMocks,
}

export async function setupMock(page: Page, overrides?: Record<string, unknown>) {
  await page.addInitScript(
    (initArg: string) => {
      const { mocks } = JSON.parse(initArg)
      const invokeImpl = async (cmd: string) => {
        const result = mocks[cmd]
        if (
          result instanceof Error ||
          (typeof result === 'object' &&
            result !== null &&
            'message' in result &&
            'stack' in result)
        ) {
          throw result
        }
        return result ?? null
      }
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: { invoke: invokeImpl },
        writable: false,
        configurable: true,
      })
    },
    JSON.stringify({ mocks: { ...emptyMocks, ...overrides } }),
  )
}

export async function scenarioMock(page: Page, scenario: ScenarioName) {
  const mocks = scenarioMocks[scenario]
  await page.addInitScript((initArg: string) => {
    const { mocks: mockMap } = JSON.parse(initArg)
    const invokeImpl = async (cmd: string) => {
      const result = mockMap[cmd]
      if (
        result instanceof Error ||
        (typeof result === 'object' && result !== null && 'stack' in result)
      ) {
        throw result
      }
      return result ?? null
    }
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: { invoke: invokeImpl },
      writable: false,
      configurable: true,
    })
  }, JSON.stringify({ mocks }))
}

type TauriInternals = { invoke?: (cmd: string, args: Record<string, unknown>) => Promise<unknown> }

export function mockInvoke(page: Page, cmd: string, result: unknown) {
  return page.addInitScript((initArg: string) => {
    const { cmd: command, result: res } = JSON.parse(initArg)
    const win = window as Window & { __TAURI_INTERNALS__?: TauriInternals }
    const internals = win.__TAURI_INTERNALS__ || {}
    const origInvoke = internals.invoke || (async () => null)
    win.__TAURI_INTERNALS__ = {
      ...internals,
      invoke: async (c: string, a: Record<string, unknown>) => {
        if (c === command) {
          if (res instanceof Error || (typeof res === 'object' && res !== null && 'stack' in res))
            throw res
          return res
        }
        return origInvoke(c, a)
      },
    }
  }, JSON.stringify({ cmd, result }))
}

export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  await page.waitForTimeout(800)
}

export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

export function getByTestId(page: Page, testId: string) {
  return page.getByTestId(testId)
}
