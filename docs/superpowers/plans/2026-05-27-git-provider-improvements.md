# Git Provider Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve git provider and local changes detection in `src/shared/providers/git.ts` to address five code quality issues found during code review.

**Architecture:**

- Use `\t` split on both `--numstat` and `--name-status` outputs to properly support spaces in filenames.
- Append `--no-renames` to all `git diff` invocations.
- Run the three `git diff` commands concurrently in `getLocalChanges` using `Promise.all`.
- Reuse `isInsideWorkTree(cwd)` within `getRepoContext`.
- Dynamically resolve `baseBranch` in `fetchLocalPullRequest` and use it in `base.ref` instead of hardcoding `'main'`.

**Tech Stack:** TypeScript, Git, Node.js

---

### Task 1: Refactor getRepoContext to reuse isInsideWorkTree

**Files:**

- Modify: `/Users/zain/projects/differ/src/shared/providers/git.ts`

- [ ] **Step 1: Replace work tree checking logic in `getRepoContext`**

Change:

```typescript
export async function getRepoContext(cwd: string): Promise<RepoContext | null> {
  let insideWorkTree = false
  try {
    const { stdout: inside } = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd
    })
    insideWorkTree = inside.trim() === 'true'
  } catch {
    return null
  }

  if (!insideWorkTree) return null
```

To:

```typescript
export async function getRepoContext(cwd: string): Promise<RepoContext | null> {
  const insideWorkTree = await isInsideWorkTree(cwd)
  if (!insideWorkTree) return null
```

- [ ] **Step 2: Run `pnpm typecheck` to verify no compile errors**

Run: `pnpm typecheck`
Expected: PASS

---

### Task 2: Update getLocalChanges with Concurrent Execution, --no-renames, and Tab Parsing

**Files:**

- Modify: `/Users/zain/projects/differ/src/shared/providers/git.ts`

- [ ] **Step 1: Refactor `getLocalChanges` to run commands concurrently, append `--no-renames`, and parse via `\t` split**

Replace the implementation of `getLocalChanges`:

```typescript
export async function getLocalChanges(
  cwd: string,
  baseRef: string
): Promise<{ patch: string; files: PullRequestSession['files'] }> {
  const [{ stdout: patch }, { stdout: numstat }, { stdout: namestatus }] = await Promise.all([
    runCommand('git', ['diff', '--no-renames', baseRef], { cwd }),
    runCommand('git', ['diff', '--numstat', '--no-renames', baseRef], { cwd }),
    runCommand('git', ['diff', '--name-status', '--no-renames', baseRef], { cwd })
  ])

  const fileMap = new Map<
    string,
    { additions: number; deletions: number; status: FileChangeStatus }
  >()

  // Parse numstat
  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const [addStr, delStr, path] = parts
    const additions = addStr === '-' ? 0 : Number(addStr) || 0
    const deletions = delStr === '-' ? 0 : Number(delStr) || 0
    fileMap.set(path, { additions, deletions, status: 'modified' })
  }

  // Parse name-status
  for (const line of namestatus.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
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
```

- [ ] **Step 2: Run `pnpm typecheck` to verify syntax**

Run: `pnpm typecheck`
Expected: PASS

---

### Task 3: Resolve Dynamic Base Branch Ref in fetchLocalPullRequest

**Files:**

- Modify: `/Users/zain/projects/differ/src/shared/providers/git.ts`

- [ ] **Step 1: Update `fetchLocalPullRequest` to resolve and use baseBranch dynamically**

Modify `fetchLocalPullRequest`:

```typescript
export async function fetchLocalPullRequest(
  ref: ResolvedPullRequest,
  cwd: string
): Promise<PullRequestSession> {
  const branch = (await getCurrentBranch(cwd)) || 'local'
  const baseBranch = (await getBaseBranch(cwd)) || 'main'
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

- [ ] **Step 2: Run verification checks (lint, format, build)**

Run: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
Expected: PASS
