import { describe, expect, it } from 'vitest'
import { CliArgumentError, parseDifferCliArgs } from '../src/shared/cli'

describe('parseDifferCliArgs', () => {
  it('parses installed command usage', () => {
    expect(parseDifferCliArgs(['42'])).toEqual({
      kind: 'run',
      args: {
        ref: '42',
        pr: undefined,
        uncommitted: undefined,
        branch: undefined,
        open: true
      }
    })
  })

  it('parses local branch mode with a base branch', () => {
    expect(parseDifferCliArgs(['--branch', 'main'])).toEqual({
      kind: 'run',
      args: {
        ref: undefined,
        pr: undefined,
        uncommitted: undefined,
        branch: 'main',
        open: true
      }
    })
  })

  it('parses fetch-only mode', () => {
    expect(parseDifferCliArgs(['--no-open', 'https://github.com/acme/app/pull/42'])).toEqual({
      kind: 'run',
      args: {
        ref: 'https://github.com/acme/app/pull/42',
        pr: undefined,
        uncommitted: undefined,
        branch: undefined,
        open: false
      }
    })
  })

  it('returns help text without throwing', () => {
    const parsed = parseDifferCliArgs(['--help'])
    expect(parsed.kind).toBe('help')
    expect(parsed.text).toContain('Usage: differ')
  })

  it('rejects extra positional arguments', () => {
    expect(() => parseDifferCliArgs(['42', '43'])).toThrow(CliArgumentError)
  })
})
