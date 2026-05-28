#!/usr/bin/env node
import { Command } from 'commander'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { AuthError } from '../shared/providers/auth'
import { fetchPullRequest } from '../shared/providers/fetch'
import { ResolveError, resolvePullRequestRef, isAutoDetect } from '../shared/providers/resolver'
import { writeSession } from '../shared/session'
import { isInsideWorkTree, getRepoContext } from '../shared/providers/git'
import type { ResolvedPullRequest, PullRequestSession } from '../shared/types/session'

const program = new Command()

program
  .name('differ')
  .description('Review GitHub and GitLab pull requests in a native diff viewer')
  .argument('[ref]', 'PR URL, PR number, or omit to auto-detect from current branch')
  .option('-p, --pr', 'Force remote PR/MR mode')
  .option('-u, --uncommitted', 'Force local uncommitted changes mode')
  .option('-b, --branch [base]', 'Force local branch changes relative to a base branch')
  .option('--no-open', 'Fetch only; do not launch the Electron app')
  .action(
    async (
      ref: string | undefined,
      options: { pr?: boolean; uncommitted?: boolean; branch?: boolean | string; open: boolean }
    ) => {
      const { pr, uncommitted, branch } = options
      const activeModes = [pr, uncommitted, branch].filter(
        (val) => val !== undefined && val !== false
      )
      if (activeModes.length > 1) {
        console.error(
          'Error: Options --pr, --uncommitted, and --branch are mutually exclusive. Please specify only one mode.'
        )
        process.exit(1)
      }

      if (ref && (uncommitted || branch)) {
        console.error(
          'Error: Cannot specify a PR ref/number when using local modes (--uncommitted or --branch).'
        )
        process.exit(1)
      }

      try {
        let resolved: ResolvedPullRequest
        try {
          if (uncommitted || branch) {
            const isGit = await isInsideWorkTree(process.cwd())
            if (isGit) {
              const repo = await getRepoContext(process.cwd()).catch(() => null)
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
              throw new Error('Not inside a git work tree.')
            }
          } else {
            resolved = await resolvePullRequestRef(ref, process.cwd())
          }
        } catch (error) {
          if (!ref) {
            const isGit = await isInsideWorkTree(process.cwd())
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

        let session: PullRequestSession
        try {
          session = await fetchPullRequest(resolved, process.cwd())
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
            resolved = {
              ...resolved,
              local: true
            }
            session = await fetchPullRequest(resolved, process.cwd())
          } else {
            throw error
          }
        }

        const sessionPath = writeSession(session)

        if (!options.open) {
          console.log(sessionPath)
          return
        }

        await launchElectron(sessionPath)
      } catch (error) {
        if (error instanceof ResolveError || error instanceof AuthError) {
          console.error(`Error: ${error.message}`)
          if (error instanceof AuthError) {
            for (const hint of error.hints) console.error(`  → ${hint}`)
          }
          process.exit(1)
        }
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
      }
    }
  )

async function launchElectron(sessionPath: string): Promise<void> {
  const appRoot = process.cwd()
  const builtMain = join(appRoot, 'out/main/index.js')

  if (!existsSync(builtMain)) {
    const child = spawn(
      'pnpm',
      ['exec', 'electron-vite', 'dev', '--', `--session=${sessionPath}`],
      {
        cwd: appRoot,
        stdio: 'inherit',
        env: { ...process.env, DIFFER_SESSION: sessionPath }
      }
    )

    await waitForExit(child)
    return
  }

  const electronPath = resolveElectronPath()
  const child = spawn(electronPath, ['.', `--session=${sessionPath}`], {
    cwd: appRoot,
    stdio: 'inherit',
    env: { ...process.env, DIFFER_SESSION: sessionPath }
  })

  await waitForExit(child)
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0 || code === null) resolve()
      else reject(new Error(`Electron exited with code ${code}`))
    })
  })
}

function resolveElectronPath(): string {
  const local = join(process.cwd(), 'node_modules', '.bin', 'electron')
  if (existsSync(local)) return local
  return require('electron') as string
}

program.parse()
