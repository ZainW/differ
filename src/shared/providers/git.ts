import { runCommand } from '../exec'
import type {
  ProviderName,
  RepoContext,
  ResolvedPullRequest,
  PullRequestSession,
  FileChangeStatus
} from '../types/session'

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
    const provider: ProviderName =
      GITLAB_HOSTS.has(url.hostname) || url.hostname.includes('gitlab') ? 'gitlab' : 'github'
    return { provider, host: url.hostname, owner, repo }
  } catch {
    return null
  }
}

export async function getRepoContext(cwd: string): Promise<RepoContext | null> {
  const insideWorkTree = await isInsideWorkTree(cwd)
  if (!insideWorkTree) return null

  let remoteUrl: string | null = null
  try {
    ;({ stdout: remoteUrl } = await runCommand('git', ['remote', 'get-url', 'origin'], { cwd }))
  } catch {
    try {
      ;({ stdout: remoteUrl } = await runCommand('git', ['remote', 'get-url', 'upstream'], { cwd }))
    } catch {
      try {
        const { stdout: remotesList } = await runCommand('git', ['remote'], { cwd })
        const remotes = remotesList.trim().split(/\s+/).filter(Boolean)
        for (const r of remotes) {
          try {
            const { stdout: url } = await runCommand('git', ['remote', 'get-url', r], { cwd })
            if (url.trim()) {
              remoteUrl = url.trim()
              break
            }
          } catch {
            // Ignore and try next remote
          }
        }
      } catch {
        // ignore error listing remotes
      }
    }
  }

  if (!remoteUrl || !remoteUrl.trim()) {
    throw new Error('No git remotes configured. Add a remote or pass a PR URL.')
  }

  const parsed = parseRemoteUrl(remoteUrl.trim())
  if (!parsed) {
    throw new Error(
      `Unsupported remote URL: ${remoteUrl.trim()}. Only GitHub and GitLab remotes are supported.`
    )
  }

  return {
    provider: parsed.provider,
    owner: parsed.owner,
    repo: parsed.repo,
    host: parsed.host,
    remoteUrl: remoteUrl.trim()
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

export function providerFromHost(host: string): ProviderName {
  return isGitlabHost(host) ? 'gitlab' : 'github'
}

export async function isInsideWorkTree(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], { cwd })
    return stdout.trim() === 'true'
  } catch {
    return false
  }
}

export async function getBaseBranch(cwd: string): Promise<string | null> {
  for (const branch of ['main', 'master']) {
    try {
      await runCommand('git', ['rev-parse', '--verify', branch], { cwd })
      return branch
    } catch {
      // ignore
    }
  }
  return null
}

export async function getLocalChanges(
  cwd: string,
  baseRef: string
): Promise<{ patch: string; files: PullRequestSession['files'] }> {
  const [{ stdout: patch }, { stdout: numstat }, { stdout: namestatus }] = await Promise.all([
    runCommand('git', ['diff', '--no-renames', baseRef], { cwd }),
    runCommand('git', ['diff', '--numstat', '--no-renames', baseRef], { cwd }),
    runCommand('git', ['diff', '--name-status', '--no-renames', baseRef], { cwd })
  ])

  const fileMap = new Map<
    string,
    { additions: number; deletions: number; status: FileChangeStatus }
  >()

  // Parse numstat
  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const [addStr, delStr, path] = parts
    const additions = addStr === '-' ? 0 : Number(addStr) || 0
    const deletions = delStr === '-' ? 0 : Number(delStr) || 0
    fileMap.set(path, { additions, deletions, status: 'modified' })
  }

  // Parse name-status
  for (const line of namestatus.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 2) continue
    const statusChar = parts[0]
    const path = parts[1]
    let status: FileChangeStatus = 'modified'
    if (statusChar.startsWith('A')) status = 'added'
    else if (statusChar.startsWith('D')) status = 'deleted'
    else if (statusChar.startsWith('R')) status = 'renamed'

    const existing = fileMap.get(path)
    if (existing) {
      existing.status = status
    } else {
      fileMap.set(path, { additions: 0, deletions: 0, status })
    }
  }

  const files = [...fileMap.entries()].map(([path, entry]) => ({
    path,
    status: entry.status,
    additions: entry.additions,
    deletions: entry.deletions
  }))

  return { patch, files }
}

export async function fetchLocalPullRequest(
  ref: ResolvedPullRequest,
  cwd: string
): Promise<PullRequestSession> {
  const branch = (await getCurrentBranch(cwd)) || 'local'
  const baseBranch = ref.baseBranch || (await getBaseBranch(cwd)) || 'main'
  let authorName = 'Local User'
  try {
    const { stdout } = await runCommand('git', ['config', 'user.name'], { cwd })
    if (stdout.trim()) authorName = stdout.trim()
  } catch {
    // ignore
  }

  let patch = ''
  let files: PullRequestSession['files'] = []
  let title = 'Local Changes'
  let description = ''

  if (ref.localMode === 'uncommitted') {
    const changes = await getLocalChanges(cwd, 'HEAD')
    patch = changes.patch
    files = changes.files
    title = 'Uncommitted Changes'
    description = 'Reviewing uncommitted staged and unstaged local changes.'
    if (!patch.trim()) {
      throw new Error('No local uncommitted changes found.')
    }
  } else if (ref.localMode === 'branch') {
    const comparisonBase = `${baseBranch}...`
    const branchChanges = await getLocalChanges(cwd, comparisonBase)
    patch = branchChanges.patch
    files = branchChanges.files
    title = `Local Changes (${branch} ➔ ${baseBranch})`
    description = `Reviewing differences between current branch \`${branch}\` and base branch \`${baseBranch}\`.`
    if (!patch.trim()) {
      throw new Error(`No local changes found relative to base branch "${baseBranch}".`)
    }
  } else {
    const headChanges = await getLocalChanges(cwd, 'HEAD')
    patch = headChanges.patch
    files = headChanges.files
    title = 'Uncommitted Changes'
    description = 'Reviewing uncommitted staged and unstaged local changes.'

    if (!patch.trim()) {
      if (baseBranch && baseBranch !== branch) {
        const comparisonBase = `${baseBranch}...`
        const branchChanges = await getLocalChanges(cwd, comparisonBase)
        if (branchChanges.patch.trim()) {
          patch = branchChanges.patch
          files = branchChanges.files
          title = `Local Changes (${branch} ➔ ${baseBranch})`
          description = `Reviewing differences between current branch \`${branch}\` and base branch \`${baseBranch}\`.`
        }
      }
    }

    if (!patch.trim()) {
      throw new Error('No local changes found (uncommitted or relative to main/master).')
    }
  }

  return {
    provider: ref.provider,
    url: '',
    number: 0,
    title,
    state: 'draft',
    author: { name: authorName },
    base: { ref: baseBranch, sha: '' },
    head: { ref: branch, sha: '' },
    description,
    labels: [{ name: 'local', color: '6e7681' }],
    reviewers: [],
    checks: [],
    files,
    patch,
    comments: [],
    timeline: []
  }
}
