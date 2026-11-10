import { DBSchema, IDBPDatabase, openDB } from 'idb'
import { emptyStats, Profile, Session } from './types'

interface Schema extends DBSchema {
  kv: { key: string; value: Profile }
  sessions: { key: string; value: Session }
  chunks: { key: [string, number]; value: Blob }
  memos: { key: string; value: Blob }
}

let conn: Promise<IDBPDatabase<Schema>> | null = null
const db = () =>
  (conn ??= openDB<Schema>('netrics', 1, {
    upgrade(d) {
      d.createObjectStore('kv')
      d.createObjectStore('sessions', { keyPath: 'id' })
      d.createObjectStore('chunks')
      d.createObjectStore('memos')
    },
  }))

export const defaultProfile = (): Profile => ({
  name: '', pos: 'Guard', lvl: 'Casual', freq: 'Weekly', want: 'See my game', onboarded: false, friends: [], courts: [],
})
export const getProfile = async () => ({ ...defaultProfile(), ...((await (await db()).get('kv', 'profile')) ?? {}) })
export const saveProfile = async (p: Profile) => void (await (await db()).put('kv', p, 'profile'))

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export function newSession(part: Partial<Session>): Session {
  return {
    id: uid(), createdAt: Date.now(), status: 'recording', court: '', mode: 'solo', players: [], durationSec: 0,
    videoMime: null, highlights: [], memoMime: null, transcript: '', stats: emptyStats(), flags: [], ...part,
  }
}
export const getSession = async (id: string) => (await db()).get('sessions', id)
export const saveSession = async (s: Session) => void (await (await db()).put('sessions', s))
export async function listSessions(): Promise<Session[]> {
  return (await (await db()).getAll('sessions')).sort((a, b) => b.createdAt - a.createdAt)
}

const range = (id: string) => IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER])
export const putChunk = async (id: string, seq: number, b: Blob) => void (await (await db()).put('chunks', b, [id, seq]))
export async function getVideo(s: Session): Promise<Blob | null> {
  if (!s.videoMime) return null
  const parts = await (await db()).getAll('chunks', range(s.id))
  return parts.length ? new Blob(parts, { type: s.videoMime }) : null
}
export const putMemo = async (id: string, b: Blob) => void (await (await db()).put('memos', b, id))
export const getMemo = async (id: string) => (await db()).get('memos', id)

export async function deleteSession(id: string) {
  const d = await db()
  await d.delete('sessions', id)
  await d.delete('chunks', range(id))
  await d.delete('memos', id)
}
export async function wipeAll() {
  const d = await db()
  await Promise.all([d.clear('kv'), d.clear('sessions'), d.clear('chunks'), d.clear('memos')])
}
