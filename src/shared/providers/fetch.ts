import type { PullRequestSession, ResolvedPullRequest } from '../types/session'
import { fetchGithubPullRequest } from './github'
import { fetchGitlabPullRequest } from './gitlab'
import { fetchLocalPullRequest } from './git'

export async function fetchPullRequest(
  ref: ResolvedPullRequest,
  cwd: string
): Promise<PullRequestSession> {
  if (ref.local) {
    return fetchLocalPullRequest(ref, cwd)
  }
  if (ref.provider === 'gitlab') {
    return fetchGitlabPullRequest(ref, cwd)
  }
  return fetchGithubPullRequest(ref, cwd)
}
