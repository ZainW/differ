import { useCallback, useEffect, useState } from 'react'

export type DiffLayout = 'split' | 'unified'

const STORAGE_KEY = 'differ.preferences'
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 480

export interface Preferences {
  diffLayout: DiffLayout
  sidebarWidth: number
  descriptionOpen: boolean
}

const defaults: Preferences = {
  diffLayout: 'split',
  sidebarWidth: 280,
  descriptionOpen: false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

export function normalizePreferences(value: unknown): Preferences {
  if (!isRecord(value)) return defaults

  const diffLayout: DiffLayout =
    value.diffLayout === 'unified' || value.diffLayout === 'split'
      ? value.diffLayout
      : defaults.diffLayout
  const sidebarWidth =
    typeof value.sidebarWidth === 'number' && Number.isFinite(value.sidebarWidth)
      ? clampSidebarWidth(value.sidebarWidth)
      : defaults.sidebarWidth
  const descriptionOpen =
    typeof value.descriptionOpen === 'boolean' ? value.descriptionOpen : defaults.descriptionOpen

  return { diffLayout, sidebarWidth, descriptionOpen }
}

function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    return normalizePreferences(JSON.parse(raw))
  } catch {
    return defaults
  }
}

export function usePreferences(): {
  preferences: Preferences
  setDiffLayout: (layout: DiffLayout) => void
  setSidebarWidth: (width: number) => void
  toggleDescription: () => void
} {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences)

  const persist = useCallback((createNext: (current: Preferences) => Preferences) => {
    setPreferences((current) => {
      const next = normalizePreferences(createNext(current))
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        return next
      }
      return next
    })
  }, [])

  const setDiffLayout = useCallback(
    (diffLayout: DiffLayout) => {
      persist((current) => ({ ...current, diffLayout }))
    },
    [persist]
  )

  const setSidebarWidth = useCallback(
    (sidebarWidth: number) => {
      persist((current) => ({ ...current, sidebarWidth }))
    },
    [persist]
  )

  const toggleDescription = useCallback(() => {
    persist((current) => ({ ...current, descriptionOpen: !current.descriptionOpen }))
  }, [persist])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setDiffLayout(preferences.diffLayout === 'split' ? 'unified' : 'split')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [preferences.diffLayout, setDiffLayout])

  return { preferences, setDiffLayout, setSidebarWidth, toggleDescription }
}
