import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../__tests__/helpers'
import { HomePage } from '../HomePage'
import { createCourse } from '../../__tests__/factories/course'
import { useUserStore, useProgressStore } from '../../stores'

const mockApi = vi.hoisted(() => ({
  getCourses: vi.fn(),
  getRecommendations: vi.fn(),
}))

vi.mock('../../api/tauri', () => ({ api: mockApi }))

beforeEach(() => {
  vi.clearAllMocks()
  useUserStore.setState({ userId: 1, username: 'Learner', loading: false })
  useProgressStore.setState({ completedIds: new Set(), quizScores: {}, loaded: true })
  mockApi.getRecommendations.mockResolvedValue([])
})

describe('HomePage', () => {
  it('shows loading spinner while fetching', () => {
    mockApi.getCourses.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<HomePage />)
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('renders course list after load', async () => {
    mockApi.getCourses.mockResolvedValue([
      createCourse({ id: 1, title: 'Rust 入门' }),
      createCourse({ id: 2, title: 'TypeScript 进阶' }),
    ])
    renderWithProviders(<HomePage />)
    await waitFor(() => {
      expect(screen.getByText('Rust 入门')).toBeInTheDocument()
      expect(screen.getByText('TypeScript 进阶')).toBeInTheDocument()
    })
  })

  it('shows error block when api fails', async () => {
    mockApi.getCourses.mockRejectedValue(new Error('network error'))
    renderWithProviders(<HomePage />)
    await waitFor(() => {
      expect(screen.getByText(/加载失败/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no courses', async () => {
    mockApi.getCourses.mockResolvedValue([])
    renderWithProviders(<HomePage />)
    await waitFor(() => {
      expect(screen.getByText(/暂无可用课程/)).toBeInTheDocument()
    })
  })
})
