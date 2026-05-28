# CLI Diff Modes Specification

Introduce command-line flags to select the diffing mode explicitly, allowing the user to bypass the default fallback flow.

## Requirements

1. **Explicit Mode Flags**:
   - `-p, --pr`: Force remote pull/merge request mode. If a remote PR is not found, fail rather than falling back to local changes.
   - `-u, --uncommitted`: Force local uncommitted changes mode. Bypass remote PR/MR checks.
   - `-b, --branch [base]`: Force local branch diff against the base branch. Defaults to auto-detected base branch (`main`/`master`), or a custom base branch if supplied (e.g. `--branch dev`).

2. **Mutual Exclusion**:
   - The `--pr`, `--uncommitted`, and `--branch` flags are mutually exclusive. Display an error message and exit if more than one is specified.

3. **Default Behavior**:
   - If no mode-selection flags are passed, follow the original seamless fallback chain:
     `PR/MR lookup` ➔ `Uncommitted changes (HEAD)` ➔ `Diff from main (baseBranch...)`.

## Proposed Architecture

### 1. CLI Parsing (`src/cli/index.ts`)

Configure `commander` with the new options and validate their mutual exclusivity:

```typescript
program
  .name('differ')
  .description('Review GitHub and GitLab pull requests in a native diff viewer')
  .argument('[ref]', 'PR URL, PR number, or omit to auto-detect from current branch')
  .option('-p, --pr', 'Force remote pull request / merge request mode')
  .option('-u, --uncommitted', 'Force local uncommitted changes mode')
  .option('-b, --branch [base]', 'Force local branch changes relative to a base branch')
  .option('--no-open', 'Fetch only; do not launch the Electron app')
```

**Exclusivity check:**
```typescript
const { pr, uncommitted, branch } = options
const modeCount = [pr, uncommitted, branch].filter(Boolean).length
if (modeCount > 1) {
  console.error('Error: Options --pr, --uncommitted, and --branch are mutually exclusive. Please specify only one mode.')
  process.exit(1)
}
```

### 2. Session Type updates (`src/shared/types/session.ts`)

Add optional `localMode` and `baseBranch` properties to `ResolvedPullRequest`:

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

### 3. Local Diff adjustments (`src/shared/providers/git.ts`)

Modify `fetchLocalPullRequest` to support targeted extraction:

```typescript
export async function fetchLocalPullRequest(
  ref: ResolvedPullRequest,
  cwd: string
): Promise<PullRequestSession> {
  const branch = (await getCurrentBranch(cwd)) || 'local'
  const baseBranch = ref.baseBranch || (await getBaseBranch(cwd)) || 'main'
  // ...
  
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
    // Default fallback chain
    const changes = await getLocalChanges(cwd, 'HEAD')
    patch = changes.patch
    files = changes.files
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
  // ...
}
```
