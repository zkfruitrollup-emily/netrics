import { useEffect, useRef, useState } from 'react'
import { putChunk, saveSession, uid } from '../lib/db'
import { canRecord, videoMime } from '../lib/media'
import { fmt } from '../lib/stats'
import { Highlight } from '../lib/types'
import { Header, Icon, nav, useApp, useSession } from '../ui/kit'

type Phase = 'asking' | 'denied' | 'unsupported' | 'ready' | 'recording' | 'saving'

function HoopGuide() {
  return <svg className="guide" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="8 6" strokeLinecap="round">
      <rect x="140" y="26" width="120" height="78" rx="6" />
      <ellipse cx="200" cy="100" rx="34" ry="9" />
      <polygon points="130,286 270,286 240,178 160,178" />
      <path d="M36 286C60 120 340 120 364 286" />
    </g>
    <rect x="133" y="6" width="134" height="20" rx="10" fill="rgba(7,64,42,.82)" />
    <text x="200" y="20" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="var(--sans)">LINE UP THE HOOP HERE</text>
  </svg>
}

export function Record({ id }: { id: string }) {
  const { toast } = useApp()
  const [s] = useSession(id)
  const [phase, setPhase] = useState<Phase>('asking')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [secs, setSecs] = useState(0)
  const [marks, setMarks] = useState<Highlight[]>([])
  const [storageFull, setStorageFull] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const startedAt = useRef(0)
  const writes = useRef<Promise<void>>(Promise.resolve())
  const wake = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => {
    if (!canRecord()) { setPhase('unsupported'); return }
    let live = true
    setPhase('asking')
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((st) => {
        if (!live) { st.getTracks().forEach((t) => t.stop()); return }
        stream.current?.getTracks().forEach((t) => t.stop())
        stream.current = st
        if (video.current) { video.current.srcObject = st; void video.current.play().catch(() => undefined) }
        setPhase('ready')
      })
      .catch(() => live && setPhase('denied'))
    return () => { live = false }
  }, [facing])

  useEffect(() => () => {
    if (rec.current?.state === 'recording') rec.current.stop()
    stream.current?.getTracks().forEach((t) => t.stop())
    void wake.current?.release().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (phase !== 'recording') return
    const tick = setInterval(() => setSecs((Date.now() - startedAt.current) / 1000), 500)
    const guard = (e: BeforeUnloadEvent) => e.preventDefault()
    const relock = () => { if (document.visibilityState === 'visible') void lock() }
    window.addEventListener('beforeunload', guard)
    document.addEventListener('visibilitychange', relock)
    return () => { clearInterval(tick); window.removeEventListener('beforeunload', guard); document.removeEventListener('visibilitychange', relock) }
  }, [phase])

  async function lock() {
    try { wake.current = await (navigator as any).wakeLock?.request('screen') } catch { /* screen may sleep; recording continues while visible */ }
  }

  async function start() {
    if (!stream.current || !s) return
    void navigator.storage?.persist?.()
    const mimeType = videoMime()
    const r = new MediaRecorder(stream.current, { mimeType, videoBitsPerSecond: 1_500_000 })
    let seq = 0
    r.ondataavailable = (e) => {
      if (!e.data.size) return
      const n = seq++
      writes.current = writes.current.then(() => putChunk(id, n, e.data)).catch(() => {
        setStorageFull(true)
        if (r.state === 'recording') r.stop()
      })
    }
    r.onstop = () => void finish(r.mimeType || mimeType)
    rec.current = r
    r.start(4000)
    startedAt.current = Date.now()
    void lock()
    setPhase('recording')
  }

  const marksRef = useRef(marks)
  marksRef.current = marks
  async function finish(mime: string) {
    setPhase('saving')
    await writes.current
    stream.current?.getTracks().forEach((t) => t.stop())
    void wake.current?.release().catch(() => undefined)
    await saveSession({ ...s!, status: 'logging', videoMime: mime, durationSec: Math.round((Date.now() - startedAt.current) / 1000), highlights: marksRef.current })
    nav(`memo/${id}`, true)
  }

  function mark() {
    const t = (Date.now() - startedAt.current) / 1000
    setMarks((m) => [...m, { id: uid(), t, label: `Highlight ${m.length + 1}` }])
    toast('Highlight saved')
  }

  async function skip() {
    if (s) await saveSession({ ...s, status: 'logging' })
    nav(`memo/${id}`, true)
  }

  if (s === null) return <Missing />
  const recording = phase === 'recording'
  return <div className="view">
    <Header title={recording ? 'Play' : 'Frame the hoop'} phase={1} onBack={recording ? undefined : () => history.back()} />
    <div className="pg">
      {!recording && phase !== 'denied' && phase !== 'unsupported' && <>
        <div className="h1">Is the hoop in frame?</div>
        <p className="lead">Lean your phone on a bag or fence, sideways if you can, with the rim and key in view.</p>
      </>}
      {phase === 'denied' && <><div className="h1">Camera is blocked</div><div className="note warn gap14"><Icon n="alert" /><div><b>Netrics needs camera access to film</b>Allow the camera in your browser's site settings and reload. Or skip filming and log your stats by voice.</div></div></>}
      {phase === 'unsupported' && <><div className="h1">No camera here</div><div className="note warn gap14"><Icon n="alert" /><div><b>This browser cannot record video</b>Try Chrome or Safari on your phone. You can still log your stats by voice.</div></div></>}
      {phase !== 'denied' && phase !== 'unsupported' && <div className="scene gap14">
        <video ref={video} playsInline muted autoPlay aria-label="Live camera preview" />
        {!recording && phase === 'ready' && <HoopGuide />}
        {phase === 'asking' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Starting camera…</div>}
        {recording && <span className="live tl"><i /><span>Recording</span></span>}
        {phase === 'ready' && <button className="live tr" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label="Switch camera"><Icon n="flip" s={15} /> Flip</button>}
      </div>}
      {recording && <div style={{ textAlign: 'center', marginTop: 18 }}>
        <div className="lbl">Elapsed</div>
        <div className="big gr" style={{ fontSize: 112, marginTop: 8 }}>{fmt(secs)}</div>
        <button className="btn gh gap20" style={{ minHeight: 76, fontSize: 19 }} onClick={mark}><Icon n="star" s={24} /> Highlight that</button>
        <div className="xs mu gap8">{marks.length ? `${marks.length} highlight${marks.length > 1 ? 's' : ''} marked` : 'Tap right after a good play. Keep this screen open while filming.'}</div>
      </div>}
      {storageFull && <div className="note warn gap14"><Icon n="alert" /><div><b>Phone storage is full</b>We saved what was filmed so far.</div></div>}
      {phase === 'ready' && <div className="note gap14"><Icon n="shield" /><div><b>Stays on your phone</b>Video is stored only on this device, with no sound recorded. Other people may be in frame, so ask before you share.</div></div>}
    </div>
    <div className="cta">
      {phase === 'ready' && <button className="btn pri" onClick={start}>Start recording</button>}
      {recording && <button className="btn pri" onClick={() => rec.current?.stop()}>End session</button>}
      {phase === 'saving' && <button className="btn pri" disabled>Saving footage…</button>}
      {(phase === 'denied' || phase === 'unsupported') && <button className="btn pri" onClick={skip}>Log my stats by voice</button>}
      {phase === 'ready' && <button className="lnk" onClick={skip}>Skip filming</button>}
    </div>
  </div>
}

export function Missing() {
  return <div className="view"><div className="pg" style={{ paddingTop: 60 }}><div className="h1">Session not found</div><p className="lead">It may have been deleted.</p><button className="btn pri gap20" onClick={() => nav('', true)}>Go home</button></div></div>
}
