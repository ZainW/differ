import { existsSync } from 'fs'
import { spawnSync } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const cliPath = join(root, 'out/cli/index.js')

if (!existsSync(cliPath)) {
  const build = spawnSync('pnpm', ['run', 'build:cli'], {
    cwd: root,
    stdio: 'inherit'
  })
  if (build.status !== 0) {
    process.exit(build.status ?? 1)
  }
}

const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env
})

process.exit(result.status ?? 1)
