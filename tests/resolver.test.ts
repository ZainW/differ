import { describe, expect, it, vi } from 'vitest'
import { parsePullRequestUrl } from '../src/shared/providers/resolver'
import { parseRemoteUrl, getLocalChanges } from '../src/shared/providers/git'
import { runCommand } from '../src/shared/exec'

vi.mock('../src/shared/exec', () => ({
  runCommand: vi.fn()
}))

describe('parsePullRequestUrl', () => {
  it('parses GitHub pull request URLs', () => {
    expect(parsePullRequestUrl('https://github.com/acme/app/pull/42')).toEqual({
      provider: 'github',
      host: 'github.com',
      owner: 'acme',
      repo: 'app',
      number: 42
    })
  })

  it('parses GitLab merge request URLs', () => {
    expect(
      parsePullRequestUrl('https://gitlab.com/group/subgroup/repo/-/merge_requests/7')
    ).toEqual({
      provider: 'gitlab',
      host: 'gitlab.com',
      owner: 'group/subgroup',
      repo: 'repo',
      number: 7
    })
  })
})

describe('git provider', () => {
  describe('parseRemoteUrl', () => {
    it('parses SSH git URLs', () => {
      expect(parseRemoteUrl('git@github.com:owner/repo.git')).toEqual({
        provider: 'github',
        host: 'github.com',
        owner: 'owner',
        repo: 'repo'
      })
    })

    it('parses HTTPS git URLs', () => {
      expect(parseRemoteUrl('https://gitlab.com/owner/repo.git')).toEqual({
        provider: 'gitlab',
        host: 'gitlab.com',
        owner: 'owner',
        repo: 'repo'
      })
    })
  })

  describe('getLocalChanges', () => {
    it('runs commands concurrently and parses tab-separated outputs with spaces in filenames', async () => {
      const mockRunCommand = vi.mocked(runCommand)

      mockRunCommand.mockImplementation(async (file, args) => {
        if (args[1] === '--numstat') {
          return {
            stdout: '5\t10\tfile with spaces.txt\n1\t2\tother.ts\n',
            exitCode: 0
          }
        }
        if (args[1] === '--name-status') {
          return {
            stdout: 'M\tfile with spaces.txt\nA\tother.ts\n',
            exitCode: 0
          }
        }
        return {
          stdout: 'mock-patch-content',
          exitCode: 0
        }
      })

      const result = await getLocalChanges('mock-cwd', 'mock-base-ref')

      expect(result.patch).toBe('mock-patch-content')
      expect(result.files).toEqual([
        {
          path: 'file with spaces.txt',
          status: 'modified',
          additions: 5,
          deletions: 10
        },
        {
          path: 'other.ts',
          status: 'added',
          additions: 1,
          deletions: 2
        }
      ])

      // Verify command arguments include --no-renames
      expect(mockRunCommand).toHaveBeenCalledWith(
        'git',
        ['diff', '--no-renames', 'mock-base-ref'],
        { cwd: 'mock-cwd' }
      )
      expect(mockRunCommand).toHaveBeenCalledWith(
        'git',
        ['diff', '--numstat', '--no-renames', 'mock-base-ref'],
        { cwd: 'mock-cwd' }
      )
      expect(mockRunCommand).toHaveBeenCalledWith(
        'git',
        ['diff', '--name-status', '--no-renames', 'mock-base-ref'],
        { cwd: 'mock-cwd' }
      )
    })
  })
})
