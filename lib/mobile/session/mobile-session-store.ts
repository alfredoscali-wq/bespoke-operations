/**
 * Mobile Session Store — shared jornada snapshot (Sprint 18 / Bloque E).
 * In-memory only. Cleared on logout. No polling.
 */

export const MOBILE_SESSION_STALE_TIME_MS = 5 * 60_000
export const MOBILE_SESSION_GC_TIME_MS = 30 * 60_000

export type MobileSessionPermissions = {
  readonly systemRole: string | null
  readonly systemAccess: boolean
  readonly modules: readonly string[]
}

export type MobileSessionEmployee = {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly preferredName?: string
  readonly email?: string
  readonly phone?: string
  readonly nationalId?: string
  readonly jobTitle: string
  readonly department: string
  readonly systemRole: string | null
}

export type MobileSessionCrew = {
  readonly id: string
  readonly name: string
}

export type MobileSessionCompany = {
  readonly id: string
}

export type MobileSessionJornada = {
  readonly date: string
  readonly crewId: string | null
  readonly crewName: string
  readonly crewStatus: "loading" | "resolved" | "unassigned" | "multiple"
  readonly assignedCrewNames: readonly string[]
}

/**
 * Day task ids + lightweight refs attached to the jornada session.
 * Full Task objects remain in TasksProvider (mutation policy unchanged).
 */
export type MobileSessionDayTaskRef = {
  readonly id: string
  readonly status: string
  readonly dueDate: string
}

/**
 * Session snapshot — employee, crew, jornada, day tasks, permissions, company.
 */
export type MobileSessionSnapshot = {
  readonly fetchedAt: number
  readonly company: MobileSessionCompany
  readonly employee: MobileSessionEmployee | null
  readonly crews: readonly MobileSessionCrew[]
  readonly jornada: MobileSessionJornada
  readonly dayTasks: readonly MobileSessionDayTaskRef[]
  readonly permissions: MobileSessionPermissions
}

type MobileSessionState = {
  snapshot: MobileSessionSnapshot | null
}

const state: MobileSessionState = {
  snapshot: null,
}

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function getMobileSessionSnapshot(): MobileSessionSnapshot | null {
  return state.snapshot
}

export function isMobileSessionFresh(
  now: number = Date.now(),
  staleTimeMs: number = MOBILE_SESSION_STALE_TIME_MS
): boolean {
  const snapshot = state.snapshot
  if (!snapshot) return false
  return now - snapshot.fetchedAt < staleTimeMs
}

export function setMobileSessionSnapshot(
  snapshot: MobileSessionSnapshot
): void {
  state.snapshot = snapshot
  notify()
}

export function patchMobileSessionSnapshot(
  patch: Partial<Omit<MobileSessionSnapshot, "fetchedAt">> & {
    fetchedAt?: number
  }
): void {
  if (!state.snapshot) return
  state.snapshot = {
    ...state.snapshot,
    ...patch,
    fetchedAt: patch.fetchedAt ?? state.snapshot.fetchedAt,
  }
  notify()
}

/**
 * Invalidates session cache (logout / leave operario).
 */
export function clearMobileSessionStore(): void {
  state.snapshot = null
  notify()
}

export function subscribeMobileSessionStore(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const mobileSessionStore = {
  get: getMobileSessionSnapshot,
  set: setMobileSessionSnapshot,
  patch: patchMobileSessionSnapshot,
  clear: clearMobileSessionStore,
  isFresh: isMobileSessionFresh,
  subscribe: subscribeMobileSessionStore,
  staleTimeMs: MOBILE_SESSION_STALE_TIME_MS,
  gcTimeMs: MOBILE_SESSION_GC_TIME_MS,
} as const
