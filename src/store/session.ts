/** Device memory: which household + profile this phone belongs to. */

export interface DeviceSession {
  householdId: string | null
  memberId: string | null
}

const KEY = 'choresies:session:v1'

export function loadSession(): DeviceSession {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as DeviceSession
      return { householdId: s.householdId ?? null, memberId: s.memberId ?? null }
    }
  } catch {
    /* corrupted storage → fresh session */
  }
  return { householdId: null, memberId: null }
}

export function saveSession(s: DeviceSession): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearSession(): void {
  localStorage.removeItem(KEY)
}

/** Last week-key this device has seen, per household — drives the new-week celebration. */
export function getLastSeenWeek(hid: string): string | null {
  return localStorage.getItem(`choresies:lastweek:${hid}`)
}

export function setLastSeenWeek(hid: string, weekKey: string): void {
  localStorage.setItem(`choresies:lastweek:${hid}`, weekKey)
}
