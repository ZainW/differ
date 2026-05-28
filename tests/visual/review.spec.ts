import { expect, test } from '@playwright/test'

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

test.describe('review UI', () => {
  test('github review split layout', async ({ page }) => {
    await page.goto('/visual.html')
    await waitForReviewReady(page)

    await expect(page.locator('.app-shell')).toHaveScreenshot('github-review-split.png', {
      fullPage: true
    })
  })

  test('github review unified layout', async ({ page }) => {
    await page.goto('/visual.html?layout=unified')
    await waitForReviewReady(page)

    await expect(page.locator('.app-shell')).toHaveScreenshot('github-review-unified.png', {
      fullPage: true
    })
  })

  test('github review with description panel', async ({ page }) => {
    await page.goto('/visual.html?description=1')
    await waitForReviewReady(page)

    await expect(page.locator('.app-shell')).toHaveScreenshot('github-review-description.png', {
      fullPage: true
    })
  })
})

test.describe('empty state', () => {
  test('launch screen without session', async ({ page }) => {
    await page.goto('/visual.html?state=empty')
    await page.waitForSelector('.empty-state', { state: 'visible' })

    await expect(page.locator('.app-shell')).toHaveScreenshot('empty-state.png', {
      fullPage: true
    })
  })
})
