import { useCallback, useEffect, useState } from 'react'

export type DiffLayout = 'split' | 'unified'

const STORAGE_KEY = 'differ.preferences'

interface Preferences {
  diffLayout: DiffLayout
  sidebarWidth: number
  descriptionOpen: boolean
}

const defaults: Preferences = {
  diffLayout: 'split',
  sidebarWidth: 280,
  descriptionOpen: false
}

function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    return { ...defaults, ...JSON.parse(raw) }
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

  const persist = useCallback((next: Preferences) => {
    setPreferences(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const setDiffLayout = useCallback(
    (diffLayout: DiffLayout) => {
      persist({ ...preferences, diffLayout })
    },
    [persist, preferences]
  )

  const setSidebarWidth = useCallback(
    (sidebarWidth: number) => {
      persist({ ...preferences, sidebarWidth })
    },
    [persist, preferences]
  )

  const toggleDescription = useCallback(() => {
    persist({ ...preferences, descriptionOpen: !preferences.descriptionOpen })
  }, [persist, preferences])

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
