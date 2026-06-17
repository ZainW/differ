import { Command, CommanderError } from 'commander'
import { AuthError } from './providers/auth'
import { fetchPullRequest } from './providers/fetch'
import { getRepoContext, isInsideWorkTree } from './providers/git'
import { ResolveError, isAutoDetect, resolvePullRequestRef } from './providers/resolver'
import type { PullRequestSession, ResolvedPullRequest } from './types/session'

export type DifferCliArgs = {
  ref?: string
  pr?: boolean
  uncommitted?: boolean
  branch?: boolean | string
  open: boolean
}

export type ParsedDifferCliArgs =
  | {
      kind: 'help'
      text: string
    }
  | {
      kind: 'run'
      args: DifferCliArgs
    }

export class CliArgumentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CliArgumentError'
  }
}

export function parseDifferCliArgs(argv: string[]): ParsedDifferCliArgs {
  let stdout = ''
  let stderr = ''

  const program = new Command()
  program
    .name('differ')
    .description('Review GitHub and GitLab pull requests in a native diff viewer')
    .argument('[ref]', 'PR URL, PR number, or omit to auto-detect from current branch')
    .option('-p, --pr', 'Force remote PR/MR mode')
    .option('-u, --uncommitted', 'Force local uncommitted changes mode')
    .option('-b, --branch [base]', 'Force local branch changes relative to a base branch')
    .option('--no-open', 'Fetch only; do not launch the Electron app')
    .configureOutput({
      writeOut: (value) => {
        stdout += value
      },
      writeErr: (value) => {
        stderr += value
      }
    })
    .exitOverride()

  try {
    program.parse(['node', 'differ', ...argv], { from: 'node' })
  } catch (error) {
    if (error instanceof CommanderError && error.code === 'commander.helpDisplayed') {
      return { kind: 'help', text: stdout }
    }
    throw new CliArgumentError(
      stderr.trim() || (error instanceof Error ? error.message : String(error))
    )
  }

  const [ref, extra] = program.args
  if (extra) {
    throw new CliArgumentError(`error: too many arguments. Unexpected argument '${extra}'.`)
  }

  const options = program.opts<{
    pr?: boolean
    uncommitted?: boolean
    branch?: boolean | string
    open: boolean
  }>()

  return {
    kind: 'run',
    args: {
      ref,
      pr: options.pr,
      uncommitted: options.uncommitted,
      branch: options.branch,
      open: options.open
    }
  }
}

export async function createSessionForCliArgs(
  args: DifferCliArgs,
  cwd: string
): Promise<PullRequestSession> {
  const { ref, pr, uncommitted, branch } = args
  const activeModes = [pr, uncommitted, branch].filter((val) => val !== undefined && val !== false)
  if (activeModes.length > 1) {
    throw new CliArgumentError(
      'Options --pr, --uncommitted, and --branch are mutually exclusive. Please specify only one mode.'
    )
  }

  if (ref && (uncommitted || branch)) {
    throw new CliArgumentError(
      'Cannot specify a PR ref/number when using local modes (--uncommitted or --branch).'
    )
  }

  let resolved: ResolvedPullRequest
  try {
    if (uncommitted || branch) {
      const isGit = await isInsideWorkTree(cwd)
      if (!isGit) throw new Error('Not inside a git work tree.')
      const repo = await getRepoContext(cwd).catch(() => null)
      resolved = {
        provider: repo?.provider || 'github',
        owner: repo?.owner || 'local',
        repo: repo?.repo || 'local-repo',
        host: repo?.host || 'github.com',
        number: 0,
        local: true,
        localMode: uncommitted ? 'uncommitted' : 'branch',
        baseBranch: typeof branch === 'string' ? branch : undefined
      }
    } else {
      resolved = await resolvePullRequestRef(ref, cwd)
    }
  } catch (error) {
    if (!ref) {
      const isGit = await isInsideWorkTree(cwd)
      if (isGit) {
        resolved = {
          provider: 'github',
          owner: 'local',
          repo: 'local-repo',
          host: 'github.com',
          number: 0,
          local: true
        }
      } else {
        throw error
      }
    } else {
      throw error
    }
  }

  try {
    return await fetchPullRequest(resolved, cwd)
  } catch (error) {
    const isAuto = isAutoDetect(resolved) || resolved.local
    const canFallback = !pr && isAuto
    if (
      canFallback &&
      error instanceof Error &&
      (error.message.includes('No open pull request') ||
        error.message.includes('No open merge request') ||
        error.message.includes('No git remotes configured'))
    ) {
      console.warn(`Note: ${error.message}. Falling back to local diff...`)
      return fetchPullRequest({ ...resolved, local: true }, cwd)
    }
    throw error
  }
}

export function formatCliError(error: unknown): string[] {
  if (
    error instanceof CliArgumentError ||
    error instanceof ResolveError ||
    error instanceof AuthError
  ) {
    const lines = [`Error: ${error.message}`]
    if (error instanceof AuthError) {
      for (const hint of error.hints) lines.push(`  -> ${hint}`)
    }
    return lines
  }
  return [error instanceof Error ? error.message : String(error)]
}
