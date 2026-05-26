import { runCommand } from '../exec'
import type { ProviderName, RepoContext } from '../types/session'

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])
const GITLAB_HOSTS = new Set(['gitlab.com', 'www.gitlab.com'])

export function parseRemoteUrl(remoteUrl: string): {
  provider: ProviderName
  host: string
  owner: string
  repo: string
} | null {
  const sshMatch = remoteUrl.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/)
  if (sshMatch) {
    const [, host, owner, repo] = sshMatch
    return {
      provider: host.includes('gitlab') ? 'gitlab' : 'github',
      host,
      owner,
      repo: repo.replace(/\.git$/, '')
    }
  }

  try {
    const url = new URL(remoteUrl.replace(/\.git$/, ''))
    const parts = url.pathname.replace(/^\//, '').split('/')
    if (parts.length < 2) return null
    const [owner, repo] = parts
    const provider: ProviderName = GITLAB_HOSTS.has(url.hostname) || url.hostname.includes('gitlab')
      ? 'gitlab'
      : 'github'
    return { provider, host: url.hostname, owner, repo }
  } catch {
    return null
  }
}

export async function getRepoContext(cwd: string): Promise<RepoContext | null> {
  try {
    const { stdout: inside } = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], { cwd })
    if (inside.trim() !== 'true') return null

    let remoteUrl: string
    try {
      ;({ stdout: remoteUrl } = await runCommand('git', ['remote', 'get-url', 'origin'], { cwd }))
    } catch {
      ;({ stdout: remoteUrl } = await runCommand('git', ['remote', 'get-url', 'upstream'], { cwd }))
    }

    const parsed = parseRemoteUrl(remoteUrl.trim())
    if (!parsed) return null

    return {
      provider: parsed.provider,
      owner: parsed.owner,
      repo: parsed.repo,
      host: parsed.host,
      remoteUrl: remoteUrl.trim()
    }
  } catch {
    return null
  }
}

export async function getCurrentBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await runCommand('git', ['branch', '--show-current'], { cwd })
    const branch = stdout.trim()
    return branch || null
  } catch {
    return null
  }
}

export function isGithubHost(host: string): boolean {
  return GITHUB_HOSTS.has(host) || host.endsWith('github.com')
}

export function isGitlabHost(host: string): boolean {
  return GITLAB_HOSTS.has(host) || host.includes('gitlab')
}
