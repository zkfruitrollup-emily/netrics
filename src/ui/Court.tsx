import { useMemo } from 'react'
import { heat, group, pct } from '../lib/stats'
import { Stats, ZONES, ZONE_GROUP, ZONE_NAME, ZoneKey } from '../lib/types'

const INSIDE = 'M30 270L30 161.2A142.5 142.5 0 0 1 270 161.2L270 270Z'
const OUTSIDE = 'M0 0H300V270H0Z M270 270L270 161.2A142.5 142.5 0 0 0 30 161.2L30 270Z'
const RECT: Record<ZoneKey, [number, number, number, number, 'o' | 'i' | '']> = {
  lc: [0, 161, 30, 109, 'o'], rc: [270, 161, 30, 109, 'o'], lw: [0, 0, 112, 161, 'o'], tp: [112, 0, 76, 161, 'o'], rw: [188, 0, 112, 161, 'o'],
  ml: [0, 0, 102, 270, 'i'], mc: [102, 0, 96, 156, 'i'], mr: [198, 0, 102, 270, 'i'], lf: [102, 156, 48, 114, ''], rf: [150, 156, 48, 114, ''],
}
const LABEL: Record<ZoneKey, [number, number]> = {
  lc: [17, 212], lw: [52, 100], tp: [150, 50], rw: [248, 100], rc: [283, 212], ml: [66, 205], mc: [150, 126], mr: [234, 205], lf: [126, 192], rf: [174, 192],
}
const GREEN = '#0A7F48', INK = '#0F2019', LINE = '#A9BAB1'

function mulberry(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const rad = (d: number) => (d * Math.PI) / 180
function scatter(z: ZoneKey, r: () => number): [number, number] {
  const polar = (a: number, b: number): [number, number] => { const f = a + r() * (b - a), d = 150 + r() * 12; return [150 + d * Math.sin(rad(f)), 238 - d * Math.cos(rad(f))] }
  switch (z) {
    case 'lc': return [8 + r() * 16, 185 + r() * 72]
    case 'rc': return [276 + r() * 16, 185 + r() * 72]
    case 'lw': return polar(-58, -30)
    case 'tp': return polar(-13, 13)
    case 'rw': return polar(30, 58)
    case 'ml': return [52 + r() * 44, 152 + r() * 96]
    case 'mc': return [120 + r() * 60, 114 + r() * 34]
    case 'mr': return [204 + r() * 44, 152 + r() * 96]
    case 'lf': return [112 + r() * 26, 208 + r() * 42]
    case 'rf': return [162 + r() * 26, 208 + r() * 42]
  }
}

interface Props { stats: Stats; mode?: 'both' | 'zones'; small?: boolean; selected?: ZoneKey | null; onZone?: (z: ZoneKey) => void; uid: string }

export function Court({ stats, mode = 'both', small, selected, onZone, uid }: Props) {
  const zm = mode === 'zones'
  const dots = useMemo(() => {
    const out: { z: ZoneKey; x: number; y: number; made: boolean; k: string }[] = []
    ZONES.forEach((z, zi) => {
      const r = mulberry(zi * 97 + 11), l = stats.zones[z]
      for (let i = 0; i < l.a; i++) { const [x, y] = scatter(z, r); out.push({ z, x, y, made: i < l.m, k: z + i }) }
    })
    return out
  }, [stats])

  return <svg viewBox="0 0 300 270" className="court" role="img" aria-label="Half-court shot chart">
    <defs>
      <pattern id={`h${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#EEF2F0" /><line x1="0" y1="0" x2="0" y2="6" stroke="#9FB0A7" strokeWidth="2" /></pattern>
      <clipPath id={`i${uid}`}><path d={INSIDE} /></clipPath><clipPath id={`o${uid}`}><path d={OUTSIDE} clipRule="evenodd" /></clipPath>
    </defs>
    <rect width="300" height="270" fill="#FAFCFB" />
    {ZONES.map((z) => {
      const [x, y, w, h, c] = RECT[z], own = stats.zones[z], loose = stats.loose[ZONE_GROUP[z]]
      const clip = c === 'o' ? `url(#o${uid})` : c === 'i' ? `url(#i${uid})` : undefined
      const l = own.a ? own : loose
      const cl = l.a ? heat(z, l) : null
      const fill = cl === 'cold' ? `url(#h${uid})` : cl ? GREEN : 'transparent'
      const base = cl === 'hot' ? (zm ? 0.6 : 0.34) : cl === 'warm' ? (zm ? 0.28 : 0.16) : cl === 'cold' ? (zm ? 1 : 0.6) : 0
      return <g key={z} clipPath={clip}>
        <rect x={x} y={y} width={w} height={h} fill={fill} opacity={own.a ? base : base * 0.5} onClick={onZone ? () => onZone(z) : undefined} style={onZone ? { cursor: 'pointer' } : undefined}><title>{ZONE_NAME[z]}{own.a ? `: ${own.m} of ${own.a}` : ''}</title></rect>
        {selected === z && <rect x={x} y={y} width={w} height={h} fill={INK} opacity=".12" pointerEvents="none" />}
      </g>
    })}
    <g fill="none" stroke={LINE} strokeWidth="2" pointerEvents="none">
      <rect x="1" y="1" width="298" height="268" /><rect x="102" y="156" width="96" height="114" /><path d="M114 156A36 36 0 0 1 186 156" /><path d="M114 156A36 36 0 0 0 186 156" strokeDasharray="4 4" /><path d="M126 238A24 24 0 0 1 174 238" /><path d="M30 270L30 161.2A142.5 142.5 0 0 1 270 161.2L270 270" /><path d="M135 246H165" stroke={INK} />
    </g>
    <circle cx="150" cy="238" r="7" fill="none" stroke={GREEN} strokeWidth="2.5" pointerEvents="none" />
    {zm && !small && ZONES.filter((z) => stats.zones[z].a).map((z) => { const l = stats.zones[z], [x, y] = LABEL[z]; return <text key={z} x={x} y={y} textAnchor="middle"><tspan className="zp" x={x}>{pct(l)}%</tspan><tspan className="zc" x={x} dy="11">{l.m}/{l.a}</tspan></text> })}
    <g pointerEvents="none" opacity={zm ? 0.3 : 1}>
      {dots.map((d) => { const r = small ? 3.2 : 4.8; const q = r * 0.85
        return d.made ? <circle key={d.k} cx={d.x} cy={d.y} r={r} fill={GREEN} stroke="#fff" strokeWidth="1.5" /> : <path key={d.k} d={`M${d.x - q} ${d.y - q}L${d.x + q} ${d.y + q}M${d.x + q} ${d.y - q}L${d.x - q} ${d.y + q}`} stroke={INK} strokeWidth={small ? 1.6 : 2} strokeLinecap="round" /> })}
    </g>
  </svg>
}

export function CourtLegend() {
  return <div className="legend">
    <span className="row" style={{ gap: 6 }}><svg width="14" height="14"><circle cx="7" cy="7" r="5.5" fill={GREEN} /></svg>Make</span>
    <span className="row" style={{ gap: 6 }}><svg width="14" height="14"><path d="M2 2L12 12M12 2L2 12" stroke={INK} strokeWidth="2" /></svg>Miss</span>
    <span className="row" style={{ gap: 6 }}><svg width="14" height="14"><rect x=".5" y=".5" width="13" height="13" fill={GREEN} opacity=".6" /></svg>Hot</span>
    <span className="row" style={{ gap: 6 }}><svg width="14" height="14"><defs><pattern id="lg" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#EEF2F0" /><line x1="0" y1="0" x2="0" y2="5" stroke="#9FB0A7" strokeWidth="2" /></pattern></defs><rect x=".5" y=".5" width="13" height="13" fill="url(#lg)" /></svg>Cold</span>
  </div>
}

export const looseCount = (s: Stats) => s.loose['3'].a + s.loose['2'].a + s.loose.r.a
export { group }
