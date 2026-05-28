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
  if (host === 'github.com' || host === 'www.github.com') return 'https://api.github.com'
  return `https://${host}/api/v3`
}

function mapState(state: string, merged: boolean, draft: boolean): PullRequestState {
  if (merged) return 'merged'
  if (draft) return 'draft'
  if (state === 'closed') return 'closed'
  return 'open'
}

function mapFileStatus(status: string): FileChangeStatus {
  switch (status) {
    case 'added':
      return 'added'
    case 'removed':
      return 'deleted'
    case 'renamed':
      return 'renamed'
    default:
      return 'modified'
  }
}

function mapReviewState(state: string): ReviewState {
  switch (state) {
    case 'APPROVED':
      return 'approved'
    case 'CHANGES_REQUESTED':
      return 'changes_requested'
    default:
      return 'pending'
  }
}

function mapCheckStatus(state: string, conclusion: string | null): CheckStatus {
  if (state === 'completed') {
    if (conclusion === 'success') return 'success'
    if (conclusion === 'skipped' || conclusion === 'neutral') return 'skipped'
    return 'failure'
  }
  return 'pending'
}

async function githubFetch<T>(host: string, path: string, token: string): Promise<T> {
  const res = await fetch(`${apiBase(host)}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub API ${path} failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<T>
}

async function findOpenPrByBranch(
  host: string,
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<number> {
  const head = `${owner}:${branch}`
  const pulls = await githubFetch<Array<{ number: number; head: { ref: string }; state: string }>>(
    host,
    `/repos/${owner}/${repo}/pulls?head=${encodeURIComponent(head)}&state=open`,
    token
  )
  const match = pulls.find((p) => p.head.ref === branch && p.state === 'open')
  if (!match) {
    throw new Error(`No open pull request found for branch "${branch}". Try: differ <pr-url>`)
  }
  return match.number
}

export async function fetchGithubPullRequest(
  ref: ResolvedPullRequest,
  cwd: string
): Promise<PullRequestSession> {
  void cwd
  const token = await resolveToken('github')
  let number = ref.number

  if (isAutoDetect(ref)) {
    number = await findOpenPrByBranch(ref.host, ref.owner, ref.repo, ref.branch, token)
  }

  const pr = await githubFetch<{
    number: number
    title: string
    state: string
    draft: boolean
    merged: boolean
    html_url: string
    body: string | null
    user: { login: string; avatar_url: string }
    base: { ref: string; sha: string }
    head: { ref: string; sha: string }
    labels: Array<{ name: string; color: string }>
  }>(ref.host, `/repos/${ref.owner}/${ref.repo}/pulls/${number}`, token)

  const [files, reviews, checkRuns, diffRes] = await Promise.all([
    githubFetch<
      Array<{
        filename: string
        status: string
        additions: number
        deletions: number
      }>
    >(ref.host, `/repos/${ref.owner}/${ref.repo}/pulls/${number}/files?per_page=100`, token),
    githubFetch<Array<{ user: { login: string } | null; state: string }>>(
      ref.host,
      `/repos/${ref.owner}/${ref.repo}/pulls/${number}/reviews`,
      token
    ),
    githubFetch<{
      check_runs: Array<{ name: string; status: string; conclusion: string | null }>
    }>(ref.host, `/repos/${ref.owner}/${ref.repo}/commits/${pr.head.sha}/check-runs`, token).catch(
      () => ({ check_runs: [] })
    ),
    fetch(`${apiBase(ref.host)}/repos/${ref.owner}/${ref.repo}/pulls/${number}`, {
      headers: {
        Accept: 'application/vnd.github.diff',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
  ])

  if (!diffRes.ok) {
    throw new Error(`Failed to fetch GitHub diff (${diffRes.status})`)
  }

  const patch = await diffRes.text()
  const reviewerMap = new Map<string, ReviewState>()
  for (const review of reviews) {
    if (!review.user) continue
    const login = review.user.login
    const state = mapReviewState(review.state)
    const existing = reviewerMap.get(login)
    if (!existing || state === 'approved' || state === 'changes_requested') {
      reviewerMap.set(login, state)
    }
  }

  const resolvedRef: ResolvedPullRequest = { ...ref, number }

  return {
    provider: 'github',
    url: pr.html_url || buildPullRequestUrl(resolvedRef),
    number: pr.number,
    title: pr.title,
    state: mapState(pr.state, pr.merged, pr.draft),
    author: { name: pr.user.login, avatarUrl: pr.user.avatar_url },
    base: { ref: pr.base.ref, sha: pr.base.sha },
    head: { ref: pr.head.ref, sha: pr.head.sha },
    description: pr.body ?? '',
    labels: pr.labels.map((l) => ({ name: l.name, color: l.color })),
    reviewers: [...reviewerMap.entries()].map(([login, state]) => ({ login, state })),
    checks: checkRuns.check_runs.map((c) => ({
      name: c.name,
      status: mapCheckStatus(c.status, c.conclusion)
    })),
    files: files.map((f) => ({
      path: f.filename,
      status: mapFileStatus(f.status),
      additions: f.additions,
      deletions: f.deletions
    })),
    patch,
    comments: [],
    timeline: []
  }
}
