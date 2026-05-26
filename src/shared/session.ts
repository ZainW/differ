import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { PullRequestSession } from './types/session'

export function getSessionDir(): string {
  const dir = join(homedir(), '.cache', 'differ', 'sessions')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function writeSession(session: PullRequestSession): string {
  const path = join(getSessionDir(), `${randomUUID()}.json`)
  writeFileSync(path, JSON.stringify(session, null, 2), 'utf8')
  return path
}

export function readSession(path: string): PullRequestSession {
  return JSON.parse(readFileSync(path, 'utf8')) as PullRequestSession
}
