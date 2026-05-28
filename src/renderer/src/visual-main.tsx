import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import type { PullRequestSession } from '../../shared/types/session'
import githubReviewSession from '../../../tests/visual/fixtures/github-review.session.json'

declare global {
  interface Window {
    differ: {
      platform?: string
      getSession: () => Promise<PullRequestSession | null>
      onSessionLoad: (callback: (session: PullRequestSession) => void) => () => void
      openExternal: (url: string) => Promise<void>
    }
  }
}

const params = new URLSearchParams(window.location.search)

function readSession(): PullRequestSession | null {
  if (params.get('state') === 'empty') return null
  const fixture = params.get('fixture') ?? 'github-review'
  if (fixture === 'github-review') return githubReviewSession as PullRequestSession
  return null
}

const session = readSession()
const preferences = {
  diffLayout: params.get('layout') === 'unified' ? ('unified' as const) : ('split' as const),
  sidebarWidth: 280,
  descriptionOpen: params.get('description') === '1'
}

document.documentElement.dataset.visualTest = 'true'
document.documentElement.dataset.theme = 'dark'
document.documentElement.style.colorScheme = 'dark'
localStorage.setItem('differ.preferences', JSON.stringify(preferences))

if (params.get('sidebar') === '0') {
  document.documentElement.dataset.sidebarHidden = 'true'
}

const fileParam = params.get('file')
if (fileParam) {
  document.documentElement.dataset.selectedFile = fileParam
}

window.differ = {
  platform: 'darwin',
  getSession: async () => {
    if (params.get('state') === 'loading') {
      return new Promise<PullRequestSession>(() => {})
    }
    return session
  },
  onSessionLoad: (callback) => {
    if (session) callback(session)
    return () => undefined
  },
  openExternal: async () => undefined
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
