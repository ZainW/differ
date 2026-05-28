import type {
  CheckStatus,
  PullRequestSession,
  PullRequestState
} from '../../../shared/types/session'

function stateLabel(state: PullRequestState): string {
  switch (state) {
    case 'merged':
      return 'Merged'
    case 'closed':
      return 'Closed'
    case 'draft':
      return 'Draft'
    default:
      return 'Open'
  }
}

function checkSummary(checks: PullRequestSession['checks']): string {
  const success = checks.filter((c) => c.status === 'success').length
  const failed = checks.filter((c) => c.status === 'failure').length
  const pending = checks.filter((c) => c.status === 'pending').length
  if (checks.length === 0) return 'No checks'
  if (failed > 0) return `${failed} failed`
  if (pending > 0) return `${pending} pending`
  return `${success} passed`
}

function checkTone(checks: PullRequestSession['checks']): CheckStatus {
  if (checks.some((c) => c.status === 'failure')) return 'failure'
  if (checks.some((c) => c.status === 'pending')) return 'pending'
  return 'success'
}

interface PrHeaderProps {
  session: PullRequestSession
}

export function PrHeader({ session }: PrHeaderProps): React.JSX.Element {
  const tone = checkTone(session.checks)
  const isMac =
    window.differ?.platform === 'darwin' ||
    (typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent))

  return (
    <header className={`pr-header ${isMac ? 'pr-header--mac' : ''}`} data-testid="pr-header">
      <div className="pr-header-top">
        <div className="pr-header-title-row">
          <span className="pr-provider">{session.provider === 'github' ? 'GitHub' : 'GitLab'}</span>
          <h1 className="pr-title">
            <span className="pr-number">#{session.number}</span>
            {session.title}
          </h1>
          <span className={`pr-state pr-state--${session.state}`}>{stateLabel(session.state)}</span>
        </div>
        <button
          type="button"
          className="pr-open-link"
          onClick={() => window.differ.openExternal(session.url)}
        >
          Open in browser
          <span className="pr-open-link-icon" aria-hidden="true" />
        </button>
      </div>

      <div className="pr-header-meta">
        <div className="pr-branch-flow">
          <span className="pr-author">{session.author.name}</span>
          <span className="pr-branch-arrow"> wants to merge </span>
          <code className="pr-ref">{session.head.ref}</code>
          <span className="pr-branch-arrow"> into </span>
          <code className="pr-ref">{session.base.ref}</code>
        </div>

        <div className="pr-badges">
          {session.labels.map((label) => (
            <span
              key={label.name}
              className="pr-label"
              style={{ backgroundColor: `#${label.color}33`, borderColor: `#${label.color}` }}
            >
              {label.name}
            </span>
          ))}
          <span className={`pr-check pr-check--${tone}`}>{checkSummary(session.checks)}</span>
          {session.reviewers.length > 0 && (
            <span className="pr-reviewers">
              {session.reviewers.length} reviewer{session.reviewers.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
