import type { AllTimeTotals, Avatar, HouseholdPublic, LogEntry, Member, Task } from '../lib/types'
import type { LogInput, Store, Unsub } from './store'
import { hashPassword, randomId, randomSalt } from '../lib/hash'
import { aliasesFor } from '../lib/aliases'
import { normalize } from '../lib/search'

/**
 * Demo-mode store: same contract as FirestoreStore, backed by localStorage.
 * Cross-tab updates propagate via the `storage` event, so two open tabs even
 * behave like two devices on the realtime backend.
 */

interface HouseholdBlob {
  doc: {
    name: string
    nameLower: string
    salt: string
    tz: string
    thresholdMinutes: number
    passwordHash: string
    createdAt: number
  }
  members: Record<string, Omit<Member, 'id'> & { deviceUids: string[] }>
  tasks: Record<string, Omit<Task, 'id'>>
  logs: Record<string, Omit<LogEntry, 'id'>>
  joins: Record<string, true>
  allTime: AllTimeTotals
}

interface Db {
  households: Record<string, HouseholdBlob>
}

const DB_KEY = 'choresies:localdb:v1'
const UID_KEY = 'choresies:deviceid:v1'

export class LocalStore implements Store {
  readonly mode = 'demo' as const
  private listeners = new Set<() => void>()

  constructor() {
    window.addEventListener('storage', (e) => {
      if (e.key === DB_KEY) this.emit()
    })
  }

  private read(): Db {
    try {
      const raw = localStorage.getItem(DB_KEY)
      if (raw) return JSON.parse(raw) as Db
    } catch {
      /* corrupted → start fresh */
    }
    return { households: {} }
  }

  private write(db: Db): void {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
    this.emit()
  }

  private emit(): void {
    for (const l of [...this.listeners]) l()
  }

  private onChange(fire: () => void): Unsub {
    fire()
    const l = () => fire()
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  async ensureAuth(): Promise<string> {
    let uid = localStorage.getItem(UID_KEY)
    if (!uid) {
      uid = randomId()
      localStorage.setItem(UID_KEY, uid)
    }
    return uid
  }

  private pub(id: string, b: HouseholdBlob): HouseholdPublic {
    return {
      id,
      name: b.doc.name,
      salt: b.doc.salt,
      tz: b.doc.tz,
      thresholdMinutes: b.doc.thresholdMinutes,
      createdAt: b.doc.createdAt,
    }
  }

  async findHouseholdByName(name: string): Promise<HouseholdPublic | null> {
    const db = this.read()
    const lower = normalize(name)
    for (const [id, b] of Object.entries(db.households)) {
      if (b.doc.nameLower === lower) return this.pub(id, b)
    }
    return null
  }

  async createHousehold(name: string, password: string, tz: string): Promise<HouseholdPublic> {
    const db = this.read()
    const lower = normalize(name)
    for (const b of Object.values(db.households)) {
      if (b.doc.nameLower === lower) throw new Error('household-exists')
    }
    const salt = randomSalt()
    const id = randomId()
    const uid = await this.ensureAuth()
    db.households[id] = {
      doc: {
        name: name.trim(),
        nameLower: lower,
        salt,
        tz,
        thresholdMinutes: 75,
        passwordHash: await hashPassword(salt, password),
        createdAt: Date.now(),
      },
      members: {},
      tasks: {},
      logs: {},
      joins: { [uid]: true },
      allTime: {},
    }
    this.write(db)
    return this.pub(id, db.households[id])
  }

  async joinHousehold(household: HouseholdPublic, password: string): Promise<boolean> {
    const db = this.read()
    const b = db.households[household.id]
    if (!b) return false
    // Same contract as FirestoreStore: an already-joined device is let back in.
    if (b.joins[await this.ensureAuth()]) return true
    const attempt = await hashPassword(b.doc.salt, password)
    if (attempt !== b.doc.passwordHash) return false
    b.joins[await this.ensureAuth()] = true
    this.write(db)
    return true
  }

  async hasJoined(householdId: string): Promise<boolean> {
    const b = this.read().households[householdId]
    return !!b && !!b.joins[await this.ensureAuth()]
  }

  subscribeHousehold(hid: string, cb: (h: HouseholdPublic | null) => void): Unsub {
    return this.onChange(() => {
      const b = this.read().households[hid]
      cb(b ? this.pub(hid, b) : null)
    })
  }

  async updateHousehold(hid: string, patch: { thresholdMinutes?: number }): Promise<void> {
    const db = this.read()
    const b = db.households[hid]
    if (!b) throw new Error('not-found')
    if (patch.thresholdMinutes !== undefined) b.doc.thresholdMinutes = patch.thresholdMinutes
    this.write(db)
  }

  subscribeMembers(hid: string, cb: (members: Member[]) => void): Unsub {
    return this.onChange(() => {
      const b = this.read().households[hid]
      cb(
        b
          ? Object.entries(b.members)
              .map(([id, m]) => ({ id, name: m.name, avatar: m.avatar, createdAt: m.createdAt }))
              .sort((a, z) => a.createdAt - z.createdAt)
          : [],
      )
    })
  }

  async createMember(hid: string, input: { name: string; avatar: Avatar }): Promise<string> {
    const db = this.read()
    const b = db.households[hid]
    if (!b) throw new Error('not-found')
    const id = randomId()
    b.members[id] = {
      name: input.name.trim(),
      avatar: input.avatar,
      createdAt: Date.now(),
      deviceUids: [await this.ensureAuth()],
    }
    this.write(db)
    return id
  }

  async updateMember(hid: string, mid: string, patch: { name?: string; avatar?: Avatar }): Promise<void> {
    const db = this.read()
    const m = db.households[hid]?.members[mid]
    if (!m) throw new Error('not-found')
    if (patch.name !== undefined) m.name = patch.name.trim()
    if (patch.avatar !== undefined) m.avatar = patch.avatar
    this.write(db)
  }

  async claimMember(hid: string, mid: string): Promise<void> {
    const db = this.read()
    const m = db.households[hid]?.members[mid]
    if (!m) throw new Error('not-found')
    const uid = await this.ensureAuth()
    if (!m.deviceUids.includes(uid)) m.deviceUids.push(uid)
    this.write(db)
  }

  async deleteMember(hid: string, mid: string): Promise<void> {
    const db = this.read()
    const m = db.households[hid]?.members[mid]
    if (!m) return
    const uid = await this.ensureAuth()
    if (!m.deviceUids.includes(uid)) throw new Error('not-yours')
    delete db.households[hid].members[mid]
    this.write(db)
  }

  subscribeTasks(hid: string, cb: (tasks: Task[]) => void): Unsub {
    return this.onChange(() => {
      const b = this.read().households[hid]
      cb(b ? Object.entries(b.tasks).map(([id, t]) => ({ id, ...t })) : [])
    })
  }

  async logChore(hid: string, input: LogInput): Promise<{ logId: string; taskId: string }> {
    const db = this.read()
    const b = db.households[hid]
    if (!b) throw new Error('not-found')

    const name = (input.name ?? '').trim()
    if (!name) throw new Error('missing-name')
    if (!input.taskId && !normalize(name)) throw new Error('missing-name')
    let taskId = input.taskId
    const taskName = name // same denormalisation contract as FirestoreStore
    if (taskId && b.tasks[taskId]) {
      const t = b.tasks[taskId]
      t.logCount += 1
      t.totalMinutes += input.minutes
      t.lastLoggedAt = Date.now()
    } else {
      taskId = randomId()
      b.tasks[taskId] = {
        name,
        nameLower: normalize(name),
        aliases: aliasesFor(name),
        logCount: 1,
        totalMinutes: input.minutes,
        lastLoggedAt: Date.now(),
      }
    }

    const logId = randomId()
    b.logs[logId] = {
      taskId,
      taskName,
      memberId: input.memberId,
      memberName: input.memberName,
      minutes: input.minutes,
      at: Date.now(),
      weekKey: input.weekKey,
      monthKey: input.monthKey,
    }

    const tot = (b.allTime[input.memberId] ??= { minutes: 0, logs: 0 })
    tot.minutes += input.minutes
    tot.logs += 1

    this.write(db)
    return { logId, taskId }
  }

  async deleteLog(hid: string, entry: LogEntry): Promise<void> {
    const db = this.read()
    const b = db.households[hid]
    if (!b || !b.logs[entry.id]) return
    const stored = b.logs[entry.id]
    delete b.logs[entry.id]

    const t = b.tasks[stored.taskId]
    if (t) {
      t.logCount = Math.max(0, t.logCount - 1)
      t.totalMinutes = Math.max(0, t.totalMinutes - stored.minutes)
    }
    const tot = b.allTime[stored.memberId]
    if (tot) {
      tot.minutes = Math.max(0, tot.minutes - stored.minutes)
      tot.logs = Math.max(0, tot.logs - 1)
    }
    this.write(db)
  }

  subscribeLogsForWeek(hid: string, weekKey: string, cb: (logs: LogEntry[]) => void): Unsub {
    return this.onChange(() => {
      const b = this.read().households[hid]
      cb(
        b
          ? Object.entries(b.logs)
              .filter(([, l]) => l.weekKey === weekKey)
              .map(([id, l]) => ({ id, ...l }))
              .sort((a, z) => z.at - a.at)
          : [],
      )
    })
  }

  subscribeLogsForMonth(hid: string, monthKey: string, cb: (logs: LogEntry[]) => void): Unsub {
    return this.onChange(() => {
      const b = this.read().households[hid]
      cb(
        b
          ? Object.entries(b.logs)
              .filter(([, l]) => l.monthKey === monthKey)
              .map(([id, l]) => ({ id, ...l }))
          : [],
      )
    })
  }

  async fetchLogsForWeekOnce(hid: string, weekKey: string): Promise<LogEntry[]> {
    const b = this.read().households[hid]
    if (!b) return []
    return Object.entries(b.logs)
      .filter(([, l]) => l.weekKey === weekKey)
      .map(([id, l]) => ({ id, ...l }))
  }

  subscribeAllTimeTotals(hid: string, cb: (totals: AllTimeTotals) => void): Unsub {
    return this.onChange(() => {
      const b = this.read().households[hid]
      cb(b ? structuredClone(b.allTime) : {})
    })
  }

  async fetchMemberLogs(hid: string, memberId: string): Promise<LogEntry[]> {
    const b = this.read().households[hid]
    if (!b) return []
    return Object.entries(b.logs)
      .filter(([, l]) => l.memberId === memberId)
      .map(([id, l]) => ({ id, ...l }))
      .sort((a, z) => z.at - a.at)
  }
}
