#!/usr/bin/env node
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { createSessionForCliArgs, formatCliError, parseDifferCliArgs } from '../shared/cli'
import { writeSession } from '../shared/session'
import { resolveAppRoot } from './paths'

async function main(): Promise<void> {
  try {
    const parsed = parseDifferCliArgs(process.argv.slice(2))
    if (parsed.kind === 'help') {
      process.stdout.write(parsed.text)
      return
    }

    const session = await createSessionForCliArgs(parsed.args, process.cwd())
    const sessionPath = writeSession(session)

    if (!parsed.args.open) {
      console.log(sessionPath)
      return
    }

    await launchElectron(sessionPath)
  } catch (error) {
    for (const line of formatCliError(error)) console.error(line)
    process.exit(1)
  }
}

async function launchElectron(sessionPath: string): Promise<void> {
  const appRoot = resolveAppRoot(__dirname, process.cwd())
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

  const electronPath = resolveElectronPath(appRoot)
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

function resolveElectronPath(appRoot: string): string {
  const local = join(appRoot, 'node_modules', '.bin', 'electron')
  if (existsSync(local)) return local
  return require('electron') as string
}

void main()
