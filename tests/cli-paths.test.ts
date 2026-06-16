import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { resolveAppRoot } from '../src/cli/paths'

const root = resolve(__dirname, '..')

describe('resolveAppRoot', () => {
  it('uses the package root relative to the built CLI directory', () => {
    expect(resolveAppRoot(resolve(root, 'out/cli'), '/tmp/user-repo')).toBe(root)
  })

  it('falls back when the CLI directory is not inside a package root', () => {
    expect(resolveAppRoot('/tmp/missing/out/cli', '/tmp/user-repo')).toBe('/tmp/user-repo')
  })
})
