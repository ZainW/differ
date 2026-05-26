import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { PullRequestSession } from '../shared/types/session'

let sessionPath: string | null = null

function readSessionFromArgs(): PullRequestSession | null {
  const arg = process.argv.find((a) => a.startsWith('--session='))
  const path = arg?.slice('--session='.length) ?? process.env.DIFFER_SESSION
  if (!path) return null
  sessionPath = path
  return JSON.parse(readFileSync(path, 'utf8')) as PullRequestSession
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
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', () => {
    if (session) {
      mainWindow.webContents.send('session:load', session)
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.differ.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const session = readSessionFromArgs()

  ipcMain.handle('session:get', () => session)
  ipcMain.handle('session:open-external', (_event, url: string) => {
    shell.openExternal(url)
  })

  createWindow(session)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(session)
  })
})

app.on('window-all-closed', () => {
  if (sessionPath) {
    try {
      unlinkSync(sessionPath)
    } catch {
      // ignore cleanup errors
    }
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
