import { test, expect } from '@playwright/test'
import { setupMock } from './helpers'

const SEARCH_RESULTS = [
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
    snippet: 'Machine learning is a subset of AI.',
    context_slug: 'machine-learning',
    context_id: 101,
  },
]

test.describe('Search', () => {
  test('search page shows empty prompt before typing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { search_all: [] })
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('输入关键词开始搜索')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('typing a query shows search results', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { search_all: SEARCH_RESULTS })
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    const input = page.getByPlaceholder('搜索课程、课时或题目...')
    await input.fill('Machine Learning')

    // Wait for debounce (400ms) + render
    await expect(page.getByText('Machine Learning Basics')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('What is ML?')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows snippet text in results', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { search_all: SEARCH_RESULTS })
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder('搜索课程、课时或题目...').fill('ml')

    await expect(page.getByText('Intro to ML concepts')).toBeVisible({ timeout: 3000 })
    expect(errors).toEqual([])
  })

  test('no results shows empty message', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { search_all: [] })
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder('搜索课程、课时或题目...').fill('nonexistentterm')

    await expect(page.getByText(/没有找到与.*相关的结果/)).toBeVisible({ timeout: 3000 })
    expect(errors).toEqual([])
  })

  test('filter tabs are visible: 全部 课程 课时 题目', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { search_all: SEARCH_RESULTS })
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    // Tabs only appear after a search is triggered
    await page.getByPlaceholder('搜索课程、课时或题目...').fill('ML')
    await expect(page.getByRole('button', { name: '全部' })).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('button', { name: '课程' })).toBeVisible()
    await expect(page.getByRole('button', { name: '课时' })).toBeVisible()
    await expect(page.getByRole('button', { name: '题目' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('filter by 课程 hides lesson results', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { search_all: SEARCH_RESULTS })
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder('搜索课程、课时或题目...').fill('ML')
    await expect(page.getByText('Machine Learning Basics')).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: '课程' }).click()

    await expect(page.getByText('Machine Learning Basics')).toBeVisible()
    await expect(page.getByText('What is ML?')).not.toBeVisible()
    expect(errors).toEqual([])
  })

  test('search with error data does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { search_all: new Error('Search unavailable') })
    await page.goto('/search')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})
