import { describe, expect, it } from 'vitest'
import { parseMemo } from './parser'
import { group, overall, points } from './stats'

describe('parseMemo', () => {
  it('reads ranges in plain speech', () => {
    const { stats, flags } = parseMemo('I went five for eight at the rim, three of seven from mid range, and four for ten from three. Six rebounds and three assists.')
    expect(group(stats, 'r')).toEqual({ m: 5, a: 8 })
    expect(group(stats, '2')).toEqual({ m: 3, a: 7 })
    expect(group(stats, '3')).toEqual({ m: 4, a: 10 })
    expect(stats.reb).toBe(6)
    expect(stats.ast).toBe(3)
    expect(points(stats)).toBe(28)
    expect(flags).toEqual([])
  })
  it('reads digits as a transcriber writes them', () => {
    const { stats } = parseMemo('Went 7 for 12 from three. 4 of 5 on layups. 9 boards, 2 dimes, 1 steal, 3 turnovers.')
    expect(group(stats, '3')).toEqual({ m: 7, a: 12 })
    expect(group(stats, 'r')).toEqual({ m: 4, a: 5 })
    expect([stats.reb, stats.ast, stats.stl, stats.tov]).toEqual([9, 2, 1, 3])
  })
  it('places named spots on the chart', () => {
    const { stats } = parseMemo('Left corner two for three, right wing one of four, top of the key three for five, left elbow 2 of 2, right side layups 4 for 6.')
    expect(stats.zones.lc).toEqual({ m: 2, a: 3 })
    expect(stats.zones.rw).toEqual({ m: 1, a: 4 })
    expect(stats.zones.tp).toEqual({ m: 3, a: 5 })
    expect(stats.zones.ml).toEqual({ m: 2, a: 2 })
    expect(stats.zones.rf).toEqual({ m: 4, a: 6 })
  })
  it('does not treat "three" the place as the number 3', () => {
    const { stats } = parseMemo('From three I was four for four')
    expect(group(stats, '3')).toEqual({ m: 4, a: 4 })
    expect(group(stats, '2').a).toBe(0)
  })
  it('handles made and missed', () => {
    const { stats } = parseMemo('At the rim I made 6 and missed 2. Took 9 threes and made 3.')
    expect(group(stats, 'r')).toEqual({ m: 6, a: 8 })
    expect(group(stats, '3')).toEqual({ m: 3, a: 9 })
  })
  it('flags makes with no attempts', () => {
    const { stats, flags } = parseMemo('I hit four threes')
    expect(group(stats, '3')).toEqual({ m: 4, a: 4 })
    expect(flags.map((f) => f.kind)).toContain('noAttempts')
  })
  it('swaps and flags impossible lines', () => {
    const { stats, flags } = parseMemo('twelve for seven from three')
    expect(group(stats, '3')).toEqual({ m: 7, a: 12 })
    expect(flags[0].kind).toBe('swap')
  })
  it('keeps free throws out of field goals', () => {
    const { stats } = parseMemo('Three for four from the line and two of five from midrange')
    expect(stats.ft).toEqual({ m: 3, a: 4 })
    expect(overall(stats)).toEqual({ m: 2, a: 5 })
    expect(points(stats)).toBe(7)
  })
  it('reads game scores without mistaking them for shots', () => {
    const { stats } = parseMemo('We lost 18 to 21. I was 5 for 9 from three.')
    expect(stats.score).toEqual({ us: 18, them: 21 })
    expect(overall(stats)).toEqual({ m: 5, a: 9 })
  })
  it('uses overall totals when no spots are given', () => {
    const { stats, flags } = parseMemo('Overall I shot twelve for thirty')
    expect(stats.loose.x).toEqual({ m: 12, a: 30 })
    expect(flags.map((f) => f.kind)).toContain('noSpot')
  })
  it('fills only the remainder when overall and spots are both said', () => {
    const { stats } = parseMemo('Four for ten from three. Overall twelve for thirty.')
    expect(overall(stats)).toEqual({ m: 12, a: 30 })
  })
  it('carries a place into the following clause', () => {
    const { stats } = parseMemo('In the left corner, I was 3 for 5')
    expect(stats.zones.lc).toEqual({ m: 3, a: 5 })
  })
  it('flags a points mismatch', () => {
    const { flags } = parseMemo('Four for ten from three and I had 30 points')
    expect(flags.map((f) => f.kind)).toContain('points')
  })
  it('flags an empty memo', () => {
    expect(parseMemo('felt pretty good out there today').flags[0].kind).toBe('empty')
  })
  it('ignores "right" as a filler word', () => {
    const { stats } = parseMemo('All right, so at the rim 3 for 4')
    expect(stats.zones.rf.a).toBe(0)
    expect(group(stats, 'r')).toEqual({ m: 3, a: 4 })
  })
  it('reads zero box stats', () => {
    expect(parseMemo('no assists and 4 rebounds').stats).toMatchObject({ ast: 0, reb: 4 })
  })
})
