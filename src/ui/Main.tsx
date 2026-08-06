import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { HouseholdPublic, LogEntry, Member, Task } from '../lib/types'
import type { Store } from '../store/store'
import { monthKeyFor, prevWeekKey, weekKeyFor } from '../lib/time'
import { getLastSeenWeek, setLastSeenWeek } from '../store/session'
import { burstConfetti } from '../lib/confetti'
import { IconBoard, IconLog, IconYou, Splash } from './bits'
import { LogScreen } from './LogScreen'
import { BoardScreen } from './BoardScreen'
import { YouScreen } from './YouScreen'
import { Celebration, type CelebrationData } from './Celebration'

export type Tab = 'log' | 'board' | 'you'

export interface ToastState {
  msg: string
  actionLabel?: string
  action?: () => void
}

export function Main({
  store,
  household,
  memberId,
  onSwitchProfile,
  onLeaveHousehold,
}: {
  store: Store
  household: HouseholdPublic
  memberId: string
  onSwitchProfile: () => void
  onLeaveHousehold: () => void
}) {
  const [tab, setTab] = useState<Tab>('log')
  const [members, setMembers] = useState<Member[] | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [toast, setToast] = useState<ToastState | null>(null)
  const [celebration, setCelebration] = useState<CelebrationData | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => store.subscribeMembers(household.id, setMembers), [store, household.id])
  useEffect(() => store.subscribeTasks(household.id, setTasks), [store, household.id])

  const me = useMemo(() => members?.find((m) => m.id === memberId), [members, memberId])

  // Profile gone (deleted remotely / stale session) — don't strand the device
  // on the splash forever; bounce back to the profile picker.
  useEffect(() => {
    if (members !== null && !me) onSwitchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, me])

  // Phones keep PWAs suspended for days — re-evaluate "what week is it" every
  // time the app comes back to the foreground, not just on mount.
  const [wakeTick, setWakeTick] = useState(0)
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible') setWakeTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    return () => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
    }
  }, [])

  const showToast = (t: ToastState, ms = 5000) => {
    window.clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = window.setTimeout(() => setToast(null), ms)
  }

  /** SPEC §4 — first open after a week rollover celebrates last week's leader. */
  useEffect(() => {
    const hid = household.id
    const currentWeek = weekKeyFor(new Date(), household.tz)
    const lastSeen = getLastSeenWeek(hid)
    setLastSeenWeek(hid, currentWeek)
    // `<` (not `!==`) so a device clock jumping backwards can't celebrate.
    if (!lastSeen || !(lastSeen < currentWeek)) return

    const lastWeek = prevWeekKey(currentWeek)
    let cancelled = false
    // Server-preferred one-shot: a cache-first snapshot right after startup
    // could miss flatmates' late-Sunday logs and crown the wrong person.
    store.fetchLogsForWeekOnce(hid, lastWeek).then((logs) => {
      if (cancelled || logs.length === 0) return
      const totals = new Map<string, { name: string; minutes: number }>()
      for (const l of logs) {
        const t = totals.get(l.memberId) ?? { name: l.memberName, minutes: 0 }
        t.minutes += l.minutes
        totals.set(l.memberId, t)
      }
      let leaderId = ''
      let best = -1
      for (const [mid, t] of totals) {
        if (t.minutes > best || (t.minutes === best && t.name < (totals.get(leaderId)?.name ?? ''))) {
          best = t.minutes
          leaderId = mid
        }
      }
      const leader = totals.get(leaderId)!
      setCelebration({
        memberId: leaderId,
        name: leader.name,
        minutes: leader.minutes,
        weekKey: lastWeek,
      })
    }).catch((e) => console.error('[choresies] celebration fetch failed', e))
    return () => {
      cancelled = true
    }
    // Re-runs on mount and on every return-to-foreground (wakeTick); the
    // lastSeenWeek guard makes repeat runs free. Deliberately not keyed on tz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, household.id, wakeTick])

  /** Log a chore, throw confetti from the tap point, offer undo. */
  const logChore = async (
    input: { taskId?: string; name: string; minutes: number },
    origin: { x: number; y: number },
  ) => {
    if (!me) return
    const now = new Date()
    const payload = {
      taskId: input.taskId,
      name: input.name,
      memberId: me.id,
      memberName: me.name,
      minutes: input.minutes,
      weekKey: weekKeyFor(now, household.tz),
      monthKey: monthKeyFor(now, household.tz),
    }
    try {
      const { logId, taskId } = await store.logChore(household.id, payload)
      burstConfetti(origin.x, origin.y)
      const entry: LogEntry = {
        id: logId,
        taskId,
        taskName: input.name,
        memberId: me.id,
        memberName: me.name,
        minutes: input.minutes,
        at: now.getTime(),
        weekKey: payload.weekKey,
        monthKey: payload.monthKey,
      }
      let undone = false // one-shot: a double-tap must not reverse stats twice
      showToast({
        msg: `Logged ${input.name} · ${input.minutes} mins`,
        actionLabel: 'Undo',
        action: async () => {
          if (undone) return
          undone = true
          setToast(null)
          try {
            await store.deleteLog(household.id, entry)
            showToast({ msg: 'Undone' }, 2200)
          } catch (e) {
            console.error(e)
            showToast({ msg: 'Couldn’t undo — check your connection' }, 3500)
          }
        },
      })
    } catch (e) {
      console.error(e)
      showToast({ msg: 'Couldn’t log — check your connection' }, 3500)
    }
  }

  if (!me) {
    // Profile vanished (or members still loading) — fall back gracefully.
    return <Splash />
  }

  return (
    <>
      <div class="screen-scroll">
        {tab === 'log' && <LogScreen tasks={tasks} me={me} onLog={logChore} />}
        {tab === 'board' && (
          <BoardScreen
            store={store}
            household={household}
            members={members ?? []}
            me={me}
            onToast={(msg) => showToast({ msg }, 2600)}
            onSwitchProfile={onSwitchProfile}
            onLeaveHousehold={onLeaveHousehold}
          />
        )}
        {tab === 'you' && (
          <YouScreen store={store} household={household} me={me} onToast={(msg) => showToast({ msg }, 2600)} />
        )}
      </div>

      <nav class="tabbar" aria-label="Main">
        <button class={`tab ${tab === 'log' ? 'on' : ''}`} onClick={() => setTab('log')} aria-current={tab === 'log'}>
          <IconLog />
          Log
        </button>
        <button class={`tab ${tab === 'board' ? 'on' : ''}`} onClick={() => setTab('board')} aria-current={tab === 'board'}>
          <IconBoard />
          Board
        </button>
        <button class={`tab ${tab === 'you' ? 'on' : ''}`} onClick={() => setTab('you')} aria-current={tab === 'you'}>
          <IconYou />
          You
        </button>
      </nav>

      {toast && (
        <div class="toast" role="status">
          <span class="msg">{toast.msg}</span>
          {toast.action && (
            <button class="toast-btn" onClick={toast.action}>
              {toast.actionLabel ?? 'OK'}
            </button>
          )}
        </div>
      )}

      {celebration && (
        <Celebration
          data={celebration}
          member={members?.find((m) => m.id === celebration.memberId)}
          onClose={() => setCelebration(null)}
        />
      )}
    </>
  )
}
