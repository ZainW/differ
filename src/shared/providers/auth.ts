import { runCommand } from '../exec'

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly hints: string[] = []
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

async function tryGhToken(): Promise<string | null> {
  try {
    const { stdout } = await runCommand('gh', ['auth', 'token'], { reject: false })
    const token = stdout.trim()
    return token || null
  } catch {
    return null
  }
}

async function tryGlabToken(): Promise<string | null> {
  try {
    const { stdout } = await runCommand('glab', ['auth', 'status'], { reject: false })
    if (!stdout.includes('Logged in')) return null
    const { stdout: token } = await runCommand('glab', ['config', 'get', 'token'], {
      reject: false
    })
    return token.trim() || null
  } catch {
    return null
  }
}

export async function resolveToken(provider: 'github' | 'gitlab'): Promise<string> {
  if (provider === 'github') {
    const gh = await tryGhToken()
    if (gh) return gh
    const env = process.env.GITHUB_TOKEN?.trim()
    if (env) return env
    throw new AuthError('GitHub authentication required.', [
      'Run: gh auth login',
      'Or set GITHUB_TOKEN in your environment'
    ])
  }

  const glab = await tryGlabToken()
  if (glab) return glab
  const env = process.env.GITLAB_TOKEN?.trim() || process.env.GLAB_TOKEN?.trim()
  if (env) return env
  throw new AuthError('GitLab authentication required.', [
    'Run: glab auth login',
    'Or set GITLAB_TOKEN or GLAB_TOKEN in your environment'
  ])
}
