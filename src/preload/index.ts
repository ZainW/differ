import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { PullRequestSession } from '../shared/types/session'

const api = {
  getSession: (): Promise<PullRequestSession | null> => ipcRenderer.invoke('session:get'),
  onSessionLoad: (callback: (session: PullRequestSession) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, session: PullRequestSession): void => {
      callback(session)
    }
    ipcRenderer.on('session:load', handler)
    return () => ipcRenderer.removeListener('session:load', handler)
  },
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('session:open-external', url)
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('differ', api)
