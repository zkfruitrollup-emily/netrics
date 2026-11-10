import { useEffect, useRef, useState } from 'react'
import { renderCard, shareOrSave } from '../lib/card'
import { deleteSession, getMemo, getVideo, listSessions } from '../lib/db'
import { fmt, group, heat, insight, Insight, overall, pct, points } from '../lib/stats'
import { Group, ZONE_NAME, ZoneKey } from '../lib/types'
import { Court, CourtLegend, looseCount } from '../ui/Court'
import { dateStr, Header, Icon, nav, Sheet, timeStr, useApp, useSession } from '../ui/kit'
import { Missing } from './Record'

export function useObjectUrl(load: () => Promise<Blob | null | undefined>, dep: unknown) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let u = '', on = true
    void load().then((b) => { if (b && on) { u = URL.createObjectURL(b); setUrl(u) } })
    return () => { on = false; if (u) URL.revokeObjectURL(u) }
  }, [dep])
  return url
}

export function Recap({ id }: { id: string }) {
  const { toast } = useApp()
  const [s] = useSession(id)
  const [cmode, setCmode] = useState<'both' | 'zones'>('both')
  const [zsel, setZsel] = useState<ZoneKey | null>(null)
  const [share, setShare] = useState(false)
  const [ask, setAsk] = useState(false)
  const [card, setCard] = useState<Blob | null>(null)
  const [ins, setIns] = useState<Insight | null>(null)
  const player = useRef<HTMLVideoElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const videoUrl = useObjectUrl(async () => (s ? getVideo(s) : null), s?.id)
  const memoUrl = useObjectUrl(async () => (s?.memoMime ? getMemo(s.id) : null), s?.id)

  useEffect(() => { if (s) void listSessions().then((l) => setIns(insight(s, l))) }, [s])
  // Drawn before the tap: Safari only allows sharing directly inside the tap itself.
  useEffect(() => {
    if (!share || !s) { setCard(null); return }
    let on = true
    void renderCard(s, cardRef.current?.querySelector('svg.court') ?? null).then((b) => on && setCard(b))
    return () => { on = false }
  }, [share, s])

  if (s === undefined) return null
  if (s === null) return <Missing />
  const st = s.stats, o = overall(st), draft = s.status === 'draft', multi = s.mode === 'multi' || st.reb + st.ast > 0
  const seek = (t: number) => { const v = player.current; if (!v) return; v.currentTime = Math.max(0, t - 6); void v.play().catch(() => undefined); v.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  const tiles: [string, { m: number; a: number }][] = [['Overall FG', o], ['Mid-range', group(st, '2')], ['Three-point', group(st, '3')], ['At rim', group(st, 'r')]]
  const zl = zsel ? st.zones[zsel] : null

  return <div className="view hasnav">
    <Header title="Recap" onBack={() => nav('sessions')} />
    <div className="pg">
      <div className="rowb">
        <div className="grow"><div className="lbl">Session recap{s.sample && ' · Sample'}</div><div className="h1" style={{ fontSize: 42, marginTop: 4 }}>{s.court || 'Pickup run'}</div>
          <div className="mu sm gap8">{dateStr(s.createdAt)} · {timeStr(s.createdAt)}{s.durationSec ? ` · ${Math.max(1, Math.round(s.durationSec / 60))} min` : ''} · {s.mode === 'multi' ? 'Pickup' : 'Solo'}</div></div>
        <button className="ib" onClick={() => setShare(true)} aria-label="Share session"><Icon n="share" /></button>
      </div>
      {draft && <div className="note warn gap14"><Icon n="flag" /><div><b>Not saved to your profile yet</b>Check the numbers and confirm them below.</div></div>}
      {s.players.length > 0 && <div className="xs mu gap8">With {s.players.join(', ')}</div>}
      {st.score && <div className="tag gr gap8">{st.score.us > st.score.them ? 'Won' : st.score.us < st.score.them ? 'Lost' : 'Tied'} {st.score.us}–{st.score.them}</div>}
      <div className="hero">
        <div><div className="big gr" style={{ fontSize: 96 }}>{points(st)}</div><div className="lbl gap8">Points</div></div>
        <div><div className="big" style={{ fontSize: 96 }}>{multi ? st.reb : '—'}</div><div className="lbl gap8">Rebounds</div></div>
        <div><div className="big" style={{ fontSize: 96 }}>{multi ? st.ast : '—'}</div><div className="lbl gap8">Assists</div></div>
      </div>
      <div className="grid2 gap14">{tiles.map(([label, l]) => <div key={label}><div className="big" style={{ fontSize: 42 }}>{l.a ? pct(l) + '%' : '—'}</div><div className="lbl gap8">{label}</div><div className="xs mu gap8">{l.m} / {l.a} made</div></div>)}</div>
      {st.stl + st.blk + st.tov + st.ft.a > 0 && <div className="stat3 gap14">{([['FT', st.ft.a ? `${st.ft.m}/${st.ft.a}` : '—'], ['Steals', st.stl], ['Blocks', st.blk], ['TO', st.tov]] as const).map(([k, v]) => <div key={k} style={{ padding: 10 }}><div className="big" style={{ fontSize: 32 }}>{v}</div><div className="lbl gap8">{k}</div></div>)}</div>}

      <div className="card gap14">
        <div className="rowb"><div className="h2">Shot chart</div><div className="seg" style={{ width: 150 }}><button className={cmode === 'both' ? 'on' : ''} onClick={() => setCmode('both')}>Shots</button><button className={cmode === 'zones' ? 'on' : ''} onClick={() => setCmode('zones')}>Zones</button></div></div>
        <div className="gap14"><Court uid="r" stats={st} mode={cmode} selected={zsel} onZone={(z) => setZsel(zsel === z ? null : z)} /></div>
        <div className="xs gap8" style={{ minHeight: 34, lineHeight: 1.5 }}>
          {zsel && zl ? <><b>{ZONE_NAME[zsel]}</b>: {zl.a ? `${zl.m} of ${zl.a} (${pct(zl)}%). ${{ hot: 'Hot zone.', warm: 'Steady.', cold: 'Cold zone.' }[heat(zsel, zl)]}` : 'No shots logged here.'}</> : <span className="mu">Tap a zone for details. Marks are placed inside the zone you named, not at exact spots.</span>}
        </div>
        <div className="gap8"><CourtLegend /></div>
        {looseCount(st) > 0 && <div className="xs mu gap14">{looseCount(st)} shots had a range but no spot, so that range is lightly shaded. Say "left corner" or "right wing" to place them.</div>}
      </div>

      {ins && <div className="card" style={{ borderColor: '#8CC9A8' }}><div className="row" style={{ alignItems: 'flex-start' }}><span className="gr" style={{ marginTop: 2 }}><Icon n="bolt" s={24} /></span><div><div className="lbl gr">{ins.kicker}</div><div className="h2 gap8" style={{ fontSize: 32 }}>{ins.headline}</div><div className="sm mu gap8">{ins.body}</div></div></div></div>}

      {videoUrl && <>
        <div className="rowb gap20"><div className="h2">Your footage</div><span className="xs mu">{s.highlights.length} highlight{s.highlights.length === 1 ? '' : 's'}</span></div>
        <video ref={player} className="player gap14" src={videoUrl} controls playsInline preload="metadata" aria-label="Session video" />
        {s.highlights.length > 0 && <div className="chips gap14">{s.highlights.map((h) => <button key={h.id} className="chip" onClick={() => seek(h.t)}><Icon n="play" s={14} /> {h.label} · {fmt(h.t)}</button>)}</div>}
      </>}

      {s.flags.length > 0 && draft && <>
        <div className="rowb gap20"><div className="h2">Check these</div><span className="tag">{s.flags.length} flagged</span></div>
        <div className="gap14">{s.flags.map((f, i) => <button key={i} className="flag" onClick={() => nav(`correct/${s.id}`)}><Icon n="flag" /><span className="grow">{f.text}</span><span className="mu"><Icon n="chev" /></span></button>)}</div>
      </>}

      <div className="card gap14">
        <div className="rowb"><div className="h2">Scoring breakdown</div><span className="tag">Your points</span></div>
        <div className="stat3 gap14">{([['Mid-range', '2', 2], ['Three-point', '3', 3], ['At rim', 'r', 2]] as [string, Group, number][]).map(([l, g, v]) => <div key={g}><div className={'big' + (g === '3' ? ' gr' : '')} style={{ fontSize: 42 }}>{group(st, g).m * v}</div><div className="lbl gap8">{l}</div></div>)}</div>
        <div className="xs mu gap8">{points(st)} points from {o.m} makes on {o.a} attempts{st.ft.m ? `, plus ${st.ft.m} free throws` : ''}.</div>
      </div>

      {(s.transcript || memoUrl) && <div className="card"><div className="h2">Your memo</div>{memoUrl && <audio className="gap14" src={memoUrl} controls style={{ width: '100%' }} />}{s.transcript && <p className="sm mu gap8" style={{ lineHeight: 1.5 }}>{s.transcript}</p>}</div>}

      <div className="card"><div className="rowb"><div className="h2">Advanced stats</div><span className="tag">Coming soon</span></div><div className="gap8">{['Automatic shot tracking', 'Release time', 'Jump height', 'Shot speed and arc'].map((x) => <div key={x} className="soon"><Icon n="lock" s={16} /><span>{x}</span></div>)}</div></div>
      {!draft && !s.sample && <button className="btn gh" onClick={() => nav(`correct/${s.id}`)}>Edit stats</button>}
      <button className="lnk" onClick={() => setAsk(true)}>Delete this session</button>
    </div>
    {draft && <div className="cta"><button className="btn pri" onClick={() => nav(`correct/${s.id}`)}>{s.flags.length ? `Check ${s.flags.length} flagged item${s.flags.length > 1 ? 's' : ''}` : 'Review and confirm'}</button></div>}

    {share && <Sheet onClose={() => setShare(false)}>
      <div className="h2" style={{ fontSize: 34 }}>Session card</div>
      <div className="sharecard gap14" ref={cardRef}>
        <div className="rowb"><span className="wordmark" style={{ fontSize: 28 }}>Netrics</span><span className="xs mu">{dateStr(s.createdAt)}</span></div>
        <div className="row gap14" style={{ alignItems: 'flex-end' }}><div><div className="big gr" style={{ fontSize: 88 }}>{points(st)}</div><div className="lbl gap8">Points</div></div><div><div className="big" style={{ fontSize: 56 }}>{o.m}/{o.a}</div><div className="lbl gap8">Makes</div></div><div style={{ marginLeft: 'auto', width: 112 }}><Court uid="s" stats={st} small /></div></div>
        <div className="rowb gap14"><b>{pct(o)}% FG · 3PT {group(st, '3').a ? pct(group(st, '3')) + '%' : '—'}</b><span className="xs mu">{s.court}</span></div>
      </div>
      <button className="btn pri gap14" disabled={!card} onClick={async () => { if (!card) return; const r = await shareOrSave(card, 'netrics-session.png'); if (r === 'saved') toast('Card saved'); setShare(false) }}><Icon n="share" s={18} /> {card ? 'Share card' : 'Drawing card…'}</button>
      {videoUrl && <a className="btn gh gap8" href={videoUrl} download={`netrics-${s.id}.${s.videoMime?.includes('mp4') ? 'mp4' : 'webm'}`} style={{ textDecoration: 'none' }}><Icon n="down" s={18} /> Save the video</a>}
      <button className="btn gh gap8" onClick={() => setShare(false)}>Close</button>
    </Sheet>}
    {ask && <Sheet onClose={() => setAsk(false)}>
      <div className="h2" style={{ fontSize: 34 }}>Delete this session?</div>
      <p className="lead">Its stats, video and memo are removed from this phone. This cannot be undone.</p>
      <button className="btn pri gap20" onClick={async () => { await deleteSession(s.id); toast('Session deleted'); nav('', true) }}>Delete session</button>
      <button className="btn gh gap8" onClick={() => setAsk(false)}>Keep it</button>
    </Sheet>}
  </div>
}
