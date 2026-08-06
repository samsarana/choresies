import type { AllTimeTotals, Avatar, HouseholdPublic, LogEntry, Member, Task } from '../lib/types'
import { firebaseConfig } from '../config'

export type Unsub = () => void

export interface LogInput {
  /** existing chore id, or omit and provide `name` to create one */
  taskId?: string
  name?: string
  memberId: string
  memberName: string
  minutes: number
  weekKey: string
  monthKey: string
}

export interface Store {
  readonly mode: 'demo' | 'cloud'
  /** Resolve this device's stable identity (anonymous auth uid / device id). */
  ensureAuth(): Promise<string>

  findHouseholdByName(name: string): Promise<HouseholdPublic | null>
  createHousehold(name: string, password: string, tz: string): Promise<HouseholdPublic>
  /** Prove knowledge of the household password; true on success. */
  joinHousehold(household: HouseholdPublic, password: string): Promise<boolean>
  hasJoined(householdId: string): Promise<boolean>

  subscribeHousehold(hid: string, cb: (h: HouseholdPublic | null) => void): Unsub
  updateHousehold(hid: string, patch: { thresholdMinutes?: number }): Promise<void>

  subscribeMembers(hid: string, cb: (members: Member[]) => void): Unsub
  createMember(hid: string, input: { name: string; avatar: Avatar }): Promise<string>
  updateMember(hid: string, mid: string, patch: { name?: string; avatar?: Avatar }): Promise<void>
  /** Attach this device's uid to a member profile (Netflix-style pick). */
  claimMember(hid: string, mid: string): Promise<void>
  /** Delete a profile this device is signed in as. Their logs stay stored
   *  (history is never destroyed) but leave the charts. */
  deleteMember(hid: string, mid: string): Promise<void>

  subscribeTasks(hid: string, cb: (tasks: Task[]) => void): Unsub
  /** Returns ids so the caller can build an undo entry. `input.name` must be
   *  set even for existing tasks (denormalised onto the log). */
  logChore(hid: string, input: LogInput): Promise<{ logId: string; taskId: string }>
  /** Delete one of YOUR logs (undo); reverses the chore + total stats. */
  deleteLog(hid: string, entry: LogEntry): Promise<void>

  subscribeLogsForWeek(hid: string, weekKey: string, cb: (logs: LogEntry[]) => void): Unsub
  subscribeLogsForMonth(hid: string, monthKey: string, cb: (logs: LogEntry[]) => void): Unsub
  /** One-shot, server-preferred read (falls back to cache offline). Used where
   *  a stale cache-first answer would be wrong, e.g. crowning last week's leader. */
  fetchLogsForWeekOnce(hid: string, weekKey: string): Promise<LogEntry[]>
  subscribeAllTimeTotals(hid: string, cb: (totals: AllTimeTotals) => void): Unsub
  /** All logs for one member (personal history; flat-scale volumes). */
  fetchMemberLogs(hid: string, memberId: string): Promise<LogEntry[]>
}

let instance: Store | null = null

/** Singleton store: Firestore when configured, on-device demo store otherwise. */
export async function getStore(): Promise<Store> {
  if (instance) return instance
  if (firebaseConfig) {
    const { FirestoreStore } = await import('./firestore')
    instance = new FirestoreStore(firebaseConfig)
  } else {
    const { LocalStore } = await import('./local')
    instance = new LocalStore()
  }
  return instance
}
