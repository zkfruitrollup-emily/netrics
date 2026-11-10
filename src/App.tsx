import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultProfile, getProfile, saveProfile } from './lib/db'
import { Profile as ProfileT } from './lib/types'
import { Correct } from './screens/Correct'
import { Memo, Processing } from './screens/Memo'
import { Profile } from './screens/Profile'
import { Recap } from './screens/Recap'
import { Record } from './screens/Record'
import { Home, NewSession, Onboarding, Sessions } from './screens/Start'
import { AppCtx, Icon, nav, useRoute } from './ui/kit'

const TABS = [['', 'Play', 'play'], ['sessions', 'Recaps', 'recap'], ['profile', 'Profile', 'profile']] as const

export default function App() {
  const [profile, setProfile] = useState<ProfileT | null>(null)
  const [toast, setToast] = useState('')
  const timer = useRef(0)
  const [root = '', arg] = useRoute()
  useEffect(() => { void getProfile().then(setProfile) }, [])

  const ctx = useMemo(() => ({
    profile: profile ?? defaultProfile(),
    update: (p: Partial<ProfileT>) => setProfile((cur) => { const next = { ...(cur ?? defaultProfile()), ...p }; void saveProfile(next); return next }),
    toast: (t: string) => { setToast(t); clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(''), 2000) },
  }), [profile])

  if (!profile) return null
  let screen
  if (!profile.onboarded) screen = <Onboarding />
  else if (root === 'new') screen = <NewSession />
  else if (root === 'record' && arg) screen = <Record key={arg} id={arg} />
  else if (root === 'memo' && arg) screen = <Memo key={arg} id={arg} />
  else if (root === 'processing' && arg) screen = <Processing key={arg} id={arg} />
  else if (root === 'recap' && arg) screen = <Recap key={arg} id={arg} />
  else if (root === 'correct' && arg) screen = <Correct key={arg} id={arg} />
  else if (root === 'sessions') screen = <Sessions />
  else if (root === 'profile') screen = <Profile just={arg === 'just'} />
  else screen = <Home />

  const showNav = profile.onboarded && ['', 'sessions', 'profile', 'recap'].includes(root)
  const active = root === 'recap' ? 'sessions' : root
  return <AppCtx.Provider value={ctx}>
    <div className="shell">
      {screen}
      {showNav && <nav className="nav">{TABS.map(([k, t, ic]) => <button key={t} className={active === k ? 'on' : ''} aria-current={active === k ? 'page' : undefined} onClick={() => nav(k)}><Icon n={ic} s={24} />{t}</button>)}</nav>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  </AppCtx.Provider>
}
