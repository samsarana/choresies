import { useEffect, useMemo, useState } from 'preact/hooks'
import type { AllTimeTotals, HouseholdPublic, LogEntry, Member } from '../lib/types'
import type { Store } from '../store/store'
import {
  monthKeyFor,
  monthLabel,
  nextWeekKey,
  prevMonthKey,
  prevWeekKey,
  weekKeyFor,
  weekRangeLabel,
} from '../lib/time'
import { AvatarView, Crown, IconGear } from './bits'
import { SettingsSheet } from './SettingsSheet'

type View = 'week' | 'month' | 'all'

function nextMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export function BoardScreen({
  store,
  household,
  members,
  me,
  onToast,
  onSwitchProfile,
  onLeaveHousehold,
}: {
  store: Store
  household: HouseholdPublic
  members: Member[]
  me: Member
  onToast: (msg: string) => void
  onSwitchProfile: () => void
  onLeaveHousehold: () => void
}) {
  const currentWeek = weekKeyFor(new Date(), household.tz)
  const currentMonth = monthKeyFor(new Date(), household.tz)
  // No navigating to before the household existed (0/missing → no clamp).
  const inception = new Date(household.createdAt || 0)
  const inceptionWeek = weekKeyFor(inception, household.tz)
  const inceptionMonth = monthKeyFor(inception, household.tz)

  const [view, setView] = useState<View>('week')
  const [weekKey, setWeekKey] = useState(currentWeek)
  const [monthKey, setMonthKey] = useState(currentMonth)

  // If the week rolls over while the app stays alive (Sunday midnight, or a
  // resumed PWA), snap the board to the new current week.
  useEffect(() => {
    setWeekKey(currentWeek)
    setMonthKey(currentMonth)
  }, [currentWeek, currentMonth])
  const [weekLogs, setWeekLogs] = useState<LogEntry[]>([])
  const [monthLogs, setMonthLogs] = useState<LogEntry[] | null>(null)
  const [allTotals, setAllTotals] = useState<AllTimeTotals>({})
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(
    () => store.subscribeLogsForWeek(household.id, weekKey, setWeekLogs),
    [store, household.id, weekKey],
  )

  useEffect(() => {
    if (view !== 'month') return
    setMonthLogs(null)
    return store.subscribeLogsForMonth(household.id, monthKey, setMonthLogs)
  }, [store, household.id, monthKey, view])

  useEffect(
    () => store.subscribeAllTimeTotals(household.id, setAllTotals),
    [store, household.id],
  )

  const threshold = household.thresholdMinutes

  const weekTotals = useMemo(() => {
    const map = new Map<string, number>(members.map((m) => [m.id, 0]))
    // Only count current members — a deleted profile's logs must not steal
    // the crown from everyone visible (maxWeek is derived from this map).
    for (const l of weekLogs) {
      if (map.has(l.memberId)) map.set(l.memberId, map.get(l.memberId)! + l.minutes)
    }
    return map
  }, [weekLogs, members])

  const maxWeek = Math.max(0, ...weekTotals.values())
  // Keep the threshold line comfortably inside the chart.
  const scaleMax = Math.max(threshold * 1.15, maxWeek, 1)

  const monthTotals = useMemo(() => {
    const map = new Map<string, number>(members.map((m) => [m.id, 0]))
    for (const l of monthLogs ?? []) {
      if (map.has(l.memberId)) map.set(l.memberId, map.get(l.memberId)! + l.minutes)
    }
    return map
  }, [monthLogs, members])

  const ranked = (totals: Map<string, number>) =>
    [...members]
      .map((m) => ({ m, minutes: totals.get(m.id) ?? 0 }))
      .sort((a, b) => b.minutes - a.minutes || a.m.name.localeCompare(b.m.name))

  return (
    <>
      <div class="topbar">
        <h1>Leaderboard</h1>
        <button class="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Household settings">
          <IconGear />
        </button>
      </div>

      <div class="viewtabs" role="tablist" aria-label="Leaderboard period">
        {(['week', 'month', 'all'] as View[]).map((v) => (
          <button
            key={v}
            class={`vt ${view === v ? 'on' : ''}`}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
          >
            {v === 'week' ? 'Week' : v === 'month' ? 'Month' : 'All-time'}
          </button>
        ))}
      </div>

      {view === 'week' && (
        <>
          <div class="weeknav">
            <button
              onClick={() => setWeekKey(prevWeekKey(weekKey))}
              disabled={weekKey <= inceptionWeek}
              aria-label="Previous week"
            >
              ‹
            </button>
            <span class="range">
              {weekKey === currentWeek ? 'This week · ' : ''}
              {weekRangeLabel(weekKey)}
            </span>
            <button
              onClick={() => setWeekKey(nextWeekKey(weekKey))}
              disabled={weekKey >= currentWeek}
              aria-label="Next week"
            >
              ›
            </button>
          </div>

          <div class="chart-card">
            <div class="chart">
              <div class="chart-inner">
              <div class="thresh" style={{ bottom: `${(threshold / scaleMax) * 100}%` }} />
              {members.map((m) => {
                const minutes = weekTotals.get(m.id) ?? 0
                const isLead = minutes > 0 && minutes === maxWeek
                const tier = isLead ? 'lead' : minutes >= threshold ? 'ok' : 'low'
                const pct = (minutes / scaleMax) * 100
                const numInside = pct >= 14
                return (
                  <div class="col" key={m.id}>
                    <div
                      class={`bar ${minutes === 0 ? 'zero' : tier}`}
                      style={{ height: `${Math.max(pct, 1.5)}%` }}
                    >
                      {isLead && (
                        <span class="crown-float">
                          <Crown />
                        </span>
                      )}
                      {minutes > 0 && numInside && minutes}
                      {(minutes === 0 || !numInside) && (
                        <span class="bar-num-out">{minutes}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
            <div class="board-people">
              {members.map((m) => (
                <div class="pcol" key={m.id}>
                  <AvatarView avatar={m.avatar} size={34} />
                  <span class="pname">{m.name}</span>
                </div>
              ))}
            </div>
          </div>

          {weekLogs.length === 0 && (
            <p class="empty-note">Nothing logged this week yet. The board awaits.</p>
          )}

          {weekLogs.length > 0 && (
            <>
              <div class="section-label">
                {weekKey === currentWeek ? 'This week’s logs' : 'That week’s logs'}
              </div>
              <div>
                {weekLogs.map((l) => {
                  const m = members.find((mm) => mm.id === l.memberId)
                  return (
                    <div class="history-row" key={l.id}>
                      {m && <AvatarView avatar={m.avatar} size={26} />}
                      <span class="nm">
                        <b>{l.memberName}</b> · {l.taskName}
                      </span>
                      <span class="meta">
                        {new Date(l.at).toLocaleDateString(undefined, { weekday: 'short' })} ·{' '}
                        {l.minutes} mins
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {view === 'month' && (
        <>
          <div class="weeknav">
            <button
              onClick={() => setMonthKey(prevMonthKey(monthKey))}
              disabled={monthKey <= inceptionMonth}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span class="range">{monthLabel(monthKey)}</span>
            <button
              onClick={() => setMonthKey(nextMonthKey(monthKey))}
              disabled={monthKey >= currentMonth}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          {monthLogs === null ? (
            <p class="empty-note">Loading…</p>
          ) : (
            <RankedRows rows={ranked(monthTotals)} unit="mins" />
          )}
        </>
      )}

      {view === 'all' && (
        <RankedRows
          rows={[...members]
            .map((m) => ({ m, minutes: allTotals[m.id]?.minutes ?? 0 }))
            .sort((a, b) => b.minutes - a.minutes || a.m.name.localeCompare(b.m.name))}
          unit="mins"
          sub={(m) => {
            const logs = allTotals[m.id]?.logs ?? 0
            return logs > 0 ? `${logs} chores` : ''
          }}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          store={store}
          household={household}
          me={me}
          onClose={() => setSettingsOpen(false)}
          onToast={onToast}
          onSwitchProfile={onSwitchProfile}
          onLeaveHousehold={onLeaveHousehold}
        />
      )}
    </>
  )
}

function RankedRows({
  rows,
  unit,
  sub,
}: {
  rows: Array<{ m: Member; minutes: number }>
  unit: string
  sub?: (m: Member) => string
}) {
  const max = Math.max(1, ...rows.map((r) => r.minutes))
  const anyMinutes = rows.some((r) => r.minutes > 0)
  return (
    <div class="ranked">
      {rows.map((r) => (
        <div class={`ranked-row ${r.minutes > 0 && r.minutes === max ? 'first' : ''}`} key={r.m.id}>
          <AvatarView avatar={r.m.avatar} size={34} />
          <span class="nm">{r.m.name}</span>
          <span class="track">
            <span class="fill" style={{ width: `${(r.minutes / max) * 100}%` }} />
          </span>
          <span class="mins">
            {r.minutes}
            <small> {unit}</small>
            {sub && <small style={{ display: 'block' }}>{sub(r.m)}</small>}
          </span>
        </div>
      ))}
      {!anyMinutes && <p class="empty-note">Nothing here yet.</p>}
    </div>
  )
}
