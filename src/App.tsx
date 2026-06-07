import { useEffect, Component, lazy, Suspense, type ErrorInfo } from 'react'
import { invoke } from '@tauri-apps/api/core'
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
  componentDidCatch(error: Error, info: ErrorInfo) {
    invoke('log_frontend_error', {
      message: error.message,
      stack: (error.stack ?? '') + '\n\nComponent Stack:' + info.componentStack,
    }).catch(() => {})
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

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
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
  }, [userId, location.pathname, profile, navigate, setProfile])

  return <>{children}</>
}

function GuardedPage({ Page }: { Page: React.ComponentType }) {
  return (
    <OnboardingGuard>
      <Suspense fallback={<PageLoader />}>
        <Page />
      </Suspense>
    </OnboardingGuard>
  )
}

function FreePage({ Page }: { Page: React.ComponentType }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Page />
    </Suspense>
  )
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
            <Route path="/onboarding" element={<FreePage Page={OnboardingPage} />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<GuardedPage Page={HomePage} />} />
              <Route path="/courses" element={<GuardedPage Page={HomePage} />} />
              <Route path="/courses/:slug" element={<GuardedPage Page={CoursePage} />} />
              <Route
                path="/courses/:slug/lessons/:lessonId"
                element={<GuardedPage Page={LessonPage} />}
              />
              <Route
                path="/courses/:slug/lessons/:lessonId/quiz"
                element={<GuardedPage Page={QuizPage} />}
              />
              <Route path="/settings" element={<FreePage Page={SettingsPage} />} />
              <Route path="/progress" element={<GuardedPage Page={ProgressPage} />} />
              <Route path="/learning-path" element={<GuardedPage Page={LearningPathPage} />} />
              <Route path="/import" element={<GuardedPage Page={ImportPage} />} />
              <Route path="/import/github" element={<GuardedPage Page={GitHubImportPage} />} />
              <Route path="/import/rss" element={<GuardedPage Page={RssImportPage} />} />
              <Route path="/search" element={<GuardedPage Page={SearchPage} />} />
              <Route path="/knowledge-graph" element={<GuardedPage Page={KnowledgeGraphPage} />} />
              <Route path="/mcp-playground" element={<FreePage Page={McpPlaygroundPage} />} />
              <Route path="/analytics" element={<GuardedPage Page={AnalyticsPage} />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  )
}
