import { useEffect, useState } from 'react'
import type { PullRequestSession } from '../../../shared/types/session'

export function useSession(): {
  session: PullRequestSession | null
  loading: boolean
} {
  const [session, setSession] = useState<PullRequestSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    void (async () => {
      const existing = await window.differ.getSession()
      if (!cancelled && existing) {
        setSession(existing)
        setLoading(false)
        return
      }

      unsubscribe = window.differ.onSessionLoad((next) => {
        if (!cancelled) {
          setSession(next)
          setLoading(false)
        }
      })

      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return { session, loading }
}
