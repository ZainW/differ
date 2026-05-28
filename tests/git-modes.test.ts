import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchLocalPullRequest } from '../src/shared/providers/git'
import { runCommand } from '../src/shared/exec'
import type { ResolvedPullRequest } from '../src/shared/types/session'

vi.mock('../src/shared/exec', () => ({
  runCommand: vi.fn()
}))

describe('fetchLocalPullRequest modes', () => {
  const mockRunCommand = vi.mocked(runCommand)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('strictly checks uncommitted changes when localMode is uncommitted', async () => {
    mockRunCommand.mockImplementation(async (file, args) => {
      if (args[0] === 'branch' && args[1] === '--show-current') {
        return { stdout: 'feat/test-branch', exitCode: 0 }
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return { stdout: 'hash', exitCode: 0 }
      }
      if (args[0] === 'config' && args[1] === 'user.name') {
        return { stdout: 'Test User', exitCode: 0 }
      }
      if (args[0] === 'diff') {
        if (args.includes('--numstat')) {
          return { stdout: '2\t1\tfile1.ts\n', exitCode: 0 }
        }
        if (args.includes('--name-status')) {
          return { stdout: 'M\tfile1.ts\n', exitCode: 0 }
        }
        if (args.includes('HEAD')) {
          return { stdout: 'mock-uncommitted-patch', exitCode: 0 }
        }
      }
      return { stdout: '', exitCode: 0 }
    })

    const ref: ResolvedPullRequest = {
      provider: 'github',
      owner: 'local',
      repo: 'local-repo',
      host: 'github.com',
      number: 0,
      local: true,
      localMode: 'uncommitted'
    }

    const session = await fetchLocalPullRequest(ref, 'mock-cwd')
    expect(session.title).toBe('Uncommitted Changes')
    expect(session.patch).toBe('mock-uncommitted-patch')
    expect(session.files).toEqual([
      { path: 'file1.ts', status: 'modified', additions: 2, deletions: 1 }
    ])

    expect(mockRunCommand).toHaveBeenCalledWith('git', ['diff', '--no-renames', 'HEAD'], {
      cwd: 'mock-cwd'
    })
    expect(mockRunCommand).not.toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['diff', '--no-renames', 'main...']),
      expect.any(Object)
    )
  })

  it('fails in uncommitted mode if no uncommitted changes exist', async () => {
    mockRunCommand.mockImplementation(async (file, args) => {
      if (args[0] === 'branch' && args[1] === '--show-current') {
        return { stdout: 'feat/test-branch', exitCode: 0 }
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return { stdout: 'hash', exitCode: 0 }
      }
      return { stdout: '', exitCode: 0 }
    })

    const ref: ResolvedPullRequest = {
      provider: 'github',
      owner: 'local',
      repo: 'local-repo',
      host: 'github.com',
      number: 0,
      local: true,
      localMode: 'uncommitted'
    }

    await expect(fetchLocalPullRequest(ref, 'mock-cwd')).rejects.toThrow(
      'No local uncommitted changes found.'
    )
  })

  it('strictly checks branch changes when localMode is branch', async () => {
    mockRunCommand.mockImplementation(async (file, args) => {
      if (args[0] === 'branch' && args[1] === '--show-current') {
        return { stdout: 'feat/test-branch', exitCode: 0 }
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return { stdout: 'hash', exitCode: 0 }
      }
      if (args[0] === 'diff') {
        if (args.includes('--numstat')) {
          return { stdout: '3\t4\tfile2.ts\n', exitCode: 0 }
        }
        if (args.includes('--name-status')) {
          return { stdout: 'M\tfile2.ts\n', exitCode: 0 }
        }
        if (args.includes('main...')) {
          return { stdout: 'mock-branch-patch', exitCode: 0 }
        }
      }
      return { stdout: '', exitCode: 0 }
    })

    const ref: ResolvedPullRequest = {
      provider: 'github',
      owner: 'local',
      repo: 'local-repo',
      host: 'github.com',
      number: 0,
      local: true,
      localMode: 'branch'
    }

    const session = await fetchLocalPullRequest(ref, 'mock-cwd')
    expect(session.title).toBe('Local Changes (feat/test-branch ➔ main)')
    expect(session.patch).toBe('mock-branch-patch')
    expect(session.files).toEqual([
      { path: 'file2.ts', status: 'modified', additions: 3, deletions: 4 }
    ])

    expect(mockRunCommand).toHaveBeenCalledWith('git', ['diff', '--no-renames', 'main...'], {
      cwd: 'mock-cwd'
    })
    expect(mockRunCommand).not.toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['diff', '--no-renames', 'HEAD']),
      expect.any(Object)
    )
  })

  it('uses specific base branch when provided in branch mode', async () => {
    mockRunCommand.mockImplementation(async (file, args) => {
      if (args[0] === 'branch' && args[1] === '--show-current') {
        return { stdout: 'feat/test-branch', exitCode: 0 }
      }
      if (args[0] === 'diff') {
        if (args.includes('dev...')) {
          return { stdout: 'mock-dev-patch', exitCode: 0 }
        }
      }
      return { stdout: '', exitCode: 0 }
    })

    const ref: ResolvedPullRequest = {
      provider: 'github',
      owner: 'local',
      repo: 'local-repo',
      host: 'github.com',
      number: 0,
      local: true,
      localMode: 'branch',
      baseBranch: 'dev'
    }

    const session = await fetchLocalPullRequest(ref, 'mock-cwd')
    expect(session.base.ref).toBe('dev')
    expect(session.patch).toBe('mock-dev-patch')
  })

  describe('default mode (no localMode specified)', () => {
    it('returns uncommitted changes first if they exist', async () => {
      mockRunCommand.mockImplementation(async (file, args) => {
        if (args[0] === 'branch' && args[1] === '--show-current') {
          return { stdout: 'feat/test-branch', exitCode: 0 }
        }
        if (args[0] === 'rev-parse' && args[1] === '--verify') {
          return { stdout: 'hash', exitCode: 0 }
        }
        if (args[0] === 'diff' && args.includes('HEAD')) {
          return { stdout: 'fallback-uncommitted-patch', exitCode: 0 }
        }
        return { stdout: '', exitCode: 0 }
      })

      const ref: ResolvedPullRequest = {
        provider: 'github',
        owner: 'local',
        repo: 'local-repo',
        host: 'github.com',
        number: 0,
        local: true
      }

      const session = await fetchLocalPullRequest(ref, 'mock-cwd')
      expect(session.title).toBe('Uncommitted Changes')
      expect(session.patch).toBe('fallback-uncommitted-patch')
    })

    it('falls back to branch changes relative to main/master if HEAD has no changes', async () => {
      mockRunCommand.mockImplementation(async (file, args) => {
        if (args[0] === 'branch' && args[1] === '--show-current') {
          return { stdout: 'feat/test-branch', exitCode: 0 }
        }
        if (args[0] === 'rev-parse' && args[1] === '--verify') {
          return { stdout: 'hash', exitCode: 0 }
        }
        if (args[0] === 'diff') {
          if (args.includes('HEAD')) {
            return { stdout: '', exitCode: 0 }
          }
          if (args.includes('main...')) {
            return { stdout: 'fallback-branch-patch', exitCode: 0 }
          }
        }
        return { stdout: '', exitCode: 0 }
      })

      const ref: ResolvedPullRequest = {
        provider: 'github',
        owner: 'local',
        repo: 'local-repo',
        host: 'github.com',
        number: 0,
        local: true
      }

      const session = await fetchLocalPullRequest(ref, 'mock-cwd')
      expect(session.title).toBe('Local Changes (feat/test-branch ➔ main)')
      expect(session.patch).toBe('fallback-branch-patch')
    })

    it('throws fallback error if neither uncommitted nor branch changes exist', async () => {
      mockRunCommand.mockImplementation(async (file, args) => {
        if (args[0] === 'branch' && args[1] === '--show-current') {
          return { stdout: 'feat/test-branch', exitCode: 0 }
        }
        if (args[0] === 'rev-parse' && args[1] === '--verify') {
          return { stdout: 'hash', exitCode: 0 }
        }
        return { stdout: '', exitCode: 0 }
      })

      const ref: ResolvedPullRequest = {
        provider: 'github',
        owner: 'local',
        repo: 'local-repo',
        host: 'github.com',
        number: 0,
        local: true
      }

      await expect(fetchLocalPullRequest(ref, 'mock-cwd')).rejects.toThrow(
        'No local changes found (uncommitted or relative to main/master).'
      )
    })
  })
})
