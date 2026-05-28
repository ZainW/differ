import { spawn, execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const outDir = resolve(root, 'out/native-screenshots')

// Create output dir
try {
  mkdirSync(outDir, { recursive: true })
} catch {}

const mainEntry = resolve(root, 'out/main/index.js')
const sessionPath = resolve(root, 'tests/visual/fixtures/github-review.session.json')

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function runOSAScript(script) {
  try {
    return execSync(`osascript -e '${script}'`).toString().trim()
  } catch (e) {
    return null
  }
}

async function captureNative(session, filename, prepareFn) {
  console.log(`\nLaunching Electron for: ${filename}`)

  // 1. Launch Electron directly in the background
  const electronProc = spawn('./node_modules/.bin/electron', [mainEntry, `--session=${session}`], {
    cwd: root,
    env: { ...process.env, DIFFER_KEEP_SESSION: '1' },
    stdio: 'ignore'
  })

  await wait(3000) // Wait for window to load and show

  try {
    // 2. Activate "Electron" to bring it to the front
    runOSAScript('tell application "System Events" to set frontmost of process "Electron" to true')
    await wait(500)

    if (prepareFn) {
      await prepareFn()
    }

    // 3. Get window ID of window 1
    const windowId = runOSAScript(
      'tell application "System Events" to tell process "Electron" to get id of window 1'
    )

    if (windowId && windowId !== 'null' && !isNaN(Number(windowId))) {
      console.log(`  Found macOS Window ID: ${windowId}`)
      // 4. Capture native window using macOS screencapture
      const path = resolve(outDir, `${filename}.png`)
      execSync(`screencapture -o -l ${windowId} "${path}"`)
      console.log(`  Saved native macOS screenshot to: out/native-screenshots/${filename}.png`)
    } else {
      // Fallback: try taking screenshot by bounds
      const pos = runOSAScript(
        'tell application "System Events" to tell process "Electron" to get position of window 1'
      )
      const size = runOSAScript(
        'tell application "System Events" to tell process "Electron" to get size of window 1'
      )

      if (pos && size) {
        const [x, y] = pos.split(',').map((s) => s.trim())
        const [w, h] = size.split(',').map((s) => s.trim())
        const path = resolve(outDir, `${filename}.png`)
        console.log(`  Fallback: Capturing bounds ${x},${y},${w},${h}`)
        execSync(`screencapture -o -R ${x},${y},${w},${h} "${path}"`)
        console.log(`  Saved native macOS screenshot to: out/native-screenshots/${filename}.png`)
      } else {
        console.log('  Error: Could not locate Electron window via AppleScript')
      }
    }
  } catch (err) {
    console.error('  Failed to capture native window:', err.message)
  } finally {
    // 5. Clean up Electron process
    electronProc.kill('SIGKILL')
    await wait(500)
  }
}

// Ensure the latest version of the app is built
console.log('Building Electron app...')
execSync('pnpm build', { cwd: root, stdio: 'inherit' })

// Let's do the native audits!
await captureNative(sessionPath, 'differ-macos-split')

// Let's do unified layout by clicking it or sending shortcut
await captureNative(sessionPath, 'differ-macos-unified', async () => {
  // Use AppleScript to toggle unified layout
  // We can press Cmd+Shift+d
  runOSAScript('tell application "System Events" to keystroke "d" using {command down, shift down}')
  await wait(1000)
})

console.log('\nNative macOS visual audit complete!')
