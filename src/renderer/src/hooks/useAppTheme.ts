import { useEffect, useState } from 'react'

export type AppTheme = 'light' | 'dark'

function resolveTheme(): AppTheme {
  if (document.documentElement.dataset.visualTest === 'true') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function useAppTheme(): AppTheme {
  const [theme, setTheme] = useState<AppTheme>(() => resolveTheme())

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = (): void => {
      const next = resolveTheme()
      applyTheme(next)
      setTheme(next)
    }

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return theme
}
