import { Group, Line, Session, Stats, ZONES, ZONE_GROUP, ZONE_NAME, ZoneKey } from './types'

export const pct = (l: Line) => (l.a ? Math.round((100 * l.m) / l.a) : 0)
export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const add = (a: Line, b: Line): Line => ({ m: a.m + b.m, a: a.a + b.a })

export function group(s: Stats, g: Group): Line {
  return ZONES.filter((z) => ZONE_GROUP[z] === g).reduce((t, z) => add(t, s.zones[z]), s.loose[g])
}
export function overall(s: Stats): Line {
  return add(add(add(group(s, '3'), group(s, '2')), group(s, 'r')), s.loose.x)
}
/** Shots with no stated range count as twos. */
export function points(s: Stats): number {
  return group(s, '3').m * 3 + (group(s, '2').m + group(s, 'r').m + s.loose.x.m) * 2 + s.ft.m
}
export function hasAnyStats(s: Stats): boolean {
  return overall(s).a + s.ft.a + s.reb + s.ast + s.stl + s.blk + s.tov > 0
}

/** Rec-player thresholds per range. A 45% three is hot; a 45% layup is not. */
const BANDS: Record<Group, [number, number]> = { '3': [40, 28], '2': [48, 35], r: [65, 50] }
export function heat(z: ZoneKey, l: Line): 'hot' | 'warm' | 'cold' {
  const [hot, cold] = BANDS[ZONE_GROUP[z]]
  const p = pct(l)
  return p >= hot ? 'hot' : p < cold ? 'cold' : 'warm'
}

export interface Insight { kicker: string; headline: string; body: string }

export function insight(s: Session, history: Session[]): Insight | null {
  const st = s.stats
  const o = overall(st)
  if (o.a < 5) return null
  const prior = history.filter((h) => h.id !== s.id && h.status === 'confirmed' && !h.sample && h.createdAt < s.createdAt)

  const zoned = ZONES.map((z) => ({ z, l: st.zones[z] })).filter((x) => x.l.a >= 3)
  if (zoned.length >= 2) {
    const sorted = [...zoned].sort((a, b) => pct(b.l) - pct(a.l) || b.l.a - a.l.a)
    const best = sorted[0], worst = sorted[sorted.length - 1]
    if (pct(best.l) - pct(worst.l) >= 20) {
      return {
        kicker: 'Spot to work on',
        headline: `${ZONE_NAME[worst.z]} is costing you`,
        body: `${worst.l.m} of ${worst.l.a} there, against ${best.l.m} of ${best.l.a} from ${ZONE_NAME[best.z].toLowerCase()}.`,
      }
    }
  }
  if (prior.length >= 2) {
    const past = prior.map((p) => overall(p.stats)).reduce(add, { m: 0, a: 0 })
    const diff = pct(o) - pct(past)
    if (Math.abs(diff) >= 5) {
      return {
        kicker: 'Against your average',
        headline: diff > 0 ? `Up ${diff} points on your usual FG%` : `Down ${-diff} points on your usual FG%`,
        body: `${pct(o)}% today, ${pct(past)}% across your last ${prior.length} sessions.`,
      }
    }
  }
  const t = group(st, '3'), r = group(st, 'r')
  if (t.a / o.a >= 0.5 && r.a) {
    return {
      kicker: 'Shot diet',
      headline: 'More than half your shots were threes',
      body: `${t.a} of ${o.a} attempts came from deep at ${pct(t)}%. You hit ${pct(r)}% at the rim.`,
    }
  }
  if (r.a >= 3 && t.a >= 3 && pct(r) < pct(t)) {
    return {
      kicker: 'Finishing',
      headline: 'You shot better from three than at the rim',
      body: `${pct(r)}% at the rim, ${pct(t)}% from three. Close-range makes should be your easiest points.`,
    }
  }
  return {
    kicker: 'Session',
    headline: `${o.m} makes on ${o.a} attempts`,
    body: 'Name the spots in your memo, like "left corner" or "right wing", and Netrics can tell you where you are strong.',
  }
}

export interface Bests { fg: number; makes: number; three: number; points: number }
export function bests(list: Session[]): Bests {
  const b = { fg: 0, makes: 0, three: 0, points: 0 }
  list.forEach((s) => {
    const o = overall(s.stats), t = group(s.stats, '3')
    if (o.a >= 5) b.fg = Math.max(b.fg, pct(o))
    b.makes = Math.max(b.makes, o.m)
    if (t.a >= 3) b.three = Math.max(b.three, pct(t))
    b.points = Math.max(b.points, points(s.stats))
  })
  return b
}
