# CLI Diff Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to pass CLI flags (`-p/--pr`, `-u/--uncommitted`, `-b/--branch [base]`) to select explicit diffing behavior and modes, bypassing the default fallback behavior.

**Architecture:** Extend the CLI arg parser in `src/cli/index.ts` using `commander` options, implement mutual exclusion checks, and propagate `localMode` selection into `ResolvedPullRequest`. Update `fetchLocalPullRequest` in `src/shared/providers/git.ts` to strictly execute either the uncommitted-changes check or branch comparison depending on the selected mode.

**Tech Stack:** TypeScript, Commander.js, Vitest, Git.

---

## File Structure

- Modify: `src/shared/types/session.ts` — Add optional `localMode` and `baseBranch` properties to `ResolvedPullRequest`.
- Modify: `src/shared/providers/git.ts` — Update `fetchLocalPullRequest` to respect the mode flags and base branch override.
- Modify: `src/cli/index.ts` — Configure command line options, add mutual exclusivity validation, and construct the `localMode`/`baseBranch` properties accordingly.
- Create: `tests/git-modes.test.ts` — Add unit tests for `fetchLocalPullRequest` modes under various git mock states.

---

### Task 1: Update TypeScript Types

**Files:**

- Modify: `src/shared/types/session.ts`

- [ ] **Step 1: Read `src/shared/types/session.ts` to locate `ResolvedPullRequest`**
- [ ] **Step 2: Add optional fields to `ResolvedPullRequest`**

Modify: `src/shared/types/session.ts:59-67`

```typescript
export type ResolvedPullRequest = {
  provider: ProviderName
  owner: string
  repo: string
  number: number
  host: string
  branch?: string
  local?: boolean
  localMode?: 'uncommitted' | 'branch'
  baseBranch?: string
}
```

- [ ] **Step 3: Run `pnpm typecheck` to verify no compile errors**

Run: `pnpm typecheck`
Expected: SUCCESS

---

### Task 2: Implement localMode Routing in Git Provider

**Files:**

- Modify: `src/shared/providers/git.ts`

- [ ] **Step 1: Read `src/shared/providers/git.ts` at `fetchLocalPullRequest`**
- [ ] **Step 2: Update `fetchLocalPullRequest` to support modes**

Modify: `src/shared/providers/git.ts:193-248`

```typescript
export async function fetchLocalPullRequest(
  ref: ResolvedPullRequest,
  cwd: string
): Promise<PullRequestSession> {
  const branch = (await getCurrentBranch(cwd)) || 'local'
  const baseBranch = ref.baseBranch || (await getBaseBranch(cwd)) || 'main'
  let authorName = 'Local User'
  try {
    const { stdout } = await runCommand('git', ['config', 'user.name'], { cwd })
    if (stdout.trim()) authorName = stdout.trim()
  } catch {
    // ignore
  }

  let patch = ''
  let files: PullRequestSession['files'] = []
  let title = 'Local Changes'
  let description = ''

  if (ref.localMode === 'uncommitted') {
    const changes = await getLocalChanges(cwd, 'HEAD')
    patch = changes.patch
    files = changes.files
    title = 'Uncommitted Changes'
    description = 'Reviewing uncommitted staged and unstaged local changes.'
    if (!patch.trim()) {
      throw new Error('No local uncommitted changes found.')
    }
  } else if (ref.localMode === 'branch') {
    const comparisonBase = `${baseBranch}...`
    const branchChanges = await getLocalChanges(cwd, comparisonBase)
    patch = branchChanges.patch
    files = branchChanges.files
    title = `Local Changes (${branch} ➔ ${baseBranch})`
    description = `Reviewing differences between current branch \`${branch}\` and base branch \`${baseBranch}\`.`
    if (!patch.trim()) {
      throw new Error(`No local changes found relative to base branch "${baseBranch}".`)
    }
  } else {
    // Check if HEAD has changes
    const headChanges = await getLocalChanges(cwd, 'HEAD')
    patch = headChanges.patch
    files = headChanges.files
    title = 'Uncommitted Changes'
    description = 'Reviewing uncommitted staged and unstaged local changes.'

    if (!patch.trim()) {
      if (baseBranch && baseBranch !== branch) {
        const comparisonBase = `${baseBranch}...`
        const branchChanges = await getLocalChanges(cwd, comparisonBase)
        if (branchChanges.patch.trim()) {
          patch = branchChanges.patch
          files = branchChanges.files
          title = `Local Changes (${branch} ➔ ${baseBranch})`
          description = `Reviewing differences between current branch \`${branch}\` and base branch \`${baseBranch}\`.`
        }
      }
    }

    if (!patch.trim()) {
      throw new Error('No local changes found (uncommitted or relative to main/master).')
    }
  }

  return {
    provider: ref.provider,
    url: '',
    number: 0,
    title,
    state: 'draft',
    author: { name: authorName },
    base: { ref: baseBranch, sha: '' },
    head: { ref: branch, sha: '' },
    description,
    labels: [{ name: 'local', color: '6e7681' }],
    reviewers: [],
    checks: [],
    files,
    patch,
    comments: [],
    timeline: []
  }
}
```

- [ ] **Step 3: Run `pnpm typecheck` to verify changes compile**

Run: `pnpm typecheck`
Expected: SUCCESS

---

### Task 3: Write Unit Tests for Git Local Modes

**Files:**

- Create: `tests/git-modes.test.ts`

- [ ] **Step 1: Write `tests/git-modes.test.ts` to cover `uncommitted` and `branch` modes**

Create `tests/git-modes.test.ts`:

```typescript
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
      if (args[0] === 'diff' && args[2] === 'HEAD') {
        return { stdout: 'mock-uncommitted-patch', exitCode: 0 }
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
      if (args[0] === 'diff' && args[2] === 'main...') {
        return { stdout: 'mock-branch-patch', exitCode: 0 }
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
  })

  it('uses specific base branch when provided in branch mode', async () => {
    mockRunCommand.mockImplementation(async (file, args) => {
      if (args[0] === 'branch' && args[1] === '--show-current') {
        return { stdout: 'feat/test-branch', exitCode: 0 }
      }
      if (args[0] === 'diff' && args[2] === 'dev...') {
        return { stdout: 'mock-dev-patch', exitCode: 0 }
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
})
```

- [ ] **Step 2: Run unit tests via vitest**

Run: `pnpm test --run`
Expected: All tests pass successfully.

---

### Task 4: Configure CLI and Exclusive Validation

**Files:**

- Modify: `src/cli/index.ts`

- [ ] **Step 1: Read `src/cli/index.ts` to locate Commander.js setup and the main action**
- [ ] **Step 2: Register options and implement mutual exclusivity validation**

Modify: `src/cli/index.ts:16-88`

```typescript
program
  .name('differ')
  .description('Review GitHub and GitLab pull requests in a native diff viewer')
  .argument('[ref]', 'PR URL, PR number, or omit to auto-detect from current branch')
  .option('-p, --pr', 'Force remote pull request / merge request mode')
  .option('-u, --uncommitted', 'Force local uncommitted changes mode')
  .option('-b, --branch [base]', 'Force local branch changes relative to a base branch')
  .option('--no-open', 'Fetch only; do not launch the Electron app')
  .action(
    async (
      ref: string | undefined,
      options: { pr?: boolean; uncommitted?: boolean; branch?: boolean | string; open: boolean }
    ) => {
      const { pr, uncommitted, branch } = options
      const modeCount = [pr, uncommitted, branch].filter(Boolean).length
      if (modeCount > 1) {
        console.error(
          'Error: Options --pr, --uncommitted, and --branch are mutually exclusive. Please specify only one mode.'
        )
        process.exit(1)
      }

      if (ref && (uncommitted || branch)) {
        console.error(
          'Error: Cannot specify a PR ref/number when using local modes (--uncommitted or --branch).'
        )
        process.exit(1)
      }

      try {
        let resolved: ResolvedPullRequest
        try {
          if (uncommitted || branch) {
            // Local-only mode. Skip remote resolving but fetch repo context to keep provider info.
            const isGit = await isInsideWorkTree(process.cwd())
            if (isGit) {
              const repo = await getRepoContext(process.cwd()).catch(() => null)
              resolved = {
                provider: repo?.provider || 'github',
                owner: repo?.owner || 'local',
                repo: repo?.repo || 'local-repo',
                host: repo?.host || 'github.com',
                number: 0,
                local: true,
                localMode: uncommitted ? 'uncommitted' : 'branch',
                baseBranch: typeof branch === 'string' ? branch : undefined
              }
            } else {
              throw new Error('Not inside a git work tree.')
            }
          } else {
            resolved = await resolvePullRequestRef(ref, process.cwd())
          }
        } catch (error) {
          if (!ref) {
            const isGit = await isInsideWorkTree(process.cwd())
            if (isGit) {
              resolved = {
                provider: 'github',
                owner: 'local',
                repo: 'local-repo',
                host: 'github.com',
                number: 0,
                local: true
              }
            } else {
              throw error
            }
          } else {
            throw error
          }
        }

        let session: PullRequestSession
        try {
          session = await fetchPullRequest(resolved, process.cwd())
        } catch (error) {
          const isAuto = isAutoDetect(resolved) || resolved.local
          const canFallback = !pr && isAuto
          if (
            canFallback &&
            error instanceof Error &&
            (error.message.includes('No open pull request') ||
              error.message.includes('No open merge request') ||
              error.message.includes('No git remotes configured'))
          ) {
            console.warn(`Note: ${error.message}. Falling back to local diff...`)
            resolved = {
              ...resolved,
              local: true
            }
            session = await fetchPullRequest(resolved, process.cwd())
          } else {
            throw error
          }
        }

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
    }
  )
```

- [ ] **Step 3: Run `pnpm typecheck` to verify CLI compiles successfully**

Run: `pnpm typecheck`
Expected: SUCCESS

- [ ] **Step 4: Build the CLI executable using `pnpm build` or explicit CLI build command**

Run: `pnpm build`
Expected: SUCCESS

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Run whole project test suite**

Run: `pnpm test --run`
Expected: ALL PASS

- [ ] **Step 2: Run typecheck and linting**

Run: `pnpm typecheck && pnpm lint`
Expected: SUCCESS

- [ ] **Step 3: Commit all changes**

```bash
git add src/shared/types/session.ts src/shared/providers/git.ts src/cli/index.ts tests/git-modes.test.ts docs/superpowers/plans/2026-05-27-cli-diff-modes.md
git commit -m "feat: add cli options for specifying diffing modes explicitly"
```
