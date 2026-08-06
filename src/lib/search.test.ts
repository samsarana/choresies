import { describe, expect, it } from 'vitest'
import { frequentTasks, nearDuplicate, normalize, searchTasks } from './search'
import { aliasesFor } from './aliases'
import type { Task } from './types'

let nextId = 0
function task(name: string, logCount: number, aliases?: string[]): Task {
  return {
    id: `t${nextId++}`,
    name,
    nameLower: normalize(name),
    aliases: aliases ?? aliasesFor(name),
    logCount,
    totalMinutes: logCount * 10,
    lastLoggedAt: 0,
  }
}

describe('normalize', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalize('  Café — TIDY!! ')).toBe('cafe tidy')
  })
})

describe('frequentTasks (SPEC §3)', () => {
  it('only includes chores logged ≥2 times', () => {
    const tasks = [task('Once', 1), task('Twice', 2), task('Never', 0)]
    expect(frequentTasks(tasks).map((t) => t.name)).toEqual(['Twice'])
  })
  it('ranks by log count desc and caps at 20', () => {
    const tasks = Array.from({ length: 30 }, (_, i) => task(`Chore ${i}`, i + 2))
    const out = frequentTasks(tasks)
    expect(out).toHaveLength(20)
    expect(out[0].logCount).toBe(31)
    expect(out[19].logCount).toBe(12)
  })
})

describe('searchTasks (SPEC §3 — substring + alias matching)', () => {
  const dishwasher = task('Unstack dishwasher', 12)
  const vacuum = task('Vacuum lounge', 9)
  const bins = task('Bins out', 7)
  const dishes = task('Do the dishes', 3)
  const all = [dishwasher, vacuum, bins, dishes]

  it('matches from the middle of the name, not just the start', () => {
    expect(searchTasks('di', all).map((t) => t.name)).toContain('Unstack dishwasher')
    expect(searchTasks('wash', all).map((t) => t.name)).toContain('Unstack dishwasher')
  })

  it('finds chores via aliases: "unlo"/"empty" → Unstack dishwasher', () => {
    expect(searchTasks('unlo', all).map((t) => t.name)).toContain('Unstack dishwasher')
    expect(searchTasks('empty', all).map((t) => t.name)).toContain('Unstack dishwasher')
    expect(searchTasks('hoover', all).map((t) => t.name)).toContain('Vacuum lounge')
  })

  it('ranks direct name matches above alias matches, popularity breaking ties', () => {
    const results = searchTasks('dish', all)
    expect(results[0].name).toBe('Unstack dishwasher') // word-start + most logged
  })

  it('empty query returns the frequent list', () => {
    expect(searchTasks('', all).every((t) => t.logCount >= 2)).toBe(true)
  })
})

describe('aliasesFor', () => {
  it('attaches dishwasher synonyms', () => {
    const a = aliasesFor('Unstack dishwasher')
    expect(a).toEqual(expect.arrayContaining(['unload', 'empty', 'dishes']))
    expect(a).not.toContain('unstack') // words already in the name are excluded
  })
  it('does not false-positive on lookalike words', () => {
    expect(aliasesFor('Radish prep')).not.toContain('dishwasher')
  })
  it('matches compound words by prefix', () => {
    expect(aliasesFor('Dishwashing marathon')).toEqual(expect.arrayContaining(['unload', 'empty']))
  })
})

describe('nearDuplicate (SPEC §3 — consolidation nudge)', () => {
  const existing = [task('Unstack dishwasher', 12), task('Cook flat dinner', 6), task('Bins out', 7)]

  it('flags unload/unstack dishwasher as the same chore', () => {
    expect(nearDuplicate('unload dishwasher', existing)?.name).toBe('Unstack dishwasher')
    expect(nearDuplicate('Empty the dishwasher', existing)?.name).toBe('Unstack dishwasher')
  })
  it('exact (normalized) names match', () => {
    expect(nearDuplicate('  UNSTACK dishwasher! ', existing)?.name).toBe('Unstack dishwasher')
  })
  it('containment matches', () => {
    expect(nearDuplicate('dishwasher', existing)?.name).toBe('Unstack dishwasher')
  })
  it('distinct chores stay distinct', () => {
    expect(nearDuplicate('Clean bathroom', existing)).toBeNull()
    expect(nearDuplicate('Cook lunch', existing)).toBeNull()
  })
})
