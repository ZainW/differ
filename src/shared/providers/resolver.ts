import type { RepoContext, ResolvedPullRequest } from '../types/session'
import {
  getCurrentBranch,
  getRepoContext,
  isGithubHost,
  isGitlabHost,
  providerFromHost
} from './git'

export class ResolveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResolveError'
  }
}

function parsePullRequestUrl(input: string): ResolvedPullRequest | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }

  const host = url.hostname
  const parts = url.pathname.split('/').filter(Boolean)

  if (isGithubHost(host)) {
    const pullIndex = parts.indexOf('pull')
    if (pullIndex >= 2 && parts[pullIndex + 1]) {
      const number = Number(parts[pullIndex + 1])
      if (!Number.isFinite(number)) return null
      return {
        provider: 'github',
        host,
        owner: parts[pullIndex - 2],
        repo: parts[pullIndex - 1],
        number
      }
    }
  }

  if (isGitlabHost(host)) {
    const mergeRequestsIdx = parts.findIndex((p) => p === 'merge_requests')
    if (mergeRequestsIdx >= 0 && parts[mergeRequestsIdx + 1]) {
      const number = Number(parts[mergeRequestsIdx + 1])
      if (!Number.isFinite(number)) return null
      const projectParts = parts.slice(0, mergeRequestsIdx)
      if (projectParts.at(-1) === '-') projectParts.pop()
      const repo = projectParts.pop()!
      const owner = projectParts.join('/')
      return {
        provider: 'gitlab',
        host,
        owner,
        repo,
        number
      }
    }
  }

  return null
}

export async function resolvePullRequestRef(
  input: string | undefined,
  cwd: string
): Promise<ResolvedPullRequest> {
  if (input?.startsWith('http://') || input?.startsWith('https://')) {
    const parsed = parsePullRequestUrl(input)
    if (!parsed) throw new ResolveError(`Could not parse pull request URL: ${input}`)
    return parsed
  }

  let repo: RepoContext | null
  try {
    repo = await getRepoContext(cwd)
  } catch (error) {
    throw new ResolveError(error instanceof Error ? error.message : String(error))
  }

  if (!repo) {
    throw new ResolveError('Not a git repository. Run differ from a repo or pass a PR URL.')
  }

  if (input && /^\d+$/.test(input.trim())) {
    return {
      provider: repo.provider,
      host: repo.host,
      owner: repo.owner,
      repo: repo.repo,
      number: Number(input.trim())
    }
  }

  if (input) {
    throw new ResolveError(
      `Unrecognized argument "${input}". Pass a PR URL, a PR number, or nothing to auto-detect.`
    )
  }

  const branch = await getCurrentBranch(cwd)
  if (!branch) {
    throw new ResolveError('Could not determine current branch.')
  }

  return {
    provider: repo.provider,
    host: repo.host,
    owner: repo.owner,
    repo: repo.repo,
    number: -1,
    branch
  }
}

export function isAutoDetect(
  ref: ResolvedPullRequest
): ref is ResolvedPullRequest & { branch: string } {
  return ref.number === -1 && typeof ref.branch === 'string'
}

export function buildPullRequestUrl(ref: ResolvedPullRequest): string {
  if (ref.provider === 'github') {
    return `https://${ref.host}/${ref.owner}/${ref.repo}/pull/${ref.number}`
  }
  return `https://${ref.host}/${ref.owner}/${ref.repo}/-/merge_requests/${ref.number}`
}

export { parsePullRequestUrl, providerFromHost }
