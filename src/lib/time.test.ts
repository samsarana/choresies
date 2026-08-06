import { describe, expect, it } from 'vitest'
import {
  addDays,
  calDateIn,
  monthKeyFor,
  monthLabel,
  nextWeekKey,
  prevMonthKey,
  prevWeekKey,
  weekKeyFor,
  weekRangeLabel,
} from './time'

const NZ = 'Pacific/Auckland'
const LDN = 'Europe/London'

describe('addDays (pure calendar arithmetic)', () => {
  it('crosses year boundaries', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('handles leap years', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
  it('week hops', () => {
    expect(prevWeekKey('2026-01-05')).toBe('2025-12-29')
    expect(nextWeekKey('2025-12-29')).toBe('2026-01-05')
  })
})

describe('weekKeyFor — Monday-start weeks in the household timezone', () => {
  it('a plain mid-week instant', () => {
    // 2026-07-06 is a Monday. Noon UTC that day is Monday everywhere relevant.
    const d = new Date(Date.UTC(2026, 6, 6, 12, 0))
    expect(weekKeyFor(d, 'UTC')).toBe('2026-07-06')
    expect(weekKeyFor(d, NZ)).toBe('2026-07-06')
  })

  it('the same instant can fall in different weeks in different timezones', () => {
    // Sunday 2026-07-12 12:30 UTC == Monday 2026-07-13 00:30 in Auckland (UTC+12).
    const d = new Date(Date.UTC(2026, 6, 12, 12, 30))
    expect(weekKeyFor(d, 'UTC')).toBe('2026-07-06') // still last week
    expect(weekKeyFor(d, NZ)).toBe('2026-07-13') // new week has started
  })

  it('Sunday 23:59 belongs to the closing week; Monday 00:00 to the new one', () => {
    // Auckland is UTC+12 in July (NZST). Sunday 2026-07-12 23:59 NZST == 11:59 UTC.
    const lateSunday = new Date(Date.UTC(2026, 6, 12, 11, 59))
    expect(weekKeyFor(lateSunday, NZ)).toBe('2026-07-06')
    const midnightMonday = new Date(Date.UTC(2026, 6, 12, 12, 0))
    expect(weekKeyFor(midnightMonday, NZ)).toBe('2026-07-13')
  })

  it('is stable across a DST transition (NZ DST ends 5 Apr 2026)', () => {
    // 2026-04-05T15:00Z == Monday 2026-04-06 03:00 NZST (after clocks fell back).
    const d = new Date(Date.UTC(2026, 3, 5, 15, 0))
    expect(weekKeyFor(d, NZ)).toBe('2026-04-06')
    // And just before the transition, still Sunday's week.
    const before = new Date(Date.UTC(2026, 3, 4, 15, 0)) // Sun 2026-04-05 04:00 NZDT
    expect(weekKeyFor(before, NZ)).toBe('2026-03-30')
  })

  it('London around new year', () => {
    // Thu 2026-01-01 00:30 London == 00:30 UTC (GMT in winter).
    const d = new Date(Date.UTC(2026, 0, 1, 0, 30))
    expect(weekKeyFor(d, LDN)).toBe('2025-12-29')
  })
})

describe('monthKeyFor', () => {
  it('same instant, different months across timezones', () => {
    // 2026-07-31T14:00Z == 2026-08-01 02:00 in Auckland.
    const d = new Date(Date.UTC(2026, 6, 31, 14, 0))
    expect(monthKeyFor(d, 'UTC')).toBe('2026-07')
    expect(monthKeyFor(d, NZ)).toBe('2026-08')
  })
})

describe('labels', () => {
  it('same-month week range', () => {
    expect(weekRangeLabel('2026-07-06')).toBe('Mon 6 – Sun 12 Jul')
  })
  it('cross-month and cross-year week range', () => {
    expect(weekRangeLabel('2025-12-29')).toBe('Mon 29 Dec – Sun 4 Jan')
  })
  it('month labels', () => {
    expect(monthLabel('2026-07')).toBe('July 2026')
    expect(prevMonthKey('2026-01')).toBe('2025-12')
  })
})

describe('calDateIn weekday mapping', () => {
  it('maps Monday=1 … Sunday=7', () => {
    expect(calDateIn(new Date(Date.UTC(2026, 6, 6, 12)), 'UTC').weekday).toBe(1)
    expect(calDateIn(new Date(Date.UTC(2026, 6, 12, 12)), 'UTC').weekday).toBe(7)
  })
})
