import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { getSession, listSessions } from '../lib/db'
import { Profile, Session } from '../lib/types'

const P: Record<string, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />, chev: <path d="M9 5l7 7-7 7" />, check: <path d="M5 12.5l4.5 4.5L19 7.5" />, x: <path d="M6 6l12 12M18 6L6 18" />,
  recap: <path d="M5 20V11M12 20V4M19 20v-6" />,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" />,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></>,
  share: <path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  flag: <path d="M6 21V4M6 5h11l-2 4 2 4H6" />,
  sync: <path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4" />,
  plus: <path d="M12 5v14M5 12h14" />, minus: <path d="M5 12h14" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
  cam: <><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M8 7l1.5-3h5L16 7" /><circle cx="12" cy="13.5" r="3.5" /></>,
  star: <path d="M12 3l2.7 5.9 6.3.8-4.7 4.3 1.3 6.3L12 17.1 6.4 20.3l1.3-6.3L3 9.7l6.3-.8z" />,
  flip: <path d="M4 9a8 8 0 0 1 14-3l2 2M20 4v4h-4M20 15a8 8 0 0 1-14 3l-2-2M4 20v-4h4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  down: <path d="M12 3v12M7.5 10.5L12 15l4.5-4.5M5 20h14" />,
  upload: <path d="M12 16V4M7.5 8.5L12 4l4.5 4.5M5 20h14" />,
  type: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
}
export function Icon({ n, s = 20, w = 2 }: { n: string; s?: number; w?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>
}

export function nav(path: string, replace = false) {
  if (replace) { history.replaceState(null, '', '#/' + path); window.dispatchEvent(new HashChangeEvent('hashchange')) }
  else location.hash = '/' + path
}
export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [r, set] = useState(read)
  useEffect(() => {
    const f = () => { set(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}

export interface Ctx { profile: Profile; update: (p: Partial<Profile>) => void; toast: (t: string) => void }
export const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

export function useSession(id: string) {
  const [s, set] = useState<Session | null | undefined>(undefined)
  useEffect(() => { let on = true; getSession(id).then((v) => on && set(v ?? null)); return () => { on = false } }, [id])
  return [s, set] as const
}
export function useSessions() {
  const [list, set] = useState<Session[] | null>(null)
  const reload = () => listSessions().then(set)
  useEffect(() => { void reload() }, [])
  return [list, reload] as const
}

const PHASES = ['Setup', 'On the court', 'After the session']
export function Header({ title, phase, onBack }: { title: string; phase?: number; onBack?: () => void }) {
  return <>
    {phase !== undefined && <div className="prog">{PHASES.map((t, i) => <div key={t} className={i < phase ? 'past' : i === phase ? 'on' : ''}><i />{t}</div>)}</div>}
    <div className={'hdr' + (phase === undefined ? ' top' : '')}>
      {onBack ? <button className="ib" onClick={onBack} aria-label="Back"><Icon n="back" s={24} /></button> : <span style={{ width: 8 }} />}
      <div className="hdt">{title}</div>
    </div>
  </>
}

export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <><div className="sheetbg" onClick={onClose} /><div className="sheet" role="dialog" aria-modal="true"><div className="grab" />{children}</div></>
}

export function Stepper({ value, onChange, label, min = 0 }: { value: number; onChange: (n: number) => void; label: string; min?: number }) {
  return <div className="stepper">
    <button onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Decrease ${label}`}><Icon n="minus" s={16} w={3} /></button>
    <b aria-label={label}>{value}</b>
    <button onClick={() => onChange(value + 1)} aria-label={`Increase ${label}`}><Icon n="plus" s={16} w={3} /></button>
  </div>
}

export const dateStr = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
export const timeStr = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
export const initial = (n: string) => (n.trim()[0] ?? 'P').toUpperCase()
