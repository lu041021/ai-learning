import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import App from './App'
import './styles/globals.css'
import './styles/markdown.css'

interface AppConfig { theme: string }

invoke<AppConfig>('get_config').then((c) => {
  document.documentElement.setAttribute('data-theme', c.theme || 'dark')
}).catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
