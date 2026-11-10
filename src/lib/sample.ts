import { newSession } from './db'
import { parseMemo } from './parser'
import { Session } from './types'

const MEMO =
  'Left corner one for three, right corner two of three. Left wing two for four, top of the key two of four, right wing two for four. ' +
  'Left midrange three for five, middle three of seven, right midrange two for five. Left side finishes three for six, right side four of six. ' +
  'Nine rebounds, four assists, and we won 21 to 18.'

/** A clearly labeled example so people can see a full recap before playing. Never counted in the profile. */
export function sampleSession(): Session {
  const { stats, flags } = parseMemo(MEMO)
  return newSession({
    status: 'confirmed', sample: true, court: 'Sample court', mode: 'multi', players: [], durationSec: 2460,
    transcript: MEMO, stats, flags,
  })
}
