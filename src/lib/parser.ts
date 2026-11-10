import { emptyStats, Flag, Group, Line, Stats, ZoneKey } from './types'
import { overall, points } from './stats'

/** Turns what a player says after a run into stats. Rule-based, on-device, and every result is editable. */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const BOX = 'assists?|dimes?|rebounds?|boards?|steals?|blocks?|turnovers?'

function normalize(raw: string): string {
  let s = ' ' + raw.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ') + ' '
  s = s.replace(/\b(all right|alright|right now|right away|right after|right before|that's right|right\?)/g, ' ')

  // Protect every basketball "three" and "line" before number words become digits.
  s = s.replace(/\b(?:(?:from|at|on)\s+(?:the\s+)?(?:free[- ]?throw\s+|foul\s+)?line|free[- ]?throws?|foul shots?|charity stripe|fts)\b/g, ' _ft ')
  s = s.replace(/\b(?:three|3)[- ]?(?:point(?:er)?s?|balls?|pts?)\b(?:\s+(?:shots?|attempts?|line|range))?/g, ' _three ')
  s = s.replace(/\b(?:threes|3s|treys?|deep balls?|long balls?)\b/g, ' _three ')
  s = s.replace(/\b(from|behind|beyond|past|outside)\s+(?:the\s+)?(?:three|3|arc|deep|downtown)\b/g, ' _three ')
  s = s.replace(/\b(?:two|2)[- ]?pointers?\b|\btwos\b/g, ' _two ')

  s = s.replace(new RegExp(`\\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](one|two|three|four|five|six|seven|eight|nine))?\\b`, 'g'),
    (_, t, u) => String(TENS[t] + (u ? UNITS[u] : 0)))
  s = s.replace(new RegExp(`\\b(${Object.keys(UNITS).join('|')})\\b`, 'g'), (w) => String(UNITS[w]))
  s = s.replace(new RegExp(`\\bno\\s+(${BOX})\\b`, 'g'), '0 $1')

  // "seven four twelve" is a misheard "seven for twelve".
  s = s.replace(/\b(\d+) 4 (\d+)\b/g, '$1 for $2')

  // Rewrite makes-and-misses phrasings as a plain "M for A".
  s = s.replace(/\b(?:made|hit|sank|make)\s+(\d+)\b([^.;,]*?)(?:,|\band\b|\bbut\b)?\s*(?:missed|miss)\s+(\d+)\b/g,
    (_, m, mid, k) => ` ${m} for ${+m + +k} ${mid} `)
  s = s.replace(/\b(\d+)\s+(?:makes?|buckets?)\s*(?:,|\band\b)?\s*(\d+)\s+miss(?:es)?\b/g, (_, m, k) => ` ${m} for ${+m + +k} `)
  s = s.replace(/\b(\d+)\s+(?:makes?|buckets?)\s+(?:on|of|out of)\s+(\d+)(?:\s+(?:attempts?|shots?|tries))?\b/g, ' $1 for $2 ')
  s = s.replace(/\b(?:took|shot|attempted|put up)\s+(\d+)\b([^.;,]*?)(?:,|\band\b|\bbut\b)?\s*(?:made|hit|sank|knocked down|hitting|making)\s+(\d+)\b/g,
    (_, a, mid, m) => ` ${m} for ${a} ${mid} `)
  return s
}

interface Loc { zone?: ZoneKey; group?: Group | 'ft' }

function locate(c: string): Loc | null {
  const side = /\bleft\b|\blefty\b/.test(c) ? 'l' : /\bright\b|\brighty\b/.test(c) ? 'r' : null
  if (c.includes('_ft')) return { group: 'ft' }
  const mid = /\bmid\b|mid[- ]?range|\belbows?\b|pull[- ]?ups?|jumpers?|jump shots?|\bbaseline\b|_two/.test(c)
  if (/\bcorners?\b/.test(c) && !/short corner/.test(c)) return side ? { zone: side === 'l' ? 'lc' : 'rc' } : { group: '3' }
  if (/top of (?:the )?(?:key|arc)|straight ?away|from the top|\bat the top\b/.test(c)) return { zone: 'tp' }
  if (/\bwings?\b/.test(c)) {
    if (mid) return side ? { zone: side === 'l' ? 'ml' : 'mr' } : { group: '2' }
    return side ? { zone: side === 'l' ? 'lw' : 'rw' } : { group: '3' }
  }
  if (c.includes('_three')) return side ? { zone: side === 'l' ? 'lw' : 'rw' } : { group: '3' }
  if (/\brim\b|lay-?ups?|lay-?ins?|\bpaint\b|dunks?|finish(?:es|ing)?\b|\binside\b|under the (?:basket|hoop)|at the (?:basket|hoop)|floaters?|\bclose\b/.test(c)) {
    return side ? { zone: side === 'l' ? 'lf' : 'rf' } : { group: 'r' }
  }
  if (mid || /short corner/.test(c)) {
    if (/\bmiddle\b|\bcent(?:er|re)\b|\bnail\b/.test(c)) return { zone: 'mc' }
    return side ? { zone: side === 'l' ? 'ml' : 'mr' } : { group: '2' }
  }
  if (/\bmiddle\b/.test(c)) return { zone: 'mc' }
  return null
}

const pretty = (c: string) => c.replace(/_three/g, 'three').replace(/_ft/g, 'free throws').replace(/_two/g, 'two').replace(/\s+/g, ' ').trim()

export function parseMemo(raw: string): { stats: Stats; flags: Flag[] } {
  const stats = emptyStats()
  const flags: Flag[] = []
  let s = normalize(raw)

  const score = s.match(/\b(won|lost|beat them|tied|final(?: score)?(?: was)?)\s+(?:the game\s+|it\s+|by a score of\s+)?(\d+)\s*(?:to|-|–|:)\s*(\d+)/)
  if (score) {
    const a = +score[2], b = +score[3]
    const hi = Math.max(a, b), lo = Math.min(a, b)
    stats.score = score[1] === 'lost' ? { us: lo, them: hi } : score[1].startsWith('final') || score[1] === 'tied' ? { us: a, them: b } : { us: hi, them: lo }
    s = s.replace(score[0], ' ')
  }

  const box = (keys: string): number => {
    let total = 0, found = false
    s = s.replace(new RegExp(`\\b(\\d+)\\s*(?:total\\s+|offensive\\s+|defensive\\s+)?(?:${keys})\\b`, 'g'), (_, n) => { total += +n; found = true; return ' ' })
    if (!found) s = s.replace(new RegExp(`\\b(?:${keys})\\s*(?:were|was|is|at|:)?\\s*(\\d+)\\b`, 'g'), (_, n) => { total += +n; return ' ' })
    return total
  }
  stats.reb = box('rebounds?|boards?|rebs?')
  stats.ast = box('assists?|dimes?')
  stats.stl = box('steals?')
  stats.blk = box('blocks?|blocked shots?')
  stats.tov = box('turnovers?')

  let spoken: number | null = null
  s = s.replace(/\b(\d+)\s*(?:points|pts)\b/, (_, n) => { spoken = +n; return ' ' })

  const clauses = s.split(/[.;!?\n,]|\band\b|\bthen\b|\bbut\b|\bplus\b|\balso\b/).map((c) => c.trim()).filter(Boolean)
  const over: Line = { m: 0, a: 0 }
  let carry: Loc | null = null

  const commit = (line: Line, loc: Loc | null, c: string) => {
    if (line.m > line.a) {
      flags.push({ kind: 'swap', text: `You said ${line.m} for ${line.a}. We read it as ${line.a} for ${line.m}.` })
      line = { m: line.a, a: line.m }
    }
    const target = !loc ? stats.loose.x : loc.zone ? stats.zones[loc.zone] : loc.group === 'ft' ? stats.ft : stats.loose[loc.group as Group]
    target.m += line.m
    target.a += line.a
    if (!loc) flags.push({ kind: 'noSpot', text: `"${pretty(c)}" has no spot, so it counts as two-pointers.` })
  }

  clauses.forEach((c, i) => {
    const pair = c.match(/\b(\d+)\s*(?:for|of|out of|outta|on|from|\/|-|–)\s*(\d+)\b/)
    let loc = locate(c)
    if (pair) {
      const line = { m: +pair[1], a: +pair[2] }
      if (/\boverall\b|\btotal\b|\bin all\b|all together|altogether|field goals?|from the field/.test(c) && !loc) {
        over.m += line.m; over.a += line.a; carry = null; return
      }
      if (!loc && carry) loc = carry
      if (!loc) {
        // "4 for 10, from three": the place can come right after.
        const next = clauses[i + 1]
        if (next && !/\d/.test(next)) loc = locate(next)
      }
      commit(line, loc, c)
      carry = null
      return
    }
    const missed = c.match(/\bmissed\s+(\d+)\b/)
    if (missed && loc) { commit({ m: 0, a: +missed[1] }, loc, c); carry = null; return }
    const count = c.match(/\b(\d+)\b/)
    if (count && loc) {
      commit({ m: +count[1], a: +count[1] }, loc, c)
      flags.push({ kind: 'noAttempts', text: `"${pretty(c)}" gave makes but no attempts. We assumed you missed none.` })
      carry = null
      return
    }
    if (!count && loc) { carry = loc; return }
    if (count) flags.push({ kind: 'unread', text: `We could not read "${pretty(c)}".` })
  })

  const sum = overall(stats)
  if (over.a) {
    if (over.a > sum.a && over.m >= sum.m) {
      stats.loose.x.m += over.m - sum.m
      stats.loose.x.a += over.a - sum.a
      flags.push({ kind: 'noSpot', text: `${over.a - sum.a} of your ${over.a} attempts have no spot, so they count as two-pointers.` })
    } else if (over.a !== sum.a || over.m !== sum.m) {
      flags.push({ kind: 'overall', text: `You said ${over.m} for ${over.a} overall, but your spots add up to ${sum.m} for ${sum.a}.` })
    }
  }
  if (spoken !== null && spoken !== points(stats) && overall(stats).a > 0) {
    flags.push({ kind: 'points', text: `You said ${spoken} points, but your shots add up to ${points(stats)}.` })
  }
  if (!overall(stats).a && !stats.ft.a && !stats.reb && !stats.ast && !stats.stl && !stats.blk && !stats.tov) {
    flags.push({ kind: 'empty', text: 'We did not catch any stats in that memo. Add them by hand.' })
  }
  return { stats, flags }
}
