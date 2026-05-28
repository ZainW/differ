# Visual Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comprehensive Playwright visual audit spec that captures all interactive states of the review UI.

**Architecture:** Extend `visual-main.tsx` with new URL params for sidebar visibility, file selection, and loading state. Add a data-driven parameterized `audit.spec.ts` that enumerates 16 session-state combos + 2 app-level states. Minimal changes to `App.tsx` to read initial state from dataset attributes set by the harness.

**Tech Stack:** Playwright, React 19, TypeScript, Vite visual harness

---

## File Summary

| File                               | Action | Purpose                                              |
| ---------------------------------- | ------ | ---------------------------------------------------- |
| `src/renderer/src/visual-main.tsx` | Modify | Add `sidebar`, `file`, `state=loading` URL params    |
| `src/renderer/src/App.tsx`         | Modify | Read initial sidebar + file state from dataset attrs |
| `tests/visual/audit.spec.ts`       | Create | Parameterized audit spec with 18 screenshots         |

---

### Task 1: Extend `visual-main.tsx` with new URL params

**Files:**

- Modify: `src/renderer/src/visual-main.tsx`

- [ ] **Step 1: Read current visual-main.tsx to understand the state setup**

```
Already read: currently sets localStorage preferences from URL params (layout, description) and stubs window.differ for the fixture session.
```

- [ ] **Step 2: Add sidebar param handler**

After the existing `preferences` object is built and written to localStorage, add:

```typescript
if (params.get('sidebar') === '0') {
  document.documentElement.dataset.sidebarHidden = 'true'
}
```

- [ ] **Step 3: Add file param handler**

After the sidebar check, add:

```typescript
const fileParam = params.get('file')
if (fileParam) {
  document.documentElement.dataset.selectedFile = fileParam
}
```

- [ ] **Step 4: Modify getSession for loading state**

Change the `window.differ.getSession` function to:

```typescript
window.differ = {
  getSession: async () => {
    if (params.get('state') === 'loading') {
      return new Promise<PullRequestSession>(() => {})
    }
    return session
  },
  onSessionLoad: (callback) => {
    if (session) callback(session)
    return () => undefined
  },
  openExternal: async () => undefined
}
```

- [ ] **Step 5: Verify the file builds**

Run: `pnpm build:visual`
Expected: builds without errors

---

### Task 2: Modify `App.tsx` to read dataset attrs

**Files:**

- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Read current App.tsx to find initial state lines**

```
Already read: line 29 has `const [selectedPath, setSelectedPath] = useState<string | null>(null)`
line 30 has `const [sidebarOpen, setSidebarOpen] = useState(true)`
```

- [ ] **Step 2: Change sidebarOpen initializer**

Replace:

```typescript
const [sidebarOpen, setSidebarOpen] = useState(true)
```

With:

```typescript
const [sidebarOpen, setSidebarOpen] = useState(
  document.documentElement.dataset.sidebarHidden !== 'true'
)
```

- [ ] **Step 3: Change selectedPath initializer**

Replace:

```typescript
const [selectedPath, setSelectedPath] = useState<string | null>(null)
```

With:

```typescript
const selectedFile = document.documentElement.dataset.selectedFile
const [selectedPath, setSelectedPath] = useState<string | null>(selectedFile ? selectedFile : null)
```

- [ ] **Step 4: Verify the visual harness builds**

Run: `pnpm build:visual`
Expected: builds without errors

---

### Task 3: Write the audit spec (`audit.spec.ts`)

**Files:**

- Create: `tests/visual/audit.spec.ts`

- [ ] **Step 1: Write the complete audit spec**

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
  if (state.state === 'empty') return 'empty'
  if (state.state === 'loading') return 'loading'
  const parts: string[] = []
  parts.push(state.layout ?? 'split')
  parts.push(state.description ? 'desc-on' : 'desc-off')
  parts.push(state.sidebar !== false ? 'sidebar-on' : 'sidebar-off')
  parts.push(state.file ? 'file-2' : 'file-1')
  return parts.join('--')
}

async function waitForReviewReady(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForSelector('[data-testid="pr-header"]', { state: 'visible' })
  await page.waitForSelector('[data-testid="file-tree-panel"]', { state: 'visible' })
  await page.waitForSelector('[data-testid="diff-panel"]', { state: 'visible' })
  await page.waitForFunction(
    () => document.documentElement.dataset.visualReady === 'true',
    undefined,
    { timeout: 30_000 }
  )
  await page.waitForTimeout(250)
}

test.describe('visual audit', () => {
  test('empty state', async ({ page }) => {
    await page.goto('/visual.html?state=empty')
    await page.waitForSelector('.empty-state', { state: 'visible' })
    await expect(page.locator('.app-shell')).toHaveScreenshot('audit-empty.png', {
      fullPage: true
    })
  })

  test('loading state', async ({ page }) => {
    await page.goto('/visual.html?state=loading')
    await page.waitForSelector('.loading-state', { state: 'visible' })
    await expect(page.locator('.app-shell')).toHaveScreenshot('audit-loading.png', {
      fullPage: true
    })
  })

  for (const layout of layouts) {
    for (const description of descriptions) {
      for (const sidebar of sidebars) {
        for (const file of fileSelections) {
          const state: AuditState = { layout, description, sidebar, file }
          const label = stateLabel(state)

          test(`session state: ${label}`, async ({ page }) => {
            await page.goto(buildURL(state))
            await waitForReviewReady(page)
            await expect(page.locator('.app-shell')).toHaveScreenshot(`audit-${label}.png`, {
              fullPage: true
            })
          })
        }
      }
    }
  }
})
```

- [ ] **Step 2: Run the audit spec to generate baselines**

Run: `pnpm test:visual:update`
Expected: all 18 tests run, pass, and generate `.png` files in `tests/visual/audit.spec.ts-snapshots/`

- [ ] **Step 3: Run the audit spec in assert mode**

Run: `pnpm test:visual`
Expected: all `tests/visual/review.spec.ts` (4) + `tests/visual/audit.spec.ts` (18) = 22 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/visual-main.tsx src/renderer/src/App.tsx tests/visual/audit.spec.ts tests/visual/audit.spec.ts-snapshots/
git commit -m "feat: add comprehensive visual audit spec (18 parameterized screenshots)"
```
