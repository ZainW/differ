import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isProductionInstall =
  process.env.NODE_ENV === 'production' || process.env.npm_config_production === 'true'

if (isProductionInstall) {
  process.exit(0)
}

const binary = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
const electronBuilder = join(root, 'node_modules', '.bin', binary)

if (!existsSync(electronBuilder)) {
  process.exit(0)
}

const result = spawnSync(electronBuilder, ['install-app-deps'], {
  cwd: root,
  stdio: 'inherit'
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
