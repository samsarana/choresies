import { useEffect, useMemo, useState } from 'preact/hooks'
import type { HouseholdPublic, LogEntry, Member } from '../lib/types'
import type { Store } from '../store/store'
import { monthKeyFor, monthLabel, prevWeekKey, weekKeyFor } from '../lib/time'
import { AvatarView, IconTrash } from './bits'

export function YouScreen({
  store,
  household,
  me,
  onToast,
}: {
  store: Store
  household: HouseholdPublic
  me: Member
  onToast: (msg: string) => void
}) {
  const [logs, setLogs] = useState<LogEntry[] | null>(null)

  const refresh = () => {
    store.fetchMemberLogs(household.id, me.id).then(setLogs)
  }
  useEffect(refresh, [store, household.id, me.id])

  const currentWeek = weekKeyFor(new Date(), household.tz)
  const currentMonth = monthKeyFor(new Date(), household.tz)
  const threshold = household.thresholdMinutes

  const stats = useMemo(() => {
    let week = 0
    let month = 0
    let all = 0
    for (const l of logs ?? []) {
      all += l.minutes
      if (l.weekKey === currentWeek) week += l.minutes
      if (l.monthKey === currentMonth) month += l.minutes
    }
    return { week, month, all }
  }, [logs, currentWeek, currentMonth])

  /** Last 8 weeks (clamped to household inception), oldest → newest. */
  const weekly = useMemo(() => {
    const inceptionWeek = weekKeyFor(new Date(household.createdAt || 0), household.tz)
    const keys: string[] = []
    let k = currentWeek
    for (let i = 0; i < 8 && k >= inceptionWeek; i++) {
      keys.unshift(k)
      k = prevWeekKey(k)
    }
    const totals = new Map(keys.map((key) => [key, 0]))
    for (const l of logs ?? []) {
      if (totals.has(l.weekKey)) totals.set(l.weekKey, totals.get(l.weekKey)! + l.minutes)
    }
    return keys.map((key) => ({ key, minutes: totals.get(key)! }))
  }, [logs, currentWeek, household.createdAt, household.tz])

  const monthly = useMemo(() => {
    const totals = new Map<string, number>()
    for (const l of logs ?? []) totals.set(l.monthKey, (totals.get(l.monthKey) ?? 0) + l.minutes)
    return [...totals.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6)
  }, [logs])

  const remove = async (entry: LogEntry) => {
    if (!window.confirm(`Remove “${entry.taskName}” (${entry.minutes} mins)?`)) return
    try {
      await store.deleteLog(household.id, entry)
      onToast('Removed')
      refresh()
    } catch (e) {
      console.error(e)
      onToast('Couldn’t remove — check your connection')
    }
  }

  const maxWeekly = Math.max(threshold, ...weekly.map((w) => w.minutes), 1)

  return (
    <>
      <div class="you-head">
        <AvatarView avatar={me.avatar} size={54} />
        <div class="who">
          <h1>{me.name}</h1>
          <p>Personal stats</p>
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-cell">
          <div class="v">{logs === null ? '—' : stats.week}</div>
          <div class="k">mins this week</div>
        </div>
        <div class="stat-cell">
          <div class="v">{logs === null ? '—' : stats.month}</div>
          <div class="k">mins this month</div>
        </div>
        <div class="stat-cell">
          <div class="v">{logs === null ? '—' : stats.all}</div>
          <div class="k">mins all-time</div>
        </div>
      </div>

      <div class="section-label">Your last 8 weeks</div>
      <div class="mini-bars">
        <div class="mini-plot">
          <div class="mini-thresh" style={{ bottom: `${(threshold / maxWeekly) * 100}%` }} />
          {weekly.map((w) => (
            <div class="mini-colbar" key={w.key}>
              <div
                class={`mini-bar ${w.minutes >= threshold ? 'hit' : ''}`}
                style={{ height: `${Math.max((w.minutes / maxWeekly) * 100, 2)}%` }}
                title={`${w.minutes} mins`}
              />
            </div>
          ))}
        </div>
        <div class="mini-labels">
          {weekly.map((w) => (
            <span class="lbl" key={w.key}>
              {Number(w.key.slice(8))}/{Number(w.key.slice(5, 7))}
            </span>
          ))}
        </div>
      </div>

      {monthly.length > 0 && (
        <>
          <div class="section-label">Months</div>
          <div class="settings-group">
            {monthly.map(([key, minutes]) => (
              <div class="settings-row" key={key}>
                <span class="k">{monthLabel(key)}</span>
                <span class="v">{minutes} mins</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div class="section-label">Recent logs</div>
      {logs === null ? (
        <p class="empty-note">Loading…</p>
      ) : logs.length === 0 ? (
        <p class="empty-note">Nothing logged yet — your history lives here.</p>
      ) : (
        <div>
          {logs.slice(0, 30).map((l) => (
            <div class="history-row" key={l.id}>
              <span class="nm">{l.taskName}</span>
              <span class="meta">
                {new Date(l.at).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
                {' · '}
                {l.minutes} mins
              </span>
              <button class="del" onClick={() => remove(l)} aria-label={`Remove ${l.taskName}`}>
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
