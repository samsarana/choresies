import type { Task } from './types'

/** lowercase, de-accent, single-space */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Frequent list for the empty-query Log screen:
 * only chores logged ≥ 2 times, ranked by log count desc, capped at 20.
 */
export function frequentTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.logCount >= 2)
    .sort((a, b) => b.logCount - a.logCount || b.lastLoggedAt - a.lastLoggedAt || a.name.localeCompare(b.name))
    .slice(0, 20)
}

/**
 * Live search across name AND aliases; substring matches anywhere, not just
 * the start. Lower tier = better match; ties broken by popularity.
 */
export function searchTasks(query: string, tasks: Task[]): Task[] {
  const q = normalize(query)
  if (!q) return frequentTasks(tasks)
  const scored: Array<{ t: Task; tier: number }> = []
  for (const t of tasks) {
    const tier = matchTier(q, t)
    if (tier >= 0) scored.push({ t, tier })
  }
  return scored
    .sort((a, b) => a.tier - b.tier || b.t.logCount - a.t.logCount || a.t.name.localeCompare(b.t.name))
    .map((s) => s.t)
    .slice(0, 20)
}

function matchTier(q: string, t: Task): number {
  const name = t.nameLower
  if (name.startsWith(q)) return 0
  const words = name.split(' ')
  if (words.some((w) => w.startsWith(q))) return 1
  if (name.includes(q)) return 2
  for (const alias of t.aliases) {
    if (alias.startsWith(q)) return 3
    if (alias.includes(q)) return 4
  }
  return -1
}

/**
 * Near-duplicate detection to keep counts consolidated. Weighted by shared
 * *characters* rather than word count, so the long distinctive word dominates:
 * "unload dishwasher" ≈ "unstack dishwasher" (shares "dishwasher"), while
 * "cook dinner" ≠ "cook lunch" (shares only "cook").
 */
export function nearDuplicate(name: string, tasks: Task[]): Task | null {
  const q = normalize(name)
  if (!q) return null
  const qWords = new Set(q.split(' '))
  let best: { t: Task; score: number } | null = null
  for (const t of tasks) {
    const n = t.nameLower
    if (n === q) return t
    let score = 0
    if (n.includes(q) || q.includes(n)) score = 0.9
    else {
      const nWords = n.split(' ')
      let sharedChars = 0
      for (const w of new Set(nWords)) if (qWords.has(w)) sharedChars += w.length
      const denom = Math.max(q.replace(/ /g, '').length, n.replace(/ /g, '').length)
      score = denom ? sharedChars / denom : 0
    }
    if (score >= 0.5 && (!best || score > best.score || (score === best.score && t.logCount > best.t.logCount))) {
      best = { t, score }
    }
  }
  return best?.t ?? null
}
