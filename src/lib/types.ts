export interface Avatar {
  kind: 'emoji' | 'photo'
  /** emoji character, or a small data-URL for photos */
  value: string
  /** background colour token index 0-7 (emoji avatars) */
  color: number
}

export interface HouseholdPublic {
  id: string
  name: string
  salt: string
  tz: string
  thresholdMinutes: number
  /** epoch ms — leaderboard navigation doesn't go back past this */
  createdAt: number
}

export interface Member {
  id: string
  name: string
  avatar: Avatar
  createdAt: number
}

export interface Task {
  id: string
  name: string
  nameLower: string
  aliases: string[]
  logCount: number
  totalMinutes: number
  lastLoggedAt: number
}

export interface LogEntry {
  id: string
  taskId: string
  taskName: string
  memberId: string
  memberName: string
  minutes: number
  /** epoch ms (client clock at log time) */
  at: number
  /** Monday date of the week, "YYYY-MM-DD", in household tz */
  weekKey: string
  /** "YYYY-MM" in household tz */
  monthKey: string
}

export interface AllTimeTotals {
  [memberId: string]: { minutes: number; logs: number }
}

/** Typical minutes for a task: rounded mean, snapped to friendly steps. */
export function typicalMinutes(task: Pick<Task, 'logCount' | 'totalMinutes'>): number | null {
  if (task.logCount <= 0) return null
  const mean = task.totalMinutes / task.logCount
  const snapped = Math.round(mean / 5) * 5
  return Math.max(5, Math.min(600, snapped || 5))
}
