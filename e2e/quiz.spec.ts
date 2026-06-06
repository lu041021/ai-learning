import { test, expect } from '@playwright/test'
import { setupMock } from './helpers'

const QUIZ_MOCK = {
  id: 1,
  lesson_id: 1001,
  title: 'ML Quiz',
  questions: [
    {
      id: 1,
      question_text: 'What does ML stand for?',
      options: JSON.stringify(['Machine Learning', 'Markup Language', 'Meta Logic']),
      explanation: 'ML = Machine Learning',
    },
    {
      id: 2,
      question_text: 'Which algorithm is supervised?',
      options: JSON.stringify(['K-Means', 'Linear Regression', 'DBSCAN']),
      explanation: 'Linear Regression uses labeled data',
    },
  ],
}

const BASE_OVERRIDES = {
  get_progress: { completed_lesson_ids: [], quiz_scores: {} },
  get_course: {
    id: 1,
    slug: 'machine-learning',
    title: 'ML Basics',
    description: '',
    difficulty: 'beginner',
    duration_minutes: 120,
    lesson_count: 1,
    tags: [],
    chapters: [
      {
        id: 101,
        title: 'Intro',
        sort_order: 1,
        lessons: [
          { id: 1001, chapter_id: 101, title: 'What is ML?', sort_order: 1, duration_minutes: 20 },
        ],
      },
    ],
  },
  get_lesson: {
    id: 1001,
    chapter_id: 101,
    title: 'What is ML?',
    content: '# What is ML?',
    sort_order: 1,
    duration_minutes: 20,
  },
  get_quiz: QUIZ_MOCK,
  submit_quiz: {
    score: 1,
    total: 2,
    correct: 2,
    feedback: 'Perfect score!',
    next_step_recommendation: 'Try deep learning next.',
  },
}

test.describe('Quiz flow', () => {
  test('quiz page shows title and questions', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, BASE_OVERRIDES)
    await page.goto('/courses/machine-learning/lessons/1001/quiz')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('ML Quiz')).toBeVisible()
    await expect(page.getByText('What does ML stand for?')).toBeVisible()
    await expect(page.getByText('Which algorithm is supervised?')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('quiz shows options correctly parsed from JSON', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, BASE_OVERRIDES)
    await page.goto('/courses/machine-learning/lessons/1001/quiz')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Machine Learning')).toBeVisible()
    await expect(page.getByText('Markup Language')).toBeVisible()
    await expect(page.getByText('Linear Regression')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('submit button disabled until all questions answered', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, BASE_OVERRIDES)
    await page.goto('/courses/machine-learning/lessons/1001/quiz')
    await page.waitForLoadState('networkidle')

    const submitBtn = page.getByRole('button', { name: '提交答案' })
    await expect(submitBtn).toBeDisabled()
    expect(errors).toEqual([])
  })

  test('submit button enabled after answering all questions', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, BASE_OVERRIDES)
    await page.goto('/courses/machine-learning/lessons/1001/quiz')
    await page.waitForLoadState('networkidle')

    // Answer first question
    await page.getByText('Machine Learning').click()
    // Answer second question
    await page.getByText('Linear Regression').click()

    const submitBtn = page.getByRole('button', { name: '提交答案' })
    await expect(submitBtn).toBeEnabled({ timeout: 2000 })
    expect(errors).toEqual([])
  })

  test('submitting quiz shows score and feedback', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, BASE_OVERRIDES)
    await page.goto('/courses/machine-learning/lessons/1001/quiz')
    await page.waitForLoadState('networkidle')

    await page.getByText('Machine Learning').click()
    await page.getByText('Linear Regression').click()

    await page.getByRole('button', { name: '提交答案' }).click()

    // Score result
    await expect(page.getByText('100%')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('正确 2/2')).toBeVisible()
    await expect(page.getByText('Perfect score!')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('result page shows AI recommendation', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, BASE_OVERRIDES)
    await page.goto('/courses/machine-learning/lessons/1001/quiz')
    await page.waitForLoadState('networkidle')

    await page.getByText('Machine Learning').click()
    await page.getByText('Linear Regression').click()
    await page.getByRole('button', { name: '提交答案' }).click()

    await expect(page.getByText('AI 学习建议')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Try deep learning next.')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('quiz not found shows empty state', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { get_quiz: null })
    await page.goto('/courses/test-course/lessons/1/quiz')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('测验不存在')).toBeVisible()
    expect(errors).toEqual([])
  })
})
