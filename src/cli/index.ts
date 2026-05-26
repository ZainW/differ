#!/usr/bin/env node
import { Command } from 'commander'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { AuthError } from '../shared/providers/auth'
import { fetchPullRequest } from '../shared/providers/fetch'
import { ResolveError, resolvePullRequestRef } from '../shared/providers/resolver'
import { writeSession } from '../shared/session'

const program = new Command()

program
  .name('differ')
  .description('Review GitHub and GitLab pull requests in a native diff viewer')
  .argument('[ref]', 'PR URL, PR number, or omit to auto-detect from current branch')
  .option('--no-open', 'Fetch only; do not launch the Electron app')
  .action(async (ref: string | undefined, options: { open: boolean }) => {
    try {
      const resolved = await resolvePullRequestRef(ref, process.cwd())
      const session = await fetchPullRequest(resolved, process.cwd())
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
  })

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
