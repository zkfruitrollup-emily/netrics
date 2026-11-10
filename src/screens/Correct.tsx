import { useEffect, useState } from 'react'
import { saveSession } from '../lib/db'
import { overall, points } from '../lib/stats'
import { Line, Stats, ZONE_NAME, ZoneKey } from '../lib/types'
import { Court } from '../ui/Court'
import { Header, Icon, nav, Stepper, useApp, useSession } from '../ui/kit'
import { Missing } from './Record'

function LineEdit({ title, sub, line, onChange }: { title: string; sub?: string; line: Line; onChange: (l: Line) => void }) {
  return <div className="statrow">
    <b>{title}</b>{sub && <div className="xs mu">{sub}</div>}
    <div className="pair">
      <div><span className="lbl">Makes</span><Stepper label={`${title} makes`} value={line.m} onChange={(m) => onChange({ m, a: Math.max(line.a, m) })} /></div>
      <div><span className="lbl">Attempts</span><Stepper label={`${title} attempts`} value={line.a} onChange={(a) => onChange({ a, m: Math.min(line.m, a) })} /></div>
    </div>
  </div>
}

export function Correct({ id }: { id: string }) {
  const { toast } = useApp()
  const [s] = useSession(id)
  const [st, setSt] = useState<Stats | null>(null)
  const [zone, setZone] = useState<ZoneKey | null>(null)
  useEffect(() => { if (s) setSt(s.stats) }, [s])
  if (s === null) return <Missing />
  if (!s || !st) return null
  const o = overall(st)
  const box = ([['reb', 'Rebounds'], ['ast', 'Assists'], ['stl', 'Steals'], ['blk', 'Blocks'], ['tov', 'Turnovers']] as const)
  const confirm = async () => {
    await saveSession({ ...s, stats: st, flags: [], status: 'confirmed' })
    toast('Session confirmed. Stats updated.')
    nav(s.sample ? `recap/${s.id}` : 'profile/just', true)
  }
  return <div className="view">
    <Header title="Confirm" phase={2} onBack={() => history.back()} />
    <div className="pg">
      <div className="h1">Correct and confirm</div>
      <p className="lead">Fix anything we misheard. Nothing reaches your profile until you confirm.</p>
      {s.flags.map((f, i) => <div key={i} className="note warn gap14"><Icon n="flag" /><div>{f.text}</div></div>)}
      <div className="card gap14">
        <div className="rowb"><div className="h2">Your total</div><b className="gr">{points(st)} pts · {o.m}/{o.a}</b></div>
        <LineEdit title="At the rim" sub="No side named" line={st.loose.r} onChange={(l) => setSt({ ...st, loose: { ...st.loose, r: l } })} />
        <LineEdit title="Mid-range" sub="No side named" line={st.loose['2']} onChange={(l) => setSt({ ...st, loose: { ...st.loose, '2': l } })} />
        <LineEdit title="Three-point" sub="No spot named" line={st.loose['3']} onChange={(l) => setSt({ ...st, loose: { ...st.loose, '3': l } })} />
        {st.loose.x.a > 0 && <LineEdit title="Anywhere" sub="Counted as two-pointers" line={st.loose.x} onChange={(l) => setSt({ ...st, loose: { ...st.loose, x: l } })} />}
        <LineEdit title="Free throws" line={st.ft} onChange={(l) => setSt({ ...st, ft: l })} />
      </div>
      <div className="card">
        <div className="h2">Place on the chart</div>
        <p className="xs mu gap8">Tap a zone to set makes and attempts for that spot.</p>
        <div className="gap14"><Court uid="c" stats={st} mode="zones" selected={zone} onZone={(z) => setZone(zone === z ? null : z)} /></div>
        {zone && <LineEdit title={ZONE_NAME[zone]} line={st.zones[zone]} onChange={(l) => setSt({ ...st, zones: { ...st.zones, [zone]: l } })} />}
      </div>
      <div className="card" style={{ padding: '6px 16px' }}>
        {box.map(([k, l]) => <div key={k} className="rowb statrow"><b>{l}</b><Stepper label={l} value={st[k]} onChange={(n) => setSt({ ...st, [k]: n })} /></div>)}
      </div>
      {s.mode === 'multi' && <div className="card">
        <div className="h2">Final score</div>
        <div className="pair">
          <div><span className="lbl">Your team</span><Stepper label="Your team score" value={st.score?.us ?? 0} onChange={(us) => setSt({ ...st, score: { us, them: st.score?.them ?? 0 } })} /></div>
          <div><span className="lbl">Them</span><Stepper label="Their score" value={st.score?.them ?? 0} onChange={(them) => setSt({ ...st, score: { us: st.score?.us ?? 0, them } })} /></div>
        </div>
      </div>}
    </div>
    <div className="cta"><button className="btn pri" onClick={confirm}>Confirm</button></div>
  </div>
}
