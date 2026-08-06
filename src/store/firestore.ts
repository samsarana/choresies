import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
} from 'firebase/auth'
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  increment,
  initializeFirestore,
  limit,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { FirebaseConfig } from '../config'
import type { AllTimeTotals, Avatar, HouseholdPublic, LogEntry, Member, Task } from '../lib/types'
import type { LogInput, Store, Unsub } from './store'
import { hashPassword, randomSalt } from '../lib/hash'
import { aliasesFor } from '../lib/aliases'
import { normalize } from '../lib/search'

/**
 * Production store. Design notes:
 * - Anonymous auth: one stable uid per device; membership = a `joins/{uid}`
 *   doc whose creation requires proving the household password hash
 *   (enforced by firestore.rules — the hash itself is never client-readable).
 * - All writes are plain/batch writes with increment() sentinels, NEVER
 *   transactions, so logging works offline and syncs later.
 */
export class FirestoreStore implements Store {
  readonly mode = 'cloud' as const
  private app: FirebaseApp
  private db: Firestore
  private auth: Auth
  private uidPromise: Promise<string> | null = null

  constructor(config: FirebaseConfig) {
    this.app = initializeApp(config)
    this.db = initializeFirestore(this.app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
    this.auth = getAuth(this.app)
  }

  ensureAuth(): Promise<string> {
    if (!this.uidPromise) {
      this.uidPromise = new Promise((resolve, reject) => {
        const stop = onAuthStateChanged(this.auth, (user) => {
          if (user) {
            stop()
            resolve(user.uid)
          } else {
            signInAnonymously(this.auth).catch((e) => {
              stop()
              this.uidPromise = null
              reject(e)
            })
          }
        })
      })
    }
    return this.uidPromise
  }

  private hh(hid: string) {
    return doc(this.db, 'households', hid)
  }

  private pub(id: string, data: Record<string, unknown>): HouseholdPublic {
    return {
      id,
      name: String(data.name ?? ''),
      salt: String(data.salt ?? ''),
      tz: String(data.tz ?? 'UTC'),
      thresholdMinutes: Number(data.thresholdMinutes ?? 75),
      createdAt: Number(data.createdAt ?? 0),
    }
  }

  async findHouseholdByName(name: string): Promise<HouseholdPublic | null> {
    await this.ensureAuth()
    const q = query(
      collection(this.db, 'households'),
      where('nameLower', '==', normalize(name)),
      limit(1),
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return this.pub(d.id, d.data())
  }

  async createHousehold(name: string, password: string, tz: string): Promise<HouseholdPublic> {
    const uid = await this.ensureAuth()
    if (await this.findHouseholdByName(name)) throw new Error('household-exists')
    const salt = randomSalt()
    const passwordHash = await hashPassword(salt, password)
    const ref = doc(collection(this.db, 'households'))
    const createdAt = Date.now()
    const batch = writeBatch(this.db)
    batch.set(ref, {
      name: name.trim(),
      nameLower: normalize(name),
      salt,
      tz,
      thresholdMinutes: 75,
      createdBy: uid,
      createdAt,
    })
    batch.set(doc(ref, 'private', 'auth'), { passwordHash })
    batch.set(doc(ref, 'joins', uid), { proof: passwordHash, at: Date.now() })
    // NB: no stats seed here — rules gate stats on joined(), which reads
    // PRE-batch state and would reject the whole creation batch. logChore's
    // merge-set creates the doc lazily instead.
    await batch.commit()
    return { id: ref.id, name: name.trim(), salt, tz, thresholdMinutes: 75, createdAt }
  }

  async joinHousehold(household: HouseholdPublic, password: string): Promise<boolean> {
    await this.ensureAuth()
    // Already joined on this device (join docs are immutable — a re-set would
    // be denied and misread as a wrong password). Device is trusted per §2.
    if (await this.hasJoined(household.id)) return true
    const uid = await this.ensureAuth()
    const proof = await hashPassword(household.salt, password)
    try {
      await setDoc(doc(this.hh(household.id), 'joins', uid), { proof, at: Date.now() })
      return true
    } catch (e) {
      if ((e as { code?: string }).code === 'permission-denied') return false
      throw e
    }
  }

  async hasJoined(householdId: string): Promise<boolean> {
    const uid = await this.ensureAuth()
    try {
      const snap = await getDoc(doc(this.hh(householdId), 'joins', uid))
      return snap.exists()
    } catch {
      return false
    }
  }

  private onSnapErr(where: string) {
    return (e: unknown) => console.error(`[choresies] ${where} listener error`, e)
  }

  subscribeHousehold(hid: string, cb: (h: HouseholdPublic | null) => void): Unsub {
    return onSnapshot(
      this.hh(hid),
      (snap) => {
        cb(snap.exists() ? this.pub(snap.id, snap.data()) : null)
      },
      this.onSnapErr('household'),
    )
  }

  async updateHousehold(hid: string, patch: { thresholdMinutes?: number }): Promise<void> {
    const clean: Record<string, unknown> = {}
    if (patch.thresholdMinutes !== undefined) clean.thresholdMinutes = patch.thresholdMinutes
    if (Object.keys(clean).length) await updateDoc(this.hh(hid), clean)
  }

  subscribeMembers(hid: string, cb: (members: Member[]) => void): Unsub {
    return onSnapshot(collection(this.hh(hid), 'members'), (snap) => {
      const members = snap.docs
        .map((d) => {
          const m = d.data()
          return {
            id: d.id,
            name: String(m.name ?? ''),
            avatar: (m.avatar ?? { kind: 'emoji', value: '🙂', color: 0 }) as Avatar,
            createdAt: Number(m.createdAt ?? 0),
          }
        })
        .sort((a, z) => a.createdAt - z.createdAt)
      cb(members)
    }, this.onSnapErr('members'))
  }

  async createMember(hid: string, input: { name: string; avatar: Avatar }): Promise<string> {
    const uid = await this.ensureAuth()
    const ref = doc(collection(this.hh(hid), 'members'))
    await setDoc(ref, {
      name: input.name.trim(),
      avatar: input.avatar,
      createdAt: Date.now(),
      deviceUids: [uid],
    })
    return ref.id
  }

  async updateMember(hid: string, mid: string, patch: { name?: string; avatar?: Avatar }): Promise<void> {
    const clean: Record<string, unknown> = {}
    if (patch.name !== undefined) clean.name = patch.name.trim()
    if (patch.avatar !== undefined) clean.avatar = patch.avatar
    await updateDoc(doc(this.hh(hid), 'members', mid), clean)
  }

  async claimMember(hid: string, mid: string): Promise<void> {
    const uid = await this.ensureAuth()
    // arrayUnion: atomic and offline-queueable, unlike read-modify-write.
    await updateDoc(doc(this.hh(hid), 'members', mid), { deviceUids: arrayUnion(uid) })
  }

  async deleteMember(hid: string, mid: string): Promise<void> {
    await this.ensureAuth()
    await deleteDoc(doc(this.hh(hid), 'members', mid))
  }

  subscribeTasks(hid: string, cb: (tasks: Task[]) => void): Unsub {
    return onSnapshot(collection(this.hh(hid), 'tasks'), (snap) => {
      cb(
        snap.docs.map((d) => {
          const t = d.data()
          return {
            id: d.id,
            name: String(t.name ?? ''),
            nameLower: String(t.nameLower ?? ''),
            aliases: (t.aliases as string[] | undefined) ?? [],
            logCount: Number(t.logCount ?? 0),
            totalMinutes: Number(t.totalMinutes ?? 0),
            lastLoggedAt: Number(t.lastLoggedAt ?? 0),
          }
        }),
      )
    }, this.onSnapErr('tasks'))
  }

  async logChore(hid: string, input: LogInput): Promise<{ logId: string; taskId: string }> {
    await this.ensureAuth()
    const name = (input.name ?? '').trim()
    if (!name) throw new Error('missing-name')
    // New chores must be searchable — reject names that normalise to nothing.
    if (!input.taskId && !normalize(name)) throw new Error('missing-name')
    const now = Date.now()
    const batch = writeBatch(this.db)

    let taskId = input.taskId
    const taskName = name
    if (taskId) {
      batch.update(doc(this.hh(hid), 'tasks', taskId), {
        logCount: increment(1),
        totalMinutes: increment(input.minutes),
        lastLoggedAt: now,
      })
    } else {
      const taskRef = doc(collection(this.hh(hid), 'tasks'))
      taskId = taskRef.id
      batch.set(taskRef, {
        name,
        nameLower: normalize(name),
        aliases: aliasesFor(name),
        logCount: 1,
        totalMinutes: input.minutes,
        lastLoggedAt: now,
      })
    }

    const logRef = doc(collection(this.hh(hid), 'logs'))
    batch.set(logRef, {
      taskId,
      taskName,
      memberId: input.memberId,
      memberName: input.memberName,
      minutes: input.minutes,
      at: now,
      weekKey: input.weekKey,
      monthKey: input.monthKey,
    })

    batch.set(
      doc(this.hh(hid), 'stats', 'allTime'),
      {
        totals: {
          [input.memberId]: { minutes: increment(input.minutes), logs: increment(1) },
        },
      },
      { merge: true },
    )

    await batch.commit()
    return { logId: logRef.id, taskId }
  }

  async deleteLog(hid: string, entry: LogEntry): Promise<void> {
    // Idempotence: undo + manual delete of the same log must not decrement
    // the chore/all-time stats twice.
    const logRef = doc(this.hh(hid), 'logs', entry.id)
    const existing = await getDoc(logRef)
    if (!existing.exists()) return
    const batch = writeBatch(this.db)
    batch.delete(logRef)
    batch.update(doc(this.hh(hid), 'tasks', entry.taskId), {
      logCount: increment(-1),
      totalMinutes: increment(-entry.minutes),
    })
    batch.set(
      doc(this.hh(hid), 'stats', 'allTime'),
      {
        totals: {
          [entry.memberId]: { minutes: increment(-entry.minutes), logs: increment(-1) },
        },
      },
      { merge: true },
    )
    await batch.commit()
  }

  private mapLog(id: string, l: Record<string, unknown>): LogEntry {
    return {
      id,
      taskId: String(l.taskId ?? ''),
      taskName: String(l.taskName ?? ''),
      memberId: String(l.memberId ?? ''),
      memberName: String(l.memberName ?? ''),
      minutes: Number(l.minutes ?? 0),
      at: Number(l.at ?? 0),
      weekKey: String(l.weekKey ?? ''),
      monthKey: String(l.monthKey ?? ''),
    }
  }

  subscribeLogsForWeek(hid: string, weekKey: string, cb: (logs: LogEntry[]) => void): Unsub {
    const q = query(collection(this.hh(hid), 'logs'), where('weekKey', '==', weekKey))
    return onSnapshot(
      q,
      (snap) => {
        cb(snap.docs.map((d) => this.mapLog(d.id, d.data())).sort((a, z) => z.at - a.at))
      },
      this.onSnapErr('week-logs'),
    )
  }

  subscribeLogsForMonth(hid: string, monthKey: string, cb: (logs: LogEntry[]) => void): Unsub {
    const q = query(collection(this.hh(hid), 'logs'), where('monthKey', '==', monthKey))
    return onSnapshot(
      q,
      (snap) => {
        cb(snap.docs.map((d) => this.mapLog(d.id, d.data())))
      },
      this.onSnapErr('month-logs'),
    )
  }

  async fetchLogsForWeekOnce(hid: string, weekKey: string): Promise<LogEntry[]> {
    const q = query(collection(this.hh(hid), 'logs'), where('weekKey', '==', weekKey))
    // Cache-first snapshots can be empty/stale right after startup — prefer the
    // server so we don't crown the wrong flatmate; fall back to cache offline.
    let snap
    try {
      snap = await getDocsFromServer(q)
    } catch {
      snap = await getDocs(q)
    }
    return snap.docs.map((d) => this.mapLog(d.id, d.data()))
  }

  subscribeAllTimeTotals(hid: string, cb: (totals: AllTimeTotals) => void): Unsub {
    return onSnapshot(
      doc(this.hh(hid), 'stats', 'allTime'),
      (snap) => {
        cb((snap.data()?.totals as AllTimeTotals | undefined) ?? {})
      },
      this.onSnapErr('all-time'),
    )
  }

  async fetchMemberLogs(hid: string, memberId: string): Promise<LogEntry[]> {
    const q = query(collection(this.hh(hid), 'logs'), where('memberId', '==', memberId))
    const snap = await getDocs(q)
    return snap.docs.map((d) => this.mapLog(d.id, d.data())).sort((a, z) => z.at - a.at)
  }
}
