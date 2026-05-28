# Visual Audit — Comprehensive Playwright Screenshot Suite

## Goal

Add a dedicated Playwright visual audit spec that captures screenshots of every
major interactive state of the Differ review UI, asserting visual consistency
via `toHaveScreenshot`. This complements the existing `review.spec.ts` (4
smoke-level snapshots) with exhaustive coverage.

## Approach

**URL-param-driven harness (chosen).** Extend `visual-main.tsx` to accept URL
params for all state dimensions (sidebar, file selection, app state). The
Playwright spec enumerates all valid combinations as data-driven parameterized
tests. No UI interaction needed — deterministic, fast, isolated screenshots.

## State Dimensions

| Dimension     | Values                        | URL param              | Default     |
|---------------|-------------------------------|------------------------|-------------|
| App state     | `loaded`, `empty`, `loading`  | `state`                | loaded      |
| Diff layout   | `split`, `unified`            | `layout`               | split       |
| Description   | `0` (closed), `1` (open)      | `description`          | 0           |
| Sidebar       | `0` (hidden), `1` (visible)   | `sidebar`              | 1           |
| File selected | `default` (first), path, `none` | `file`               | default     |
| Theme         | `dark` only (forced by visualTest flag) | —                   | dark        |

## Test Matrix

### App-level states (no session dependency)

| Test                      | Params              | Selector / wait target        |
|---------------------------|---------------------|-------------------------------|
| Empty state               | `state=empty`       | `.empty-state`                |
| Loading state             | `state=loading`     | `.loading-state`              |

### Session-loaded states (fixture: `github-review`)

All combos of: `layout × description × sidebar × fileSelection`

```
2 (split, unified) × 2 (closed, open) × 2 (hidden, visible) × 2 (first, src/auth.ts)
= 16 screenshots
```

Total: **18 screenshots**.

### File selection note

- `default` = first file in fixture (`src/auth.ts` — already auto-selected by App.tsx)
- Explicit path = `src/visual/ready.ts` (third file, demonstrates non-first selection)

Theme is always `dark` — forced by `dataset.visualTest`. Light theme out of scope.

## New URL Params in `visual-main.tsx`

```typescript
const params = new URLSearchParams(window.location.search)

// Existing:
//   state=empty | state=loading  (new: loading)
//   layout=unified
//   description=1

// New:
//   sidebar=0           — hide file tree sidebar (default: visible)
//   file=<path> | none  — select a specific file (default: first file)
```

The `state=loading` param causes `getSession` to return a promise that never
resolves, keeping the app in the loading state indefinitely.

## Playwright Test File

**New file:** `tests/visual/audit.spec.ts`

### Structure

```typescript
import { expect, test } from '@playwright/test'

type AuditState = {
  layout?: 'split' | 'unified'
  description?: boolean
  sidebar?: boolean
  file?: string
  state?: 'loaded' | 'empty' | 'loading'
}

const layouts = ['split', 'unified'] as const
const descriptions = [false, true] as const
const sidebars = [false, true] as const
const fileSelections: (string | undefined)[] = [undefined, 'src/visual/ready.ts']

function buildURL(state: AuditState): string {
  const p = new URLSearchParams()
  if (state.layout) p.set('layout', state.layout)
  if (state.description) p.set('description', '1')
  if (state.sidebar === false) p.set('sidebar', '0')
  if (state.file) p.set('file', state.file)
  if (state.state && state.state !== 'loaded') p.set('state', state.state)
  const qs = p.toString()
  return `/visual.html${qs ? '?' + qs : ''}`
}

function stateLabel(state: AuditState): string {
  const parts: string[] = []
  if (state.state === 'empty') return 'empty'
  if (state.state === 'loading') return 'loading'
  parts.push(state.layout ?? 'split')
  parts.push(state.description ? 'desc-on' : 'desc-off')
  parts.push(state.sidebar !== false ? 'sidebar-on' : 'sidebar-off')
  parts.push(state.file ? 'file-2' : 'file-1')
  return parts.join('--')
}
```

### Wait strategy

| State   | Condition                                     |
|---------|-----------------------------------------------|
| loaded  | `waitForReviewReady()` (same as review.spec)  |
| empty   | `.empty-state` visible                        |
| loading | `.loading-state` visible                      |

### Snapshot naming

Playwright auto-names from the test title. Use a descriptive title per combo:

```
audit-split--desc-on--sidebar-on--file-1.png
audit-unified--desc-off--sidebar-off--file-2.png
audit-empty.png
audit-loading.png
```

## Harness Changes (`visual-main.tsx`)

1. Accept `sidebar` param — skip rendering sidebar if `0`
2. Accept `file` param — convert to selectedPath in preferences
3. Accept `state=loading` — stub `getSession` to return never-resolving promise
4. Existing params (`layout`, `description`, `state=empty`) remain unchanged

## File Organization

```
tests/visual/
  review.spec.ts               — existing (4 smoke tests, unchanged)
  review.spec.ts-snapshots/    — existing baselines
  audit.spec.ts                — NEW: comprehensive parameterized audit
  audit.spec.ts-snapshots/     — auto-created by Playwright
  fixtures/
    github-review.session.json — existing fixture
```

## Out of Scope (for this phase)

- Light theme screenshots
- GitLab fixture screenshots
- Multi-file / diff scroll state
- resizer drag interaction
- Hover/focus states
- Responsive/mobile viewports

## Success Criteria

- `pnpm test:visual` passes with all 22 tests (4 existing + 18 new)
- Every major interactive state has a deterministic baseline screenshot
- Any code change that affects UI rendering causes a visual diff failure in the
  affected screenshots
