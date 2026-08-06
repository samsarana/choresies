import { useEffect, useState } from 'preact/hooks'
import type { HouseholdPublic } from './lib/types'
import { getStore, type Store } from './store/store'
import { clearSession, loadSession, saveSession, type DeviceSession } from './store/session'
import { HouseholdGate } from './ui/HouseholdGate'
import { ProfilePicker } from './ui/ProfilePicker'
import { Main } from './ui/Main'
import { Splash } from './ui/bits'

export function App() {
  const [store, setStore] = useState<Store | null>(null)
  const [session, setSessionState] = useState<DeviceSession>(() => loadSession())
  const [household, setHousehold] = useState<HouseholdPublic | null>(null)
  const [restored, setRestored] = useState(false)

  const setSession = (s: DeviceSession) => {
    saveSession(s)
    setSessionState(s)
  }

  useEffect(() => {
    getStore().then(async (s) => {
      try {
        await s.ensureAuth()
      } catch (e) {
        console.error('auth failed', e)
      }
      setStore(s)
    })
  }, [])

  // Restore the remembered household; drop the session if it no longer checks out.
  useEffect(() => {
    if (!store) return
    const hid = session.householdId
    if (!hid) {
      setHousehold(null)
      setRestored(true)
      return
    }
    let cancelled = false
    store.hasJoined(hid).then((joined) => {
      if (cancelled) return
      if (!joined) {
        clearSession()
        setSessionState({ householdId: null, memberId: null })
        setHousehold(null)
      }
      setRestored(true)
    })
    const unsub = store.subscribeHousehold(hid, (h) => {
      if (cancelled) return
      if (h === null) {
        clearSession()
        setSessionState({ householdId: null, memberId: null })
        setHousehold(null)
      } else {
        setHousehold(h)
      }
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [store, session.householdId])

  let content
  if (!store || !restored || (session.householdId && !household)) {
    content = <Splash />
  } else if (!session.householdId || !household) {
    content = (
      <HouseholdGate
        store={store}
        onEntered={(h) => {
          setHousehold(h)
          setSession({ householdId: h.id, memberId: null })
        }}
      />
    )
  } else if (!session.memberId) {
    content = (
      <ProfilePicker
        store={store}
        household={household}
        onPicked={(mid) => setSession({ householdId: household.id, memberId: mid })}
      />
    )
  } else {
    content = (
      <Main
        store={store}
        household={household}
        memberId={session.memberId}
        onSwitchProfile={() => setSession({ householdId: household.id, memberId: null })}
        onLeaveHousehold={() => setSession({ householdId: null, memberId: null })}
      />
    )
  }

  return (
    <div class="shell">
      {store?.mode === 'demo' && <span class="demo-badge">Demo mode</span>}
      {content}
    </div>
  )
}
