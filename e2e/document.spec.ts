import { test, expect } from '@playwright/test'
import { setupMock } from './helpers'

const DOC_LIST = [
  {
    id: 1,
    user_id: 1,
    filename: 'ml-notes.pdf',
    file_size: 102400,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 2,
    user_id: 1,
    filename: 'deep-learning-guide.md',
    file_size: 20480,
    created_at: '2025-01-02T00:00:00Z',
  },
]

test.describe('Document page', () => {
  test('shows page heading and upload area', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { list_documents: [] })
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: '我的文档' })).toBeVisible()
    await expect(page.getByText('点击或拖拽文件到这里')).toBeVisible()
    await expect(page.getByText('支持 .pdf、.docx、.txt、.md 格式')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows empty state when no documents uploaded', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { list_documents: [] })
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('还没有上传过文档')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows uploaded document list', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { list_documents: DOC_LIST })
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('已上传文档')).toBeVisible()
    await expect(page.getByText('ml-notes.pdf')).toBeVisible()
    await expect(page.getByText('deep-learning-guide.md')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows delete button for each document', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { list_documents: DOC_LIST })
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    const deleteBtns = page.getByRole('button', { name: '删除' })
    await expect(deleteBtns.first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('document disappears after clicking delete', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, {
      list_documents: [DOC_LIST[0]],
      delete_document: null,
    })
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('ml-notes.pdf')).toBeVisible()
    await page.getByRole('button', { name: '删除' }).first().click()

    await expect(page.getByText('ml-notes.pdf')).not.toBeVisible({ timeout: 4000 })
    expect(errors).toEqual([])
  })

  test('loads without crash when list_documents errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupMock(page, { list_documents: new Error('fetch failed') })
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    expect(errors).toEqual([])
  })
})
