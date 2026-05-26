import { useMemo } from 'react'
import { parsePatchFiles } from '@pierre/diffs'
import { FileDiff } from '@pierre/diffs/react'
import type { FileDiffMetadata } from '@pierre/diffs/react'
import type { DiffLayout } from '../hooks/usePreferences'

function countLineStats(file: FileDiffMetadata): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const hunk of file.hunks) {
    additions += hunk.additionLines
    deletions += hunk.deletionLines
  }
  return { additions, deletions }
}

interface DiffPanelProps {
  patch: string
  selectedPath: string | null
  diffLayout: DiffLayout
  onLayoutChange: (layout: DiffLayout) => void
}

export function DiffPanel({
  patch,
  selectedPath,
  diffLayout,
  onLayoutChange
}: DiffPanelProps): React.JSX.Element {
  const parsedFiles = useMemo(() => {
    if (!patch.trim()) return []
    return parsePatchFiles(patch, 'differ-session').flatMap((p) => p.files)
  }, [patch])

  const visibleFiles = useMemo(() => {
    if (!selectedPath) return parsedFiles
    return parsedFiles.filter((file) => file.name === selectedPath || file.prevName === selectedPath)
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

  return (
    <section className="diff-panel">
      <div className="diff-toolbar">
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

      <div className="diff-scroll">
        {visibleFiles.length === 0 ? (
          <div className="diff-empty">No diff to display for this file.</div>
        ) : (
          visibleFiles.map((fileDiff) => (
            <FileDiff
              key={fileDiff.name}
              fileDiff={fileDiff}
              disableWorkerPool
              options={{
                diffStyle: diffLayout,
                theme: {
                  dark: 'pierre-dark',
                  light: 'pierre-light'
                },
                themeType: 'system',
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
