export type ZoneKey = 'lc' | 'lw' | 'tp' | 'rw' | 'rc' | 'ml' | 'mc' | 'mr' | 'lf' | 'rf'
export type Group = '3' | '2' | 'r'
export interface Line { m: number; a: number }

export const ZONES: ZoneKey[] = ['lc', 'lw', 'tp', 'rw', 'rc', 'ml', 'mc', 'mr', 'lf', 'rf']
export const ZONE_NAME: Record<ZoneKey, string> = {
  lc: 'Left corner 3', lw: 'Left wing 3', tp: 'Top of key 3', rw: 'Right wing 3', rc: 'Right corner 3',
  ml: 'Left midrange', mc: 'Middle midrange', mr: 'Right midrange', lf: 'Left-side finish', rf: 'Right-side finish',
}
export const ZONE_GROUP: Record<ZoneKey, Group> = {
  lc: '3', lw: '3', tp: '3', rw: '3', rc: '3', ml: '2', mc: '2', mr: '2', lf: 'r', rf: 'r',
}
export const GROUP_NAME: Record<Group, string> = { '3': 'Three-point', '2': 'Mid-range', r: 'At rim' }

export interface Stats {
  zones: Record<ZoneKey, Line>
  /** Shots the player gave a range for but no spot ("4 for 10 from three"). x = no range at all. */
  loose: Record<Group | 'x', Line>
  ft: Line
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  score: { us: number; them: number } | null
}

export type FlagKind = 'swap' | 'noAttempts' | 'noSpot' | 'unread' | 'points' | 'overall' | 'empty'
export interface Flag { kind: FlagKind; text: string }

export interface Highlight { id: string; t: number; label: string }

export interface Session {
  id: string
  createdAt: number
  status: 'recording' | 'logging' | 'draft' | 'confirmed'
  sample?: boolean
  court: string
  mode: 'solo' | 'multi'
  players: string[]
  durationSec: number
  videoMime: string | null
  highlights: Highlight[]
  memoMime: string | null
  transcript: string
  stats: Stats
  flags: Flag[]
}

export interface Profile {
  name: string
  pos: string
  lvl: string
  freq: string
  want: string
  onboarded: boolean
  friends: string[]
  courts: string[]
}

export const emptyLine = (): Line => ({ m: 0, a: 0 })
export function emptyStats(): Stats {
  const zones = {} as Record<ZoneKey, Line>
  ZONES.forEach((z) => (zones[z] = emptyLine()))
  return {
    zones,
    loose: { '3': emptyLine(), '2': emptyLine(), r: emptyLine(), x: emptyLine() },
    ft: emptyLine(), reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, score: null,
  }
}
