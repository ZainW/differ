import type { PullRequestSession } from '../../shared/types/session'

declare global {
  interface Window {
    differ: {
      getSession: () => Promise<PullRequestSession | null>
      onSessionLoad: (callback: (session: PullRequestSession) => void) => () => void
      openExternal: (url: string) => Promise<void>
    }
  }
}

export {}
