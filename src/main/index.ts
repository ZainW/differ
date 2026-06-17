import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createSessionForCliArgs, formatCliError, parseDifferCliArgs } from '../shared/cli'
import { writeSession } from '../shared/session'
import type { PullRequestSession } from '../shared/types/session'

const APP_ID = 'com.zainw.differ'
let sessionPath: string | null = null
let cliExitRequested = false

function readSessionFromArgs(): PullRequestSession | null {
  const arg = process.argv.find((a) => a.startsWith('--session='))
  const path = arg?.slice('--session='.length) ?? process.env.DIFFER_SESSION
  if (!path) return null
  sessionPath = path
  return JSON.parse(readFileSync(path, 'utf8')) as PullRequestSession
}

function getDirectCliArgs(): string[] | null {
  if (!app.isPackaged) return null
  if (process.argv.some((arg) => arg.startsWith('--session=') || arg === '--session')) return null

  const args = process.argv.slice(1).filter((arg) => !arg.startsWith('-psn_'))
  if (args.length === 0 && !process.stdout.isTTY) return null
  return args
}

async function readSessionFromCliArgs(): Promise<PullRequestSession | null> {
  const args = getDirectCliArgs()
  if (!args) return readSessionFromArgs()

  try {
    const parsed = parseDifferCliArgs(args)
    if (parsed.kind === 'help') {
      process.stdout.write(parsed.text)
      cliExitRequested = true
      app.exit(0)
      return null
    }

    const session = await createSessionForCliArgs(parsed.args, process.cwd())
    sessionPath = writeSession(session)

    if (!parsed.args.open) {
      console.log(sessionPath)
      cliExitRequested = true
      app.exit(0)
      return null
    }

    return session
  } catch (error) {
    for (const line of formatCliError(error)) console.error(line)
    cliExitRequested = true
    app.exit(1)
    return null
  }
}

function createWindow(session: PullRequestSession | null): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: process.env.DIFFER_DISABLE_SANDBOX !== '1'
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void openExternalUrl(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', () => {
    if (session) {
      mainWindow.webContents.send('session:load', session)
    }
  })
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return
    await shell.openExternal(parsed.toString())
  } catch {
    return
  }
}

void app.whenReady().then(async () => {
  electronApp.setAppUserModelId(APP_ID)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const session = await readSessionFromCliArgs()
  if (cliExitRequested) return

  ipcMain.handle('session:get', () => session)
  ipcMain.handle('session:open-external', async (_event, url: string) => {
    await openExternalUrl(url)
  })

  createWindow(session)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(session)
  })
})

app.on('window-all-closed', () => {
  const keepSession =
    process.env.DIFFER_KEEP_SESSION === '1' || process.env.DIFFER_VISUAL_TEST === '1'
  if (sessionPath && !keepSession) {
    try {
      unlinkSync(sessionPath)
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
