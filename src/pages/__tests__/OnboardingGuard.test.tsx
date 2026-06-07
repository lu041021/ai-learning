import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render } from '@testing-library/react'
import { OnboardingGuard } from '../../App'
import { useUserStore, useUserProfileStore } from '../../stores'

const mockApi = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
}))

vi.mock('../../api/tauri', () => ({ api: mockApi }))

function LocationDisplay() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

function renderGuard(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/"
          element={
            <OnboardingGuard>
              <div>首页内容</div>
            </OnboardingGuard>
          }
        />
        <Route path="/onboarding" element={<div>引导页</div>} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useUserProfileStore.setState({ profile: null, loading: false, loaded: false })
})

describe('OnboardingGuard', () => {
  it('renders children when no userId', async () => {
    useUserStore.setState({ userId: null, username: 'Learner', loading: false })
    renderGuard()
    expect(screen.getByText('首页内容')).toBeInTheDocument()
    expect(mockApi.getUserProfile).not.toHaveBeenCalled()
  })

  it('renders children when assessment already completed', async () => {
    useUserStore.setState({ userId: 1, username: 'Learner', loading: false })
    useUserProfileStore.setState({
      profile: {
        id: 1,
        user_id: 1,
        assessment_completed: true,
        experience_level: 'beginner',
        interests: [],
        learning_goals: '',
        summary: '',
      },
      loading: false,
      loaded: true,
    })
    renderGuard()
    expect(screen.getByText('首页内容')).toBeInTheDocument()
    expect(mockApi.getUserProfile).not.toHaveBeenCalled()
  })

  it('redirects to /onboarding when assessment not completed', async () => {
    useUserStore.setState({ userId: 1, username: 'Learner', loading: false })
    mockApi.getUserProfile.mockResolvedValue({ id: 1, user_id: 1, assessment_completed: false })
    renderGuard()
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/onboarding')
    })
  })

  it('sets profile and stays when assessment completed', async () => {
    useUserStore.setState({ userId: 1, username: 'Learner', loading: false })
    mockApi.getUserProfile.mockResolvedValue({
      id: 1,
      user_id: 1,
      assessment_completed: true,
      experience_level: 'beginner',
      interests: [],
      learning_goals: '',
      summary: '',
    })
    renderGuard()
    await waitFor(() => {
      expect(screen.getByText('首页内容')).toBeInTheDocument()
      expect(useUserProfileStore.getState().profile?.assessment_completed).toBe(true)
    })
  })
})
