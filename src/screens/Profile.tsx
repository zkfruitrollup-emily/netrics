import { useEffect, useState } from 'react'
import { wipeAll } from '../lib/db'
import { storageInfo } from '../lib/media'
import { bests, group, overall, pct, points } from '../lib/stats'
import { Session } from '../lib/types'
import { dateStr, Header, Icon, initial, nav, Sheet, useApp, useSessions } from '../ui/kit'

type Metric = 'fg' | '3p' | 'vol'
const value = (s: Session, k: Metric) => (k === 'fg' ? pct(overall(s.stats)) : k === '3p' ? pct(group(s.stats, '3')) : overall(s.stats).a)

function Trend({ list, k }: { list: Session[]; k: Metric }) {
  const [hover, setHover] = useState<number | null>(null)
  const data = list.slice(0, 8).reverse()
  const unit = k === 'vol' ? '' : '%'
  const vals = data.map((s) => value(s, k))
  const max = Math.max(...vals, 1) * 1.15
  const n = data.length, step = 330 / 8, bw = 24
  const active = hover ?? n - 1
  return <>
    <svg viewBox="0 0 330 150" width="100%" role="img" aria-label={`Trend across your last ${n} sessions: ${vals.join(', ')}`}>
      <line x1="0" y1="128" x2="330" y2="128" stroke="#DFE8E3" />
      {data.map((s, i) => {
        const h = Math.max(3, (vals[i] / max) * 108), x = i * step + (step - bw) / 2, on = i === active
        return <g key={s.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)} style={{ cursor: 'pointer' }}>
          <rect x={i * step} y="0" width={step} height="150" fill="transparent" />
          <path d={`M${x} 128V${128 - h + 4}a4 4 0 0 1 4-4h${bw - 8}a4 4 0 0 1 4 4V128Z`} fill={on ? '#0A7F48' : '#BFE3CE'} />
          {on && <text x={x + bw / 2} y={120 - h} textAnchor="middle" fill="#0F2019" fontSize="13" fontWeight="700" fontFamily="var(--sans)">{vals[i]}{unit}</text>}
          <text x={x + bw / 2} y="145" textAnchor="middle" fill="#566860" fontSize="9" fontFamily="var(--sans)">{new Date(s.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</text>
        </g>
      })}
    </svg>
    <div className="xs mu gap8">{dateStr(data[active].createdAt)}, {data[active].court || 'Pickup run'}: <b style={{ color: 'var(--tx)' }}>{vals[active]}{unit}</b></div>
  </>
}

export function Profile({ just }: { just: boolean }) {
  const { profile, update, toast } = useApp()
  const [list] = useSessions()
  const [metric, setMetric] = useState<Metric>('fg')
  const [editing, setEditing] = useState(false)
  const [wipe, setWipe] = useState(false)
  const [store, setStore] = useState<{ used: number; quota: number } | null>(null)
  useEffect(() => { void storageInfo().then(setStore) }, [])
  if (!list) return null
  const real = list.filter((s) => s.status === 'confirmed' && !s.sample)
  const shots = real.reduce((t, s) => t + overall(s.stats).a, 0)
  const courts = new Set(real.map((s) => s.court).filter(Boolean)).size
  const b = bests(real)
  const latest = real[0]
  const clips = real.flatMap((s) => s.highlights.map((h) => ({ s, h }))).slice(0, 6)
  const exportData = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ profile, sessions: real }, null, 2)], { type: 'application/json' }))
    a.download = 'netrics-stats.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  return <div className="view hasnav">
    <Header title="Profile" />
    <div className="pg">
      {just && latest && <div className="note ok"><Icon n="check" /><div><b>Session confirmed</b>{overall(latest.stats).m} makes on {overall(latest.stats).a} attempts added to your profile.</div></div>}
      <div className="row" style={{ gap: 14 }}>
        <span className="av on" style={{ width: 68, height: 68, fontSize: 38 }}>{initial(profile.name)}</span>
        <div className="grow">
          {editing ? <input className="tx" autoFocus maxLength={24} defaultValue={profile.name} aria-label="Your name" onBlur={(e) => { update({ name: e.target.value.trim() }); setEditing(false) }} />
            : <button className="h1" style={{ fontSize: 42 }} onClick={() => setEditing(true)}>{profile.name || 'Add your name'}</button>}
          <div className="chips gap8">{[profile.pos, profile.lvl, profile.freq].map((t) => <span key={t} className="tag">{t}</span>)}</div>
        </div>
      </div>
      <div className="stat3 gap20">{([['Sessions', real.length], ['Courts', courts], ['Shots', shots]] as const).map(([l, v]) => <div key={l}><div className="big" style={{ fontSize: 42 }}>{v}</div><div className="lbl gap8">{l}</div></div>)}</div>

      {real.length === 0 ? <div className="card gap14"><div className="h2">Your numbers land here</div><p className="sm mu gap8">Confirm your first session to start your trends and personal bests.</p><button className="btn pri gap14" onClick={() => nav('new')}>Start a session</button></div> : <>
        <div className="card gap14">
          <div className="h2">Trends</div>
          <div className="seg gap14">{([['fg', 'FG%'], ['3p', '3PT%'], ['vol', 'Shots']] as const).map(([k, t]) => <button key={k} className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{t}</button>)}</div>
          <div className="gap14"><Trend list={real} k={metric} /></div>
        </div>
        <div className="h2">Personal bests</div>
        <div className="grid2 gap14">{([['Best FG%', b.fg ? b.fg + '%' : '—'], ['Most makes', b.makes], ['Best 3PT%', b.three ? b.three + '%' : '—'], ['Most points', b.points]] as const).map(([l, v]) => <div key={l}><div className="big" style={{ fontSize: 44 }}>{v}</div><div className="lbl gap8">{l}</div></div>)}</div>
        {clips.length > 0 && <><div className="h2 gap20">Highlights</div><div className="gap8">{clips.map(({ s, h }) => <button key={h.id} className="mrow" onClick={() => nav(`recap/${s.id}`)}><span className="gr"><Icon n="star" /></span><span className="grow"><b style={{ display: 'block' }}>{h.label}</b><span className="xs mu">{s.court || 'Pickup run'}, {dateStr(s.createdAt)}</span></span><span className="mu"><Icon n="chev" /></span></button>)}</div></>}
        <div className="h2 gap20">History</div>
        <div className="gap8">{real.map((s) => <button key={s.id} className="mrow" onClick={() => nav(`recap/${s.id}`)}><span className="big gr" style={{ fontSize: 38, width: 52 }}>{points(s.stats)}</span><span className="grow"><b style={{ display: 'block' }}>{s.court || 'Pickup run'}</b><span className="xs mu">{dateStr(s.createdAt)} · {overall(s.stats).m}/{overall(s.stats).a}</span></span><span className="mu"><Icon n="chev" /></span></button>)}</div>
      </>}

      <div className="card gap20">
        <div className="h2">Your data</div>
        <p className="sm mu gap8">Everything lives on this device. There is no account and nothing is uploaded.</p>
        {store && store.quota > 0 && <div className="xs mu gap8">Using {(store.used / 1e6).toFixed(0)} MB of {(store.quota / 1e9).toFixed(1)} GB available.</div>}
        <button className="btn gh gap14" onClick={exportData}><Icon n="down" s={18} /> Export my stats</button>
        <button className="lnk" onClick={() => setWipe(true)}>Erase everything</button>
      </div>
      <div className="card"><div className="rowb"><div className="h2">Coming soon</div></div><div className="gap8">{['Automatic shot tracking', 'Smartwatch and heart rate', 'Find a run with friends'].map((x) => <div key={x} className="soon"><Icon n="lock" s={16} /><span>{x}</span></div>)}</div></div>
    </div>
    {wipe && <Sheet onClose={() => setWipe(false)}>
      <div className="h2" style={{ fontSize: 34 }}>Erase everything?</div>
      <p className="lead">All sessions, videos and memos on this device are removed. This cannot be undone.</p>
      <button className="btn pri gap20" onClick={async () => { await wipeAll(); toast('Erased'); location.hash = ''; location.reload() }}>Erase everything</button>
      <button className="btn gh gap8" onClick={() => setWipe(false)}>Keep my data</button>
    </Sheet>}
  </div>
}
