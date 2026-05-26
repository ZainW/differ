import { useEffect, useMemo, useRef, useState } from 'react'
import { DescriptionPanel } from './components/DescriptionPanel'
import { DiffPanel } from './components/DiffPanel'
import { FileTreePanel } from './components/FileTreePanel'
import { PrHeader } from './components/PrHeader'
import { usePreferences } from './hooks/usePreferences'
import { useSession } from './hooks/useSession'

function EmptyState(): React.JSX.Element {
  return (
    <div className="empty-state">
      <h1>Differ</h1>
      <p>Review GitHub and GitLab pull requests from your terminal.</p>
      <pre className="empty-state-code">{`differ                          # auto-detect PR for current branch
differ 42                       # PR number in current repo
differ https://github.com/...   # PR URL`}</pre>
    </div>
  )
}

function App(): React.JSX.Element {
  const { session, loading } = useSession()
  const { preferences, setDiffLayout, setSidebarWidth, toggleDescription } = usePreferences()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)

  const defaultSelectedPath = useMemo(() => session?.files[0]?.path ?? null, [session])

  useEffect(() => {
    if (selectedPath == null && defaultSelectedPath) {
      setSelectedPath(defaultSelectedPath)
    }
  }, [defaultSelectedPath, selectedPath])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault()
        setSidebarOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (loading) {
    return <div className="app-shell app-shell--loading">Loading pull request…</div>
  }

  if (!session) {
    return (
      <div className="app-shell">
        <EmptyState />
      </div>
    )
  }

  const onResizePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    dragState.current = { startX: event.clientX, startWidth: preferences.sidebarWidth }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onResizePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragState.current) return
    const delta = event.clientX - dragState.current.startX
    const next = Math.min(480, Math.max(220, dragState.current.startWidth + delta))
    setSidebarWidth(next)
  }

  const onResizePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    dragState.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div className="app-shell">
      <PrHeader session={session} />
      <div className="workspace">
        {sidebarOpen && (
          <>
            <FileTreePanel
              session={session}
              selectedPath={selectedPath}
              onSelectPath={setSelectedPath}
              width={preferences.sidebarWidth}
            />
            <div
              className="sidebar-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize file tree"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
            />
          </>
        )}
        <div className="workspace-main">
          <DiffPanel
            patch={session.patch}
            selectedPath={selectedPath}
            diffLayout={preferences.diffLayout}
            onLayoutChange={setDiffLayout}
          />
          <DescriptionPanel
            description={session.description}
            open={preferences.descriptionOpen}
            onToggle={toggleDescription}
          />
        </div>
      </div>
    </div>
  )
}

export default App
