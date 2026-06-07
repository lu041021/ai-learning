import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'

const mockApi = vi.hoisted(() => ({
  getUserByLocal: vi.fn(),
  createUser: vi.fn(),
  getProgress: vi.fn(),
  markComplete: vi.fn(),
  getConversations: vi.fn(),
  getMessages: vi.fn(),
  sendChat: vi.fn(),
  cancelChat: vi.fn(),
  getUserProfile: vi.fn(),
  getLearningPath: vi.fn(),
  generateLearningPath: vi.fn(),
}))

vi.mock('../../api/tauri', () => ({ api: mockApi }))
vi.mock('../../utils/storage', () => ({
  getLocalId: () => 'test-local-id',
  getSavedUserId: () => null,
  saveUserId: vi.fn(),
}))

import {
  useUserStore,
  useProgressStore,
  useUserProfileStore,
  useLearningPathStore,
} from '../../stores'
import type { UserProgress, LearningPathOut, UserProfileOut } from '../../types'

beforeEach(() => {
  vi.clearAllMocks()
  useUserStore.setState({ userId: null, username: 'Learner', loading: false })
  useProgressStore.setState({ completedIds: new Set(), quizScores: {}, loaded: false })
  useLearningPathStore.setState({ path: null, loading: false, loaded: false, generating: false })
})

describe('useUserStore', () => {
  it('starts with null userId when no saved user', () => {
    const state = useUserStore.getState()
    expect(state.userId).toBeNull()
    expect(state.loading).toBe(false)
  })

  it('initUser creates user when no saved id', async () => {
    mockApi.createUser.mockResolvedValueOnce({
      id: 42,
      username: 'Learner_test',
      local_id: 'test-local-id',
    })

    await act(async () => {
      await useUserStore.getState().initUser()
    })

    expect(mockApi.createUser).toHaveBeenCalled()
    expect(useUserStore.getState().userId).toBe(42)
    expect(useUserStore.getState().loading).toBe(false)
  })

  it('initUser handles creation failure', async () => {
    mockApi.createUser.mockRejectedValueOnce(new Error('DB error'))

    await act(async () => {
      await useUserStore.getState().initUser()
    })

    expect(useUserStore.getState().userId).toBeNull()
    expect(useUserStore.getState().loading).toBe(false)
  })
})

describe('useProgressStore', () => {
  it('starts with empty progress', () => {
    const state = useProgressStore.getState()
    expect(state.completedIds.size).toBe(0)
    expect(state.loaded).toBe(false)
  })

  it('fetchProgress loads and sets state', async () => {
    const mockProgress: UserProgress = {
      completed_lesson_ids: [1, 2, 3],
      quiz_scores: { '1': 80, '2': 100 },
    }
    mockApi.getProgress.mockResolvedValueOnce(mockProgress)

    await act(async () => {
      await useProgressStore.getState().fetchProgress(1)
    })

    const state = useProgressStore.getState()
    expect(state.loaded).toBe(true)
    expect(state.completedIds.has(1)).toBe(true)
    expect(state.completedIds.has(4)).toBe(false)
    expect(state.quizScores['1']).toBe(80)
  })

  it('fetchProgress sets loaded even on failure', async () => {
    mockApi.getProgress.mockRejectedValueOnce(new Error('fail'))

    await act(async () => {
      await useProgressStore.getState().fetchProgress(1)
    })

    expect(useProgressStore.getState().loaded).toBe(true)
  })

  it('markComplete adds lesson to set', async () => {
    mockApi.markComplete.mockResolvedValueOnce('ok')

    await act(async () => {
      await useProgressStore.getState().markComplete(1, 5)
    })

    expect(useProgressStore.getState().completedIds.has(5)).toBe(true)
  })

  it('setQuizScore updates scores', () => {
    useProgressStore.getState().setQuizScore(1, 90)
    expect(useProgressStore.getState().quizScores['1']).toBe(90)
  })
})

describe('useUserProfileStore', () => {
  it('fetchProfile loads profile', async () => {
    const profile: UserProfileOut = {
      id: 1,
      user_id: 1,
      experience_level: 'beginner',
      interests: ['Rust'],
      learning_goals: 'Learn',
      assessment_completed: true,
      summary: 'test',
    }
    mockApi.getUserProfile.mockResolvedValueOnce(profile)

    await act(async () => {
      await useUserProfileStore.getState().fetchProfile(1)
    })

    const state = useUserProfileStore.getState()
    expect(state.profile?.experience_level).toBe('beginner')
    expect(state.loaded).toBe(true)
    expect(state.loading).toBe(false)
  })

  it('fetchProfile skips when already loaded', async () => {
    useUserProfileStore.setState({ loaded: true })

    await act(async () => {
      await useUserProfileStore.getState().fetchProfile(1)
    })

    expect(mockApi.getUserProfile).not.toHaveBeenCalled()
  })
})

describe('useLearningPathStore', () => {
  it('starts with null path and not loaded', () => {
    const state = useLearningPathStore.getState()
    expect(state.path).toBeNull()
    expect(state.loaded).toBe(false)
    expect(state.generating).toBe(false)
  })

  it('fetchPath loads path', async () => {
    const path: LearningPathOut = {
      id: 1,
      user_id: 1,
      steps: [
        {
          order: 1,
          title: 'Step 1',
          description: 'desc',
          step_type: 'course_lesson',
          course_id: 1,
          lesson_id: 1,
          status: 'available',
          estimated_minutes: 30,
        },
      ],
      generated_at: '2026-01-01',
      updated_at: '2026-01-01',
    }
    mockApi.getLearningPath.mockResolvedValueOnce(path)

    await act(async () => {
      await useLearningPathStore.getState().fetchPath(1)
    })

    const state = useLearningPathStore.getState()
    expect(state.path?.steps.length).toBe(1)
    expect(state.loaded).toBe(true)
    expect(state.loading).toBe(false)
  })

  it('fetchPath skips when already loaded', async () => {
    useLearningPathStore.setState({ loaded: true })

    await act(async () => {
      await useLearningPathStore.getState().fetchPath(1)
    })

    expect(mockApi.getLearningPath).not.toHaveBeenCalled()
  })

  it('generatePath sets generating flag and updates path', async () => {
    const path: LearningPathOut = {
      id: 2,
      user_id: 1,
      steps: [],
      generated_at: '2026-01-01',
      updated_at: '2026-01-01',
    }
    mockApi.generateLearningPath.mockResolvedValueOnce(path)

    await act(async () => {
      await useLearningPathStore.getState().generatePath(1)
    })

    const state = useLearningPathStore.getState()
    expect(state.generating).toBe(false)
    expect(state.path?.id).toBe(2)
    expect(state.loaded).toBe(true)
  })

  it('generatePath handles error', async () => {
    mockApi.generateLearningPath.mockRejectedValueOnce(new Error('LLM timeout'))

    await act(async () => {
      await useLearningPathStore.getState().generatePath(1)
    })

    expect(useLearningPathStore.getState().generating).toBe(false)
  })

  it('resetPath clears path and resets loaded so fetchPath re-fetches', async () => {
    useLearningPathStore.setState({
      path: { id: 1, user_id: 1, steps: [], generated_at: '', updated_at: '' },
      loaded: true,
    })

    useLearningPathStore.getState().resetPath()

    const s = useLearningPathStore.getState()
    expect(s.path).toBeNull()
    expect(s.loaded).toBe(false)

    mockApi.getLearningPath.mockResolvedValueOnce({
      id: 2,
      user_id: 1,
      steps: [],
      generated_at: '',
      updated_at: '',
    })
    await act(async () => {
      await useLearningPathStore.getState().fetchPath(1)
    })
    expect(mockApi.getLearningPath).toHaveBeenCalledTimes(1)
    expect(useLearningPathStore.getState().path?.id).toBe(2)
  })
})
