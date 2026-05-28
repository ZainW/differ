import type {
  CheckStatus,
  FileChangeStatus,
  PullRequestSession,
  PullRequestState,
  ResolvedPullRequest,
  ReviewState
} from '../types/session'
import { resolveToken } from './auth'
import { buildPullRequestUrl, isAutoDetect } from './resolver'

function apiBase(host: string): string {
  if (host === 'gitlab.com' || host === 'www.gitlab.com') return 'https://gitlab.com/api/v4'
  return `https://${host}/api/v4`
}

function projectPath(owner: string, repo: string): string {
  return encodeURIComponent(`${owner}/${repo}`)
}

function mapState(state: string, draft: boolean): PullRequestState {
  if (draft) return 'draft'
  if (state === 'merged') return 'merged'
  if (state === 'closed') return 'closed'
  return 'open'
}

function mapFileStatus(
  newFile: boolean,
  deletedFile: boolean,
  renamedFile: boolean
): FileChangeStatus {
  if (newFile) return 'added'
  if (deletedFile) return 'deleted'
  if (renamedFile) return 'renamed'
  return 'modified'
}

function mapPipelineStatus(status: string | null): CheckStatus {
  switch (status) {
    case 'success':
      return 'success'
    case 'failed':
      return 'failure'
    case 'canceled':
    case 'skipped':
      return 'skipped'
    default:
      return 'pending'
  }
}

async function gitlabFetch<T>(host: string, path: string, token: string): Promise<T> {
  const res = await fetch(`${apiBase(host)}${path}`, {
    headers: {
      'PRIVATE-TOKEN': token
    }
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitLab API ${path} failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<T>
}

async function findOpenMrByBranch(
  host: string,
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<number> {
  const project = projectPath(owner, repo)
  const mrs = await gitlabFetch<Array<{ iid: number; source_branch: string; state: string }>>(
    host,
    `/projects/${project}/merge_requests?source_branch=${encodeURIComponent(branch)}&state=opened`,
    token
  )
  const match = mrs.find((mr) => mr.source_branch === branch)
  if (!match) {
    throw new Error(`No open merge request found for branch "${branch}". Try: differ <mr-url>`)
  }
  return match.iid
}

export async function fetchGitlabPullRequest(
  ref: ResolvedPullRequest,
  cwd: string
): Promise<PullRequestSession> {
  void cwd
  const token = await resolveToken('gitlab')
  let number = ref.number
  const project = projectPath(ref.owner, ref.repo)

  if (isAutoDetect(ref)) {
    number = await findOpenMrByBranch(ref.host, ref.owner, ref.repo, ref.branch, token)
  }

  const mr = await gitlabFetch<{
    iid: number
    title: string
    state: string
    draft: boolean
    web_url: string
    description: string | null
    author: { name: string; avatar_url: string }
    target_branch: string
    source_branch: string
    diff_refs: { base_sha: string; head_sha: string }
    labels: string[]
  }>(ref.host, `/projects/${project}/merge_requests/${number}`, token)

  const [changes, approvals, pipelines] = await Promise.all([
    gitlabFetch<{
      changes: Array<{
        new_path: string
        old_path: string
        new_file: boolean
        deleted_file: boolean
        renamed_file: boolean
        diff: string
      }>
    }>(ref.host, `/projects/${project}/merge_requests/${number}/changes`, token),
    gitlabFetch<{ approved_by: Array<{ user: { username: string } }> }>(
      ref.host,
      `/projects/${project}/merge_requests/${number}/approvals`,
      token
    ).catch(() => ({ approved_by: [] })),
    gitlabFetch<Array<{ status: string | null; name?: string }>>(
      ref.host,
      `/projects/${project}/merge_requests/${number}/pipelines?per_page=1`,
      token
    ).catch(() => [])
  ])

  const patch = changes.changes
    .map((change) => {
      return `diff --git a/${change.old_path} b/${change.new_path}\n--- a/${change.old_path}\n+++ b/${change.new_path}\n${change.diff}`
    })
    .join('\n')

  const fileStats = new Map<string, { additions: number; deletions: number }>()
  for (const change of changes.changes) {
    const path = change.new_path || change.old_path
    let additions = 0
    let deletions = 0
    for (const line of change.diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++
      if (line.startsWith('-') && !line.startsWith('---')) deletions++
    }
    fileStats.set(path, { additions, deletions })
  }

  const pipelineList = pipelines ?? []

  const resolvedRef: ResolvedPullRequest = { ...ref, number }

  return {
    provider: 'gitlab',
    url: mr.web_url || buildPullRequestUrl(resolvedRef),
    number: mr.iid,
    title: mr.title,
    state: mapState(mr.state, mr.draft),
    author: { name: mr.author.name, avatarUrl: mr.author.avatar_url },
    base: { ref: mr.target_branch, sha: mr.diff_refs.base_sha },
    head: { ref: mr.source_branch, sha: mr.diff_refs.head_sha },
    description: mr.description ?? '',
    labels: mr.labels.map((name) => ({ name, color: '6b7280' })),
    reviewers: approvals.approved_by.map((a) => ({
      login: a.user.username,
      state: 'approved' as ReviewState
    })),
    checks: pipelineList.map((p) => ({
      name: p.name || 'Pipeline',
      status: mapPipelineStatus(p.status)
    })),
    files: changes.changes.map((c) => {
      const path = c.new_path || c.old_path
      const stats = fileStats.get(path) ?? { additions: 0, deletions: 0 }
      return {
        path,
        status: mapFileStatus(c.new_file, c.deleted_file, c.renamed_file),
        additions: stats.additions,
        deletions: stats.deletions
      }
    }),
    patch,
    comments: [],
    timeline: []
  }
}
