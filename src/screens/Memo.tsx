import { useEffect, useRef, useState } from 'react'
import { getMemo, putMemo, saveSession } from '../lib/db'
import { audioMime, canRecord, decodeTo16k, transcribe } from '../lib/media'
import { parseMemo } from '../lib/parser'
import { fmt } from '../lib/stats'
import { Session } from '../lib/types'
import { Header, Icon, nav, useSession } from '../ui/kit'
import { Missing } from './Record'

const BARS = 21

export function Memo({ id }: { id: string }) {
  const [s] = useSession(id)
  const [state, setState] = useState<'idle' | 'rec' | 'review' | 'type'>('idle')
  const [err, setErr] = useState('')
  const [secs, setSecs] = useState(0)
  const [levels, setLevels] = useState<number[]>(Array(BARS).fill(0))
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const rec = useRef<MediaRecorder | null>(null)
  const stop = useRef<() => void>(() => undefined)

  useEffect(() => () => stop.current(), [])
  useEffect(() => { if (!blob) { setUrl(''); return } const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u) }, [blob])

  async function begin() {
    setErr('')
    if (!canRecord()) { setErr('This browser cannot record audio. Type your stats instead.'); return }
    let st: MediaStream
    try { st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) }
    catch { setErr('The microphone is blocked. Allow it in site settings, upload a memo, or type your stats.'); return }
    const mimeType = audioMime()
    let r: MediaRecorder
    try { r = new MediaRecorder(st, mimeType ? { mimeType } : undefined) }
    catch { st.getTracks().forEach((t) => t.stop()); setErr('This browser could not start the recorder. Upload a memo or type your stats.'); return }
    const parts: Blob[] = []
    r.ondataavailable = (e) => e.data.size && parts.push(e.data)
    r.onstop = () => { setBlob(new Blob(parts, { type: r.mimeType || mimeType })); setState('review') }
    const AC: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext
    const ctx = new AC(), an = ctx.createAnalyser()
    an.fftSize = 64
    ctx.createMediaStreamSource(st).connect(an)
    const data = new Uint8Array(an.frequencyBinCount), t0 = Date.now()
    const draw = setInterval(() => {
      an.getByteFrequencyData(data)
      setLevels(Array.from({ length: BARS }, (_, i) => data[Math.min(i, data.length - 1)] / 255))
      setSecs((Date.now() - t0) / 1000)
    }, 80)
    stop.current = () => { clearInterval(draw); void ctx.close().catch(() => undefined); if (r.state === 'recording') r.stop(); st.getTracks().forEach((t) => t.stop()); stop.current = () => undefined }
    rec.current = r
    r.start()
    setState('rec')
  }

  const useMemoBlob = async (b: Blob) => {
    if (!s) return
    await putMemo(id, b)
    await saveSession({ ...s, status: 'logging', memoMime: b.type || 'audio/mp4', transcript: '' })
    nav(`processing/${id}`, true)
  }
  const useText = async () => {
    if (!s) return
    await saveSession({ ...s, status: 'logging', transcript: text.trim() })
    nav(`processing/${id}`, true)
  }
  const byHand = async () => {
    if (!s) return
    await saveSession({ ...s, status: 'draft' })
    nav(`correct/${id}`, true)
  }

  if (s === null) return <Missing />
  return <div className="view">
    <Header title="Voice memo" phase={2} onBack={() => history.back()} />
    <div className="pg">
      {state !== 'type' && <>
        <div className="h1">Say your stats</div>
        <p className="lead">Just talk. Name the spot if you remember it, and it lands on your shot chart.</p>
        <div className="card gap14" style={{ background: 'var(--tint)', borderColor: '#BFE3CE' }}>
          <div className="lbl" style={{ color: 'var(--deep)' }}>Try something like</div>
          <p className="gap8" style={{ lineHeight: 1.45, fontWeight: 500 }}>"Five for eight at the rim. Left corner two of three. Four for ten from three. Six rebounds, three assists, and we won 21 to 18."</p>
        </div>
      </>}
      {err && <div className="note warn"><Icon n="alert" /><div>{err}</div></div>}
      {(state === 'idle' || state === 'rec') && <div style={{ textAlign: 'center', marginTop: 18 }}>
        <button className={'mic' + (state === 'rec' ? ' rec' : '')} onClick={state === 'rec' ? () => stop.current() : begin} aria-label={state === 'rec' ? 'Stop recording' : 'Record voice memo'}><Icon n={state === 'rec' ? 'stop' : 'mic'} s={48} /></button>
        {state === 'rec'
          ? <><div className="bars" aria-hidden="true">{levels.map((l, i) => <i key={i} style={{ height: 4 + l * 40 }} />)}</div><div className="big gap8" style={{ fontSize: 44 }}>{fmt(secs)}</div><div className="xs mu gap8">Tap to finish</div></>
          : <div className="sm mu gap14">Tap to record</div>}
      </div>}
      {state === 'review' && url && <div className="card gap14">
        <div className="lbl">Your memo</div>
        <audio className="gap8" src={url} controls style={{ width: '100%' }} />
        <button className="btn gh gap14" onClick={() => { setBlob(null); setState('idle') }}><Icon n="sync" s={18} /> Record again</button>
      </div>}
      {state === 'type' && <>
        <div className="h1">Type your stats</div>
        <p className="lead">Write it the way you would say it.</p>
        <textarea className="tx gap14" value={text} onChange={(e) => setText(e.target.value)} placeholder="Five for eight at the rim, four for ten from three, six rebounds" aria-label="Your stats" />
      </>}
    </div>
    <div className="cta">
      {state === 'review' && blob && <button className="btn pri" onClick={() => useMemoBlob(blob)}>Use this memo</button>}
      {state === 'type' && <button className="btn pri" disabled={!text.trim()} onClick={useText}>Read my stats</button>}
      {state === 'idle' && <div className="row" style={{ gap: 8 }}>
        <label className="btn gh sm" style={{ flex: 1, height: 48, cursor: 'pointer' }}><Icon n="upload" s={17} /> Upload<input type="file" accept="audio/*,.m4a,.mp3,.wav" hidden aria-label="Upload a voice memo" onChange={(e) => { const f = e.target.files?.[0]; if (f) void useMemoBlob(f) }} /></label>
        <button className="btn gh sm" style={{ flex: 1, height: 48 }} onClick={() => setState('type')}><Icon n="type" s={17} /> Type</button>
      </div>}
      {state === 'type' && <button className="lnk" onClick={() => setState('idle')}>Back to voice</button>}
      {state !== 'rec' && <button className="lnk" onClick={byHand}>Enter numbers by hand</button>}
    </div>
  </div>
}

type Step = 'load' | 'listen' | 'read' | 'failed'

export function Processing({ id }: { id: string }) {
  const [s] = useSession(id)
  const [step, setStep] = useState<Step>('load')
  const [dl, setDl] = useState<{ ratio: number; mb: number } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!s) return
    let live = true, cancel = () => {}
    const finish = async (sess: Session, transcript: string) => {
      setStep('read')
      const { stats, flags } = parseMemo(transcript)
      await saveSession({ ...sess, status: 'draft', transcript, stats, flags })
      if (live) nav(`recap/${id}`, true)
    }
    ;(async () => {
      setError(''); setStep('load'); setDl(null)
      if (s.transcript) return finish(s, s.transcript)
      const memo = await getMemo(id)
      if (!memo) throw new Error('No memo was saved for this session.')
      const audio = await decodeTo16k(memo)
      const job = transcribe(audio, (e) => { if (!live) return; if (e.type === 'download') setDl(e); else setStep('listen') })
      cancel = job.cancel
      const text = await job.done
      if (live) await finish(s, text)
    })().catch((e) => { if (live) { setError(e instanceof Error ? e.message : String(e)); setStep('failed') } })
    return () => { live = false; cancel() }
  }, [s, id, attempt])

  if (s === null) return <Missing />
  const failed = step === 'failed'
  const idx = step === 'load' ? 1 : step === 'listen' ? 2 : step === 'read' ? 3 : 1
  const names = ['Saved your session', dl ? `Getting the speech model (${dl.mb} MB, one time)` : 'Starting the speech model', 'Listening to your memo', 'Reading your stats']
  const ratio = step === 'load' && dl ? 0.25 + dl.ratio * 0.25 : idx / 4
  const shown = Math.round(ratio * 100)
  return <div className="view">
    <Header title="Processing" phase={2} />
    <div className="pg" style={{ textAlign: 'center' }}>
      <div className="h1" style={{ marginTop: 6 }}>{failed ? 'We could not hear that' : 'Building your session'}</div>
      <p className="lead">{failed ? 'Your memo is saved. Try again, or add your stats another way.' : 'This runs on your phone, so your voice never leaves it.'}</p>
      {!failed && <div style={{ margin: '22px auto 10px', width: 150, height: 150, position: 'relative' }}>
        <svg className="ring" width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="64" fill="none" stroke="#DFE8E3" strokeWidth="10" /><circle cx="75" cy="75" r="64" fill="none" stroke="#0A7F48" strokeWidth="10" strokeLinecap="round" strokeDasharray="402" strokeDashoffset={402 * (1 - ratio)} style={{ transition: 'stroke-dashoffset .5s' }} /></svg>
        <div className="big" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54 }}>{shown}%</div>
      </div>}
      {failed && <div className="note warn gap14" style={{ textAlign: 'left' }}><Icon n="alert" /><div><b>Transcription failed</b>{navigator.onLine ? error : 'You are offline. The speech model needs internet the first time.'}</div></div>}
      <div className="card" style={{ textAlign: 'left', padding: '6px 16px', marginTop: 14 }}>
        {names.map((n, k) => { const done = idx > k; return <div key={n} className={'chk' + (done ? ' done' : '')}><span className="ci">{done && <Icon n="check" s={14} w={3} />}</span><span className="grow">{n}</span>{!failed && idx === k && <span className="r blink">Working</span>}</div> })}
      </div>
    </div>
    <div className="cta">
      {failed && <><button className="btn pri" onClick={() => setAttempt(attempt + 1)}>Try again</button><button className="lnk" onClick={() => nav(`memo/${id}`, true)}>Type my stats instead</button></>}
      {!failed && <button className="lnk" onClick={async () => { if (s) await saveSession({ ...s, status: 'draft' }); nav(`correct/${id}`, true) }}>Skip the wait, enter by hand</button>}
    </div>
  </div>
}
