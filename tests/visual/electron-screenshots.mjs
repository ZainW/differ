import { _electron as electron } from '@playwright/test'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, writeFileSync, cpSync, existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const outDir = resolve(root, 'out/electron-screenshots')
mkdirSync(outDir, { recursive: true })

const sessionPath = resolve(root, 'tests/visual/fixtures/github-review.session.json')
const mainEntry = resolve(root, 'out/main/index.js')

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function takeScreenshot(app, name) {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await sleep(3000) // generous wait for React render + diff parse
  const path = resolve(outDir, `${name}.png`)
  await window.screenshot({ path, type: 'png' })
  console.log(`  -> ${name}.png`)
  return window
}

// ── Empty state ──────────────────────────────────────────────
console.log('1/4: Empty state (no session)')
{
  const app = await electron.launch({
    args: [mainEntry],
    env: { ...process.env, DIFFER_KEEP_SESSION: '1' }
  })
  await takeScreenshot(app, '01-empty-state')
  await app.close()
}

// ── Session loaded — split layout ────────────────────────────
console.log('2/4: Session loaded — split layout')
{
  const app = await electron.launch({
    args: [mainEntry, `--session=${sessionPath}`],
    env: { ...process.env, DIFFER_KEEP_SESSION: '1' }
  })
  const window = await takeScreenshot(app, '02-session-split')
  await app.close()
}

// ── Session loaded — unified layout (via localStorage pref) ──
console.log('3/4: Session loaded — unified layout')
{
  const app = await electron.launch({
    args: [mainEntry, `--session=${sessionPath}`],
    env: { ...process.env, DIFFER_KEEP_SESSION: '1' }
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.waitForSelector('[data-testid="pr-header"]')
  await sleep(1000)

  // Toggle to unified layout by clicking the "Unified" button
  const unifiedBtn = window.locator('.diff-layout-toggle button:has-text("Unified")')
  await unifiedBtn.click()
  await sleep(1500)

  const path = resolve(outDir, '03-session-unified.png')
  await window.screenshot({ path, type: 'png' })
  console.log('  -> 03-session-unified.png')
  await app.close()
}

// ── Session loaded — description panel open ──────────────────
console.log('4/4: Session loaded — description panel open')
{
  const app = await electron.launch({
    args: [mainEntry, `--session=${sessionPath}`],
    env: { ...process.env, DIFFER_KEEP_SESSION: '1' }
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.waitForSelector('[data-testid="pr-header"]')
  await sleep(1000)

  // Click description toggle
  const descBtn = window.locator('.description-toggle')
  await descBtn.click()
  await sleep(1000)

  const path = resolve(outDir, '04-session-description.png')
  await window.screenshot({ path, type: 'png' })
  console.log('  -> 04-session-description.png')
  await app.close()
}

console.log(`\nDone! ${4} screenshots saved to out/electron-screenshots/`)
