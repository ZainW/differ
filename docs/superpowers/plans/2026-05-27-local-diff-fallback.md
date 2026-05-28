# Local Git Diff Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a local git diff fallback for the `differ` CLI. When no PR/MR is found or no remotes are configured, the tool will fall back to showing local unstaged/staged changes, or comparing the current branch to `main`/`master`.

**Architecture:**

1. Add `local?: boolean` to the `ResolvedPullRequest` type.
2. In `src/shared/providers/git.ts`, add helper functions:
   - `isInsideWorkTree(cwd: string)`
   - `getBaseBranch(cwd: string)`
   - `getLocalChanges(cwd: string, baseRef: string)`
   - `fetchLocalPullRequest(ref: ResolvedPullRequest, cwd: string)`
3. Integrate the local fetcher into `src/shared/providers/fetch.ts`.
4. Catch auto-detection/resolution errors in `src/cli/index.ts` and fall back to local diff if running inside a git repository.

**Tech Stack:** TypeScript, Node.js child_process, Git CLI, Commander

---

### Task 1: Update Session Types

**Files:**

- Modify: `/Users/zain/projects/differ/src/shared/types/session.ts`

- [ ] **Step 1: Add `local?: boolean` to `ResolvedPullRequest`**

Modify the `ResolvedPullRequest` type to support an optional `local` boolean flag:

```typescript
export type ResolvedPullRequest = {
  provider: ProviderName
  owner: string
  repo: string
  number: number
  host: string
  branch?: string
  local?: boolean
}
```

- [ ] **Step 2: Run `pnpm typecheck` to verify changes**

Run: `pnpm typecheck`
Expected: PASS

---

### Task 2: Implement Local Git Diff Helpers and Fetcher

**Files:**

- Modify: `/Users/zain/projects/differ/src/shared/providers/git.ts`

- [ ] **Step 1: Implement `isInsideWorkTree`, `getBaseBranch`, `getLocalChanges`, and `fetchLocalPullRequest`**

Add these exports to the bottom of the file:

```typescript
import type { ResolvedPullRequest, PullRequestSession, FileChangeStatus } from '../types/session'

export async function isInsideWorkTree(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], { cwd })
    return stdout.trim() === 'true'
  } catch {
    return false
  }
}

export async function getBaseBranch(cwd: string): Promise<string | null> {
  for (const branch of ['main', 'master']) {
    try {
      await runCommand('git', ['rev-parse', '--verify', branch], { cwd })
      return branch
    } catch {
      // ignore
    }
  }
  return null
}

export async function getLocalChanges(
  cwd: string,
  baseRef: string
): Promise<{ patch: string; files: PullRequestSession['files'] }> {
  const { stdout: patch } = await runCommand('git', ['diff', baseRef], { cwd })
  const { stdout: numstat } = await runCommand('git', ['diff', '--numstat', baseRef], { cwd })
  const { stdout: namestatus } = await runCommand('git', ['diff', '--name-status', baseRef], {
    cwd
  })

  const fileMap = new Map<
    string,
    { additions: number; deletions: number; status: FileChangeStatus }
  >()

  // Parse numstat
  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue
    const [addStr, delStr, path] = line.split(/\s+/)
    if (!path) continue
    const additions = addStr === '-' ? 0 : Number(addStr) || 0
    const deletions = delStr === '-' ? 0 : Number(delStr) || 0
    fileMap.set(path, { additions, deletions, status: 'modified' })
  }

  // Parse name-status
  for (const line of namestatus.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split(/\s+/)
    if (parts.length < 2) continue
    const statusChar = parts[0]
    const path = parts[1]
    let status: FileChangeStatus = 'modified'
    if (statusChar.startsWith('A')) status = 'added'
    else if (statusChar.startsWith('D')) status = 'deleted'
    else if (statusChar.startsWith('R')) status = 'renamed'

    const existing = fileMap.get(path)
    if (existing) {
      existing.status = status
    } else {
      fileMap.set(path, { additions: 0, deletions: 0, status })
    }
  }

  const files = [...fileMap.entries()].map(([path, entry]) => ({
    path,
    status: entry.status,
    additions: entry.additions,
    deletions: entry.deletions
  }))

  return { patch, files }
}

export async function fetchLocalPullRequest(
  ref: ResolvedPullRequest,
  cwd: string
): Promise<PullRequestSession> {
  const branch = (await getCurrentBranch(cwd)) || 'local'
  let authorName = 'Local User'
  try {
    const { stdout } = await runCommand('git', ['config', 'user.name'], { cwd })
    if (stdout.trim()) authorName = stdout.trim()
  } catch {
    // ignore
  }

  let title = 'Uncommitted Changes'
  let description = 'Reviewing uncommitted staged and unstaged local changes.'

  // Check if HEAD has changes
  let { patch, files } = await getLocalChanges(cwd, 'HEAD')

  if (!patch.trim()) {
    const baseBranch = await getBaseBranch(cwd)
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

  return {
    provider: ref.provider,
    url: '',
    number: 0,
    title,
    state: 'draft',
    author: { name: authorName },
    base: { ref: 'main', sha: '' },
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

- [ ] **Step 2: Run `pnpm typecheck` to verify syntax and imports**

Run: `pnpm typecheck`
Expected: PASS

---

### Task 3: Route Local Sessions in Fetch Router

**Files:**

- Modify: `/Users/zain/projects/differ/src/shared/providers/fetch.ts`

- [ ] **Step 1: Handle `local` session in `fetchPullRequest`**

Import and call `fetchLocalPullRequest` when `ref.local` is true:

```typescript
import type { PullRequestSession, ResolvedPullRequest } from '../types/session'
import { fetchGithubPullRequest } from './github'
import { fetchGitlabPullRequest } from './gitlab'
import { fetchLocalPullRequest } from './git'

export async function fetchPullRequest(
  ref: ResolvedPullRequest,
  cwd: string
): Promise<PullRequestSession> {
  if (ref.local) {
    return fetchLocalPullRequest(ref, cwd)
  }
  if (ref.provider === 'gitlab') {
    return fetchGitlabPullRequest(ref, cwd)
  }
  return fetchGithubPullRequest(ref, cwd)
}
```

- [ ] **Step 2: Run `pnpm typecheck` to verify router routing**

Run: `pnpm typecheck`
Expected: PASS

---

### Task 4: Integrate Fallback in CLI Action

**Files:**

- Modify: `/Users/zain/projects/differ/src/cli/index.ts`

- [ ] **Step 1: Integrate Resolve & Fetch Error Interception**

Update the action function inside `/Users/zain/projects/differ/src/cli/index.ts` to wrap resolving and fetching with fallback logic:

```typescript
import { ResolveError, resolvePullRequestRef, isAutoDetect } from '../shared/providers/resolver'
import { isInsideWorkTree } from '../shared/providers/git'
```

Update the action function to:

```typescript
  .action(async (ref: string | undefined, options: { open: boolean }) => {
    try {
      let resolved: ResolvedPullRequest
      try {
        resolved = await resolvePullRequestRef(ref, process.cwd())
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
        if (
          isAuto &&
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
```

- [ ] **Step 2: Run `pnpm typecheck` and `pnpm lint` and `pnpm format`**

Run: `pnpm typecheck && pnpm lint && pnpm format`
Expected: PASS

- [ ] **Step 3: Build the application**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Verify local fallback works in the local repo**

Run: `pnpm differ --no-open`
Expected: Prints a generated JSON session path, showing it loaded local changes.
