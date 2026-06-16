import { existsSync } from 'fs'
import { join } from 'path'

export function resolveAppRoot(cliDir: string, fallback: string): string {
  const root = join(cliDir, '../..')
  if (existsSync(join(root, 'package.json'))) return root
  return fallback
}
