import { useEffect, useMemo } from 'react'
import { parsePatchFiles } from '@pierre/diffs'
import { FileDiff } from '@pierre/diffs/react'
import type { FileDiffMetadata } from '@pierre/diffs/react'
import { useAppTheme } from '../hooks/useAppTheme'
import type { DiffLayout } from '../hooks/usePreferences'

function isVisualTestMode(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.visualTest === 'true'
}

function resolveDiffThemeType(theme: ReturnType<typeof useAppTheme>): 'dark' | 'light' | 'system' {
  if (isVisualTestMode()) return 'dark'
  return theme
}

function countLineStats(file: FileDiffMetadata): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const hunk of file.hunks) {
    additions += hunk.additionLines
    deletions += hunk.deletionLines
  }
  return { additions, deletions }
}

function fileLabel(path: string | null): string {
  if (!path) return 'No file selected'
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

interface DiffPanelProps {
  patch: string
  selectedPath: string | null
  diffLayout: DiffLayout
  onLayoutChange: (layout: DiffLayout) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function DiffPanel({
  patch,
  selectedPath,
  diffLayout,
  onLayoutChange,
  sidebarOpen,
  onToggleSidebar
}: DiffPanelProps): React.JSX.Element {
  const theme = useAppTheme()
  const parsedFiles = useMemo(() => {
    if (!patch.trim()) return []
    return parsePatchFiles(patch, 'differ-session').flatMap((p) => p.files)
  }, [patch])

  const visibleFiles = useMemo(() => {
    if (!selectedPath) return parsedFiles
    return parsedFiles.filter(
      (file) => file.name === selectedPath || file.prevName === selectedPath
    )
  }, [parsedFiles, selectedPath])

  const totals = useMemo(() => {
    return visibleFiles.reduce(
      (acc, file) => {
        const stats = countLineStats(file)
        acc.additions += stats.additions
        acc.deletions += stats.deletions
        return acc
      },
      { additions: 0, deletions: 0 }
    )
  }, [visibleFiles])

  useEffect(() => {
    if (visibleFiles.length === 0) {
      delete document.documentElement.dataset.visualReady
      return
    }

    const timer = window.setTimeout(() => {
      document.documentElement.dataset.visualReady = 'true'
    }, 1200)

    return () => {
      window.clearTimeout(timer)
      delete document.documentElement.dataset.visualReady
    }
  }, [visibleFiles, diffLayout])

  return (
    <section className="diff-panel" data-testid="diff-panel">
      <div className="diff-toolbar">
        <div className="diff-toolbar-start">
          <button
            type="button"
            className="sidebar-toggle"
            aria-pressed={sidebarOpen}
            aria-label={sidebarOpen ? 'Hide file tree' : 'Show file tree'}
            title={sidebarOpen ? 'Hide file tree (⌘\\)' : 'Show file tree (⌘\\)'}
            onClick={onToggleSidebar}
          >
            <span className="sidebar-toggle-icon" aria-hidden="true" />
          </button>
          <span className="diff-file-label" title={selectedPath ?? undefined}>
            {fileLabel(selectedPath)}
          </span>
        </div>
        <div className="diff-toolbar-end">
          <div className="diff-layout-toggle" role="group" aria-label="Diff layout">
            <button
              type="button"
              className={diffLayout === 'split' ? 'is-active' : ''}
              aria-pressed={diffLayout === 'split'}
              onClick={() => onLayoutChange('split')}
            >
              Split
            </button>
            <button
              type="button"
              className={diffLayout === 'unified' ? 'is-active' : ''}
              aria-pressed={diffLayout === 'unified'}
              onClick={() => onLayoutChange('unified')}
            >
              Unified
            </button>
          </div>
          <div className="diff-stats" aria-live="polite">
            <span className="diff-stat diff-stat--add">+{totals.additions}</span>
            <span className="diff-stat diff-stat--del">−{totals.deletions}</span>
          </div>
        </div>
      </div>

      <div className="diff-scroll">
        {visibleFiles.length === 0 ? (
          <div className="diff-empty">No diff to display for this file.</div>
        ) : (
          visibleFiles.map((fileDiff) => (
            <FileDiff
              key={fileDiff.name}
              className="diff-file-diff"
              fileDiff={fileDiff}
              disableWorkerPool
              options={{
                diffStyle: diffLayout,
                disableFileHeader: true,
                theme: {
                  dark: 'pierre-dark',
                  light: 'pierre-light'
                },
                themeType: resolveDiffThemeType(theme),
                overflow: 'wrap',
                hunkSeparators: 'line-info'
              }}
            />
          ))
        )}
      </div>
    </section>
  )
}
