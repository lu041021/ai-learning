import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import { LessonPage } from '../LessonPage'
import { createLesson, createCourseDetail } from '../../__tests__/factories/course'
import { useUserStore, useProgressStore } from '../../stores'

const mockApi = vi.hoisted(() => ({
  getLesson: vi.fn(),
  getCourse: vi.fn(),
}))

vi.mock('../../api/tauri', () => ({ api: mockApi }))
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))
vi.mock('rehype-highlight', () => ({ default: () => {} }))

function renderLesson(lessonId = '1', slug = 'test-course') {
  return render(
    <MemoryRouter initialEntries={[`/courses/${slug}/lessons/${lessonId}`]}>
      <Routes>
        <Route path="/courses/:slug/lessons/:lessonId" element={<LessonPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useUserStore.setState({ userId: 1, username: 'Learner', loading: false })
  useProgressStore.setState({ completedIds: new Set(), quizScores: {}, loaded: true })
})

describe('LessonPage', () => {
  it('shows loading spinner while fetching', () => {
    mockApi.getLesson.mockReturnValue(new Promise(() => {}))
    mockApi.getCourse.mockReturnValue(new Promise(() => {}))
    renderLesson()
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('renders lesson content after load', async () => {
    mockApi.getLesson.mockResolvedValue(
      createLesson({ title: 'Rust 所有权', content_md: '# Rust 所有权\n\n学习内容' }),
    )
    mockApi.getCourse.mockResolvedValue(createCourseDetail())
    renderLesson()
    await waitFor(() => {
      expect(document.title).toContain('Rust 所有权')
      expect(screen.getByTestId('markdown')).toBeInTheDocument()
    })
  })

  it('shows 标记完成 button when lesson not completed', async () => {
    mockApi.getLesson.mockResolvedValue(createLesson({ id: 1 }))
    mockApi.getCourse.mockResolvedValue(createCourseDetail())
    renderLesson()
    await waitFor(() => {
      expect(screen.getByLabelText('标记当前课时为已完成')).toBeInTheDocument()
    })
  })

  it('hides 标记完成 button when lesson already completed', async () => {
    useProgressStore.setState({ completedIds: new Set([1]), quizScores: {}, loaded: true })
    mockApi.getLesson.mockResolvedValue(createLesson({ id: 1 }))
    mockApi.getCourse.mockResolvedValue(createCourseDetail())
    renderLesson()
    await waitFor(() => {
      expect(screen.queryByLabelText('标记当前课时为已完成')).not.toBeInTheDocument()
    })
  })

  it('calls markComplete when button clicked', async () => {
    const markComplete = vi.fn()
    useProgressStore.setState({
      completedIds: new Set(),
      quizScores: {},
      loaded: true,
      markComplete,
      fetchProgress: vi.fn(),
      setQuizScore: vi.fn(),
    })
    mockApi.getLesson.mockResolvedValue(createLesson({ id: 1 }))
    mockApi.getCourse.mockResolvedValue(createCourseDetail())
    renderLesson()
    await waitFor(() => {
      expect(screen.getByLabelText('标记当前课时为已完成')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByLabelText('标记当前课时为已完成'))
    expect(markComplete).toHaveBeenCalledWith(1, 1)
  })

  it('shows error block when api fails', async () => {
    mockApi.getLesson.mockRejectedValue(new Error('not found'))
    mockApi.getCourse.mockRejectedValue(new Error('not found'))
    renderLesson()
    await waitFor(() => {
      expect(screen.getByText(/加载课时失败/)).toBeInTheDocument()
    })
  })
})
