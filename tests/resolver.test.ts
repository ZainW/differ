import { describe, expect, it } from 'vitest'
import { parsePullRequestUrl } from '../src/shared/providers/resolver'

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
