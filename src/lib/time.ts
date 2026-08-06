/**
 * Calendar math that is safe across timezones and DST.
 *
 * Strategy: never do hour arithmetic. Use Intl to read the calendar date
 * (year/month/day/weekday) of an instant *in the household timezone*, then do
 * all week/month arithmetic on pure calendar dates via Date.UTC.
 *
 * weekKey  = "YYYY-MM-DD" of the MONDAY of that week (sorts correctly, no ISO
 *            week-number edge cases).
 * monthKey = "YYYY-MM".
 */

export interface CalDate {
  y: number
  m: number // 1-12
  d: number // 1-31
  weekday: number // 1 = Monday … 7 = Sunday
}

const WEEKDAYS: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
}

const partsCache = new Map<string, Intl.DateTimeFormat>()

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    })
    partsCache.set(tz, f)
  }
  return f
}

/** Calendar date of `instant` as observed in `tz`. */
export function calDateIn(instant: Date, tz: string): CalDate {
  const parts = formatterFor(tz).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function keyOf(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

/** Add n days to a calendar date (pure calendar arithmetic — DST-immune). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d + n)
  const dt = new Date(t)
  return keyOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Monday ("YYYY-MM-DD") of the week containing `instant`, in `tz`. */
export function weekKeyFor(instant: Date, tz: string): string {
  const c = calDateIn(instant, tz)
  const mondayOffset = c.weekday - 1 // 0 for Monday … 6 for Sunday
  return addDays(keyOf(c.y, c.m, c.d), -mondayOffset)
}

/** "YYYY-MM" of `instant` in `tz`. */
export function monthKeyFor(instant: Date, tz: string): string {
  const c = calDateIn(instant, tz)
  return `${c.y}-${pad(c.m)}`
}

export const prevWeekKey = (weekKey: string) => addDays(weekKey, -7)
export const nextWeekKey = (weekKey: string) => addDays(weekKey, 7)

export function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Mon 6 – Sun 12 Jul" or "Mon 28 Dec – Sun 3 Jan" across month boundaries. */
export function weekRangeLabel(weekKey: string): string {
  const [y1, m1, d1] = weekKey.split('-').map(Number)
  const sunday = addDays(weekKey, 6)
  const [y2, m2, d2] = sunday.split('-').map(Number)
  const sameMonth = y1 === y2 && m1 === m2
  const left = sameMonth ? `Mon ${d1}` : `Mon ${d1} ${MONTHS[m1 - 1]}`
  return `${left} – Sun ${d2} ${MONTHS[m2 - 1]}`
}

/** "July 2026" */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December']
  return `${LONG[m - 1]} ${y}`
}

/** Device timezone, with a safe fallback. */
export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** True if `tz` is a valid IANA timezone on this device. */
export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
