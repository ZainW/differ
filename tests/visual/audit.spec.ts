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

async function waitForReviewReady(
  page: import('@playwright/test').Page,
  sidebarVisible: boolean = true
): Promise<void> {
  await page.waitForSelector('[data-testid="pr-header"]', { state: 'visible' })
  if (sidebarVisible) {
    await page.waitForSelector('[data-testid="file-tree-panel"]', { state: 'visible' })
  }
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
            await waitForReviewReady(page, state.sidebar !== false)
            await expect(page.locator('.app-shell')).toHaveScreenshot(
              `audit-${label}.png`,
              { fullPage: true }
            )
          })
        }
      }
    }
  }
})
