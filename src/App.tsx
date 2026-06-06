import { useEffect, Component, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { SearchBar } from './components/common/SearchBar'
import { ToastContainer } from './components/ui/Toast'
import { ThemeProvider } from './contexts/ThemeContext'
import { useUserStore, useProgressStore, useUIStore, useUserProfileStore } from './stores'
import { api } from './api/tauri'

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const CoursePage = lazy(() => import('./pages/CoursePage').then((m) => ({ default: m.CoursePage })))
const LessonPage = lazy(() => import('./pages/LessonPage').then((m) => ({ default: m.LessonPage })))
const QuizPage = lazy(() => import('./pages/QuizPage').then((m) => ({ default: m.QuizPage })))
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const ProgressPage = lazy(() =>
  import('./pages/ProgressPage').then((m) => ({ default: m.ProgressPage })),
)
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
)
const LearningPathPage = lazy(() =>
  import('./pages/LearningPathPage').then((m) => ({ default: m.LearningPathPage })),
)
const ImportPage = lazy(() => import('./pages/ImportPage').then((m) => ({ default: m.ImportPage })))
const GitHubImportPage = lazy(() =>
  import('./pages/GitHubImportPage').then((m) => ({ default: m.GitHubImportPage })),
)
const RssImportPage = lazy(() =>
  import('./pages/RssImportPage').then((m) => ({ default: m.RssImportPage })),
)
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const KnowledgeGraphPage = lazy(() =>
  import('./pages/KnowledgeGraphPage').then((m) => ({ default: m.KnowledgeGraphPage })),
)
const McpPlaygroundPage = lazy(() =>
  import('./pages/McpPlaygroundPage').then((m) => ({ default: m.McpPlaygroundPage })),
)
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
)

function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        color: 'var(--text-secondary)',
        fontSize: '14px',
      }}
    >
      加载中...
    </div>
  )
}

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            color: 'var(--text-primary)',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <h1 style={{ fontSize: '24px', marginBottom: '12px', color: 'var(--danger)' }}>
            应用出现异常
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              marginBottom: '20px',
              fontSize: '14px',
              maxWidth: '500px',
            }}
          >
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            style={{
              padding: '10px 24px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const userId = useUserStore((s) => s.userId)
  const profile = useUserProfileStore((s) => s.profile)
  const setProfile = useUserProfileStore((s) => s.setProfile)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!userId) return
    if (location.pathname.startsWith('/onboarding')) return

    // Use cached profile if already completed — avoids redirect deadlock
    if (profile?.assessment_completed) return

    api
      .getUserProfile(userId)
      .then((p) => {
        if (!p || !p.assessment_completed) {
          navigate('/onboarding')
        } else {
          setProfile(p)
        }
      })
      .catch(() => {
        // API failure: safest to let user stay rather than loop-redirect
      })
  }, [userId, location.pathname, profile])

  return <>{children}</>
}

export default function App() {
  const initUser = useUserStore((s) => s.initUser)
  const userId = useUserStore((s) => s.userId)
  const fetchProgress = useProgressStore((s) => s.fetchProgress)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel)
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen)

  useEffect(() => {
    initUser()
  }, [initUser])

  useEffect(() => {
    if (userId) fetchProgress(userId)
  }, [userId, fetchProgress])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') {
          e.preventDefault()
          toggleSidebar()
        }
        if (e.key === 'j') {
          e.preventDefault()
          toggleAIPanel()
        }
      }
      if (e.key === 'Escape' && aiPanelOpen) {
        toggleAIPanel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSidebar, toggleAIPanel, aiPanelOpen])

  return (
    <BrowserRouter>
      <ThemeProvider>
        <ErrorBoundary>
        <ToastContainer />
        <SearchBar />
        <Routes>
          <Route
            path="/onboarding"
            element={
              <Suspense fallback={<PageLoader />}>
                <OnboardingPage />
              </Suspense>
            }
          />
          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <HomePage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/courses"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <HomePage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/courses/:slug"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <CoursePage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/courses/:slug/lessons/:lessonId"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <LessonPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/courses/:slug/lessons/:lessonId/quiz"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <QuizPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <Suspense fallback={<PageLoader />}>
                  <SettingsPage />
                </Suspense>
              }
            />
            <Route
              path="/progress"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <ProgressPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/learning-path"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <LearningPathPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/import"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <ImportPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/import/github"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <GitHubImportPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/import/rss"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <RssImportPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/search"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <SearchPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/knowledge-graph"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <KnowledgeGraphPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
            <Route
              path="/mcp-playground"
              element={
                <Suspense fallback={<PageLoader />}>
                  <McpPlaygroundPage />
                </Suspense>
              }
            />
            <Route
              path="/analytics"
              element={
                <OnboardingGuard>
                  <Suspense fallback={<PageLoader />}>
                    <AnalyticsPage />
                  </Suspense>
                </OnboardingGuard>
              }
            />
          </Route>
        </Routes>
      </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  )
}
