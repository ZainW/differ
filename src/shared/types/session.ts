export type ProviderName = 'github' | 'gitlab'

export type PullRequestState = 'open' | 'closed' | 'merged' | 'draft'

export type FileChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed'

export type ReviewState = 'approved' | 'changes_requested' | 'pending'

export type CheckStatus = 'success' | 'failure' | 'pending' | 'skipped'

export interface CommentThread {
  id: string
  path: string
  line?: number
  body: string
  author: string
}

export interface TimelineEvent {
  id: string
  type: string
  actor: string
  createdAt: string
  summary: string
}

export interface PullRequestSession {
  provider: ProviderName
  url: string
  number: number
  title: string
  state: PullRequestState
  author: { name: string; avatarUrl?: string }
  base: { ref: string; sha: string }
  head: { ref: string; sha: string }
  description: string
  labels: { name: string; color: string }[]
  reviewers: { login: string; state: ReviewState }[]
  checks: { name: string; status: CheckStatus }[]
  files: {
    path: string
    status: FileChangeStatus
    additions: number
    deletions: number
  }[]
  patch: string
  comments: CommentThread[]
  timeline: TimelineEvent[]
}

export interface RepoContext {
  provider: ProviderName
  owner: string
  repo: string
  host: string
  remoteUrl: string
}

export type ResolvedPullRequest = {
  provider: ProviderName
  owner: string
  repo: string
  number: number
  host: string
  branch?: string
}
