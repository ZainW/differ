import { useEffect, useMemo } from 'react'
import { FileTree, useFileTree } from '@pierre/trees/react'
import type { GitStatusEntry } from '@pierre/trees'
import type { PullRequestSession } from '../../../shared/types/session'

function toGitStatus(status: PullRequestSession['files'][number]['status']): GitStatusEntry['status'] {
  switch (status) {
    case 'added':
      return 'added'
    case 'deleted':
      return 'deleted'
    case 'renamed':
      return 'renamed'
    default:
      return 'modified'
  }
}

interface FileTreePanelProps {
  session: PullRequestSession
  selectedPath: string | null
  onSelectPath: (path: string) => void
  width: number
}

export function FileTreePanel({
  session,
  selectedPath,
  onSelectPath,
  width
}: FileTreePanelProps): React.JSX.Element {
  const paths = useMemo(() => session.files.map((f) => f.path), [session.files])
  const gitStatus = useMemo(
    () => session.files.map((f) => ({ path: f.path, status: toGitStatus(f.status) })),
    [session.files]
  )

  const { model } = useFileTree({
    paths,
    gitStatus,
    search: true,
    flattenEmptyDirectories: true,
    initialExpansion: 'open',
    initialSelectedPaths: selectedPath ? [selectedPath] : undefined,
    onSelectionChange: (selected) => {
      const next = selected[0]
      if (next) onSelectPath(next)
    }
  })

  useEffect(() => {
    model.setGitStatus(gitStatus)
    model.resetPaths(paths)
    if (selectedPath) {
      model.focusPath(selectedPath)
      model.scrollToPath(selectedPath)
    }
  }, [model, gitStatus, paths, selectedPath])

  return (
    <aside className="file-tree-panel" style={{ width }}>
      <FileTree
        model={model}
        className="file-tree-host"
        header={<div className="file-tree-heading">Changed files ({session.files.length})</div>}
      />
    </aside>
  )
}
