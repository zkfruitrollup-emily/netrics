import { useState } from 'react'
import { deleteSession, newSession, saveSession } from '../lib/db'
import { sampleSession } from '../lib/sample'
import { overall, pct, points } from '../lib/stats'
import { Session } from '../lib/types'
import { dateStr, Header, Icon, initial, nav, useApp, useSessions } from '../ui/kit'

const CHOICES = [
  { k: 'pos', l: 'Position', o: ['Guard', 'Wing', 'Big', 'Whatever is open'] },
  { k: 'lvl', l: 'Skill level', o: ['Just starting out', 'Casual', 'Solid', 'Competitive'] },
  { k: 'freq', l: 'How often you play', o: ['Monthly', 'Weekly', '3+ a week'] },
  { k: 'want', l: 'What you want most', o: ['See my game', 'Get better', 'Play more'] },
] as const

export function Onboarding() {
  const { profile, update } = useApp()
  const [name, setName] = useState(profile.name)
  return <div className="view">
    <div className="pg" style={{ paddingTop: 'calc(34px + env(safe-area-inset-top))' }}>
      <div className="wordmark">Netrics</div>
      <p className="lead">Turn any court into your smart court. One screen, then you are playing.</p>
      <div className="lbl gap20">Your name</div>
      <input className="tx gap8" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" aria-label="Your name" />
      {CHOICES.map((c) => <div key={c.k}>
        <div className="lbl gap20">{c.l}</div>
        <div className="chips gap8">{c.o.map((v) => <button key={v} className={'chip' + (profile[c.k] === v ? ' on' : '')} aria-pressed={profile[c.k] === v} onClick={() => update({ [c.k]: v })}>{v}</button>)}</div>
      </div>)}
    </div>
    <div className="cta"><button className="btn pri" onClick={() => update({ name: name.trim(), onboarded: true })}>Get on the court</button></div>
  </div>
}

function SessionRow({ s }: { s: Session }) {
  const o = overall(s.stats)
  return <button className="mrow" onClick={() => nav(`recap/${s.id}`)}>
    <span className="big gr" style={{ fontSize: 42, width: 58 }}>{points(s.stats)}</span>
    <span className="grow"><b style={{ display: 'block' }}>{s.court || 'Pickup run'}{s.sample && <span className="tag" style={{ marginLeft: 8 }}>Sample</span>}</b><span className="xs mu">{dateStr(s.createdAt)} · {o.m}/{o.a} · {pct(o)}% FG</span></span>
    <span className="mu"><Icon n="chev" /></span>
  </button>
}

export function Home() {
  const { profile } = useApp()
  const [list, reload] = useSessions()
  if (!list) return null
  const open = list.filter((s) => s.status === 'logging' || s.status === 'draft' || s.status === 'recording')
  const done = list.filter((s) => s.status === 'confirmed')
  const resume = (s: Session) => nav(s.status === 'draft' ? `recap/${s.id}` : `memo/${s.id}`)
  return <div className="view hasnav">
    <div className="pg" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top))' }}>
      <div className="wordmark">Netrics</div>
      <div className="h1 gap14">{profile.name ? `Ready, ${profile.name}?` : 'Ready to hoop?'}</div>
      <p className="lead">Film your run, say your stats out loud, and get a recap that builds your player profile.</p>
      <button className="btn pri gap20" onClick={() => nav('new')}><Icon n="cam" /> Start a session</button>
      {open.map((s) => <div key={s.id} className="note warn gap14">
        <Icon n="flag" />
        <div className="grow"><b>{s.status === 'draft' ? 'Confirm your stats' : 'Finish logging'}</b>{s.court || 'Pickup run'}, {dateStr(s.createdAt)}
          <div className="row gap8"><button className="btn sm gh" onClick={() => resume(s)}>Continue</button><button className="btn sm" style={{ color: 'var(--mu)' }} onClick={async () => { await deleteSession(s.id); void reload() }}>Discard</button></div>
        </div>
      </div>)}
      {done.length > 0
        ? <><div className="rowb gap20"><div className="h2">Latest runs</div><button className="xs mu" style={{ textDecoration: 'underline' }} onClick={() => nav('sessions')}>See all</button></div><div className="gap8">{done.slice(0, 3).map((s) => <SessionRow key={s.id} s={s} />)}</div></>
        : <div className="card gap20">
          <div className="h2">How it works</div>
          <ol className="steps">
            <li><i>1</i><span>Prop your phone so the hoop is in frame and hit record.</span></li>
            <li><i>2</i><span>Tap Highlight whenever something good happens.</span></li>
            <li><i>3</i><span>After the run, record a voice memo: "Four for ten from three, six boards."</span></li>
            <li><i>4</i><span>Check the numbers. Your recap and shot chart build themselves.</span></li>
          </ol>
          <button className="btn gh gap14" onClick={async () => { const s = sampleSession(); await saveSession(s); nav(`recap/${s.id}`) }}>See a sample recap</button>
        </div>}
    </div>
  </div>
}

export function Sessions() {
  const [list] = useSessions()
  if (!list) return null
  const done = list.filter((s) => s.status === 'confirmed')
  return <div className="view hasnav">
    <Header title="Recaps" />
    <div className="pg">
      {done.length ? done.map((s) => <SessionRow key={s.id} s={s} />) : <>
        <div className="h1">No recaps yet</div><p className="lead">Finish a session and it shows up here.</p>
        <button className="btn pri gap20" onClick={() => nav('new')}>Start a session</button></>}
    </div>
  </div>
}

export function NewSession() {
  const { profile, update } = useApp()
  const [mode, setMode] = useState<'solo' | 'multi'>('solo')
  const [team, setTeam] = useState<string[]>([])
  const [friend, setFriend] = useState('')
  const [court, setCourt] = useState(profile.courts[0] ?? '')

  const addFriend = () => {
    const n = friend.trim()
    if (!n) return
    if (!profile.friends.includes(n)) update({ friends: [...profile.friends, n] })
    if (!team.includes(n)) setTeam([...team, n])
    setFriend('')
  }
  const begin = async (camera: boolean) => {
    const c = court.trim()
    if (c && !profile.courts.includes(c)) update({ courts: [c, ...profile.courts].slice(0, 8) })
    const s = newSession({ court: c, mode, players: mode === 'multi' ? team : [], status: camera ? 'recording' : 'logging' })
    await saveSession(s)
    nav(camera ? `record/${s.id}` : `memo/${s.id}`, true)
  }
  return <div className="view">
    <Header title="Players" phase={0} onBack={() => history.back()} />
    <div className="pg">
      <div className="h1">Who is playing?</div>
      <p className="lead">Your memo covers your own stats. Multi-player adds rebounds, assists and the score to your recap.</p>
      {([['solo', 'Solo', 'Just me, working on my shot'], ['multi', 'Multi-player', 'Pickup with others on court']] as const).map(([k, t, d]) =>
        <button key={k} className={'opt' + (mode === k ? ' on' : '')} aria-pressed={mode === k} onClick={() => setMode(k)}>
          <span className="grow"><span className="t">{t}</span><span className="s">{d}</span></span><span className="radio">{mode === k && <Icon n="check" s={16} w={3} />}</span>
        </button>)}
      {mode === 'multi' && <>
        <div className="lbl gap20">On court with you</div>
        <div className="chips gap8">{profile.friends.map((f) => { const on = team.includes(f); return <button key={f} className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setTeam(on ? team.filter((x) => x !== f) : [...team, f])}><span className={'av' + (on ? ' on' : '')} style={{ width: 26, height: 26, fontSize: 15 }}>{initial(f)}</span>{f}</button> })}</div>
        <div className="row gap8"><input className="tx" value={friend} maxLength={20} onChange={(e) => setFriend(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFriend()} placeholder="Add a friend" aria-label="Friend's name" /><button className="btn gh sm" style={{ height: 56 }} onClick={addFriend}>Add</button></div>
      </>}
      <div className="lbl gap20">Court</div>
      <input className="tx gap8" value={court} maxLength={40} onChange={(e) => setCourt(e.target.value)} placeholder="Where are you playing?" aria-label="Court name" />
      {profile.courts.length > 0 && <div className="chips gap8">{profile.courts.map((c) => <button key={c} className={'chip' + (court === c ? ' on' : '')} onClick={() => setCourt(c)}>{c}</button>)}</div>}
    </div>
    <div className="cta">
      <button className="btn pri" onClick={() => begin(true)}>Set up the camera</button>
      <button className="lnk" onClick={() => begin(false)}>Skip the camera, just log my stats</button>
    </div>
  </div>
}
