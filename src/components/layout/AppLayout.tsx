import { Outlet } from 'react-router-dom'
import { CourseSidebar } from './CourseSidebar'
import { AITutorPanel } from './AITutorPanel'
import { useUIStore } from '../../stores'

export function AppLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${sidebarOpen ? '260px' : '0px'} 1fr ${aiPanelOpen ? '380px' : '0px'}`,
        height: '100vh',
        overflow: 'hidden',
        transition: 'grid-template-columns 0.25s ease',
      }}
    >
      <div style={{ overflow: 'hidden', visibility: sidebarOpen ? 'visible' : 'hidden' }}>
        <CourseSidebar />
      </div>
      <main
        role="main"
        aria-label="主要内容"
        style={{ overflow: 'auto', padding: '32px 40px', background: 'var(--bg-primary)' }}
      >
        <Outlet />
      </main>
      <div style={{ overflow: 'hidden', visibility: aiPanelOpen ? 'visible' : 'hidden' }}>
        <AITutorPanel />
      </div>
    </div>
  )
}
