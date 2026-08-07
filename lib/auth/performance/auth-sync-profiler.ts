/**
 * Sprint 29.0 — AUTH SYNC breakdown for /api/auth/sync-my-metadata (dev-only).
 * Uses AsyncLocalStorage so concurrent Node requests stay isolated.
 */

import { AsyncLocalStorage } from "node:async_hooks"

import {
  formatMs,
  isAuthPerfEnabled,
  nowMs,
  padLabel,
} from "@/lib/auth/performance/enabled"

export type AuthSyncTimers = {
  userMs: number | null
  employeeMs: number | null
  roleMs: number | null
  metadataUpdateMs: number | null
}

export type AuthSyncQueryMetric = {
  name: string
  durationMs: number
  count: number
}

type AuthSyncSession = {
  startedAt: number
  timers: AuthSyncTimers
  queries: Map<string, { durationMs: number; count: number }>
  calls: Map<string, number>
}

const authSyncStorage = new AsyncLocalStorage<AuthSyncSession>()

function emptyTimers(): AuthSyncTimers {
  return {
    userMs: null,
    employeeMs: null,
    roleMs: null,
    metadataUpdateMs: null,
  }
}

export function isAuthSyncPerfActive(): boolean {
  return isAuthPerfEnabled() && authSyncStorage.getStore() != null
}

export function getAuthSyncStore(): AuthSyncSession | null {
  if (!isAuthPerfEnabled()) return null
  return authSyncStorage.getStore() ?? null
}

export async function runWithAuthSyncPerf<T>(run: () => Promise<T>): Promise<T> {
  if (!isAuthPerfEnabled()) {
    return run()
  }

  const session: AuthSyncSession = {
    startedAt: nowMs(),
    timers: emptyTimers(),
    queries: new Map(),
    calls: new Map(),
  }

  try {
    return await authSyncStorage.run(session, run)
  } finally {
    finishAuthSyncPerf(session)
  }
}

export function recordAuthSyncCall(name: string): void {
  const session = getAuthSyncStore()
  if (!session) return
  session.calls.set(name, (session.calls.get(name) ?? 0) + 1)
}

export function recordAuthSyncQuery(name: string, durationMs: number): void {
  const session = getAuthSyncStore()
  if (!session) return
  const prior = session.queries.get(name) ?? { durationMs: 0, count: 0 }
  session.queries.set(name, {
    durationMs: prior.durationMs + Math.max(0, durationMs),
    count: prior.count + 1,
  })
}

export function addAuthSyncTimer(
  key: keyof AuthSyncTimers,
  durationMs: number
): void {
  const session = getAuthSyncStore()
  if (!session) return
  const current = session.timers[key]
  session.timers[key] =
    current == null ? Math.max(0, durationMs) : current + Math.max(0, durationMs)
}

export async function measureAuthSyncPhase<T>(
  key: keyof AuthSyncTimers,
  run: () => Promise<T>
): Promise<T> {
  if (!getAuthSyncStore()) {
    return run()
  }
  const started = nowMs()
  try {
    return await run()
  } finally {
    addAuthSyncTimer(key, nowMs() - started)
  }
}

function finishAuthSyncPerf(session: AuthSyncSession): void {
  if (!isAuthPerfEnabled()) return

  const t = session.timers
  const totalMs = nowMs() - session.startedAt
  const queryRows = [...session.queries.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  const dupes = [...session.calls.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => a[0].localeCompare(b[0]))

  console.info(
    [
      "[AUTH SYNC]",
      "",
      `${padLabel("User")} ${formatMs(t.userMs)}`,
      `${padLabel("Employee")} ${formatMs(t.employeeMs)}`,
      `${padLabel("Role")} ${formatMs(t.roleMs)}`,
      `${padLabel("Metadata Update")} ${formatMs(t.metadataUpdateMs)}`,
      "",
      `${padLabel("TOTAL")} ${formatMs(totalMs)}`,
    ].join("\n")
  )

  if (queryRows.length > 0) {
    console.info(
      [
        "[AUTH SYNC QUERY]",
        "",
        ...queryRows.map(
          ([name, meta]) =>
            `${padLabel(name)} ${Math.round(meta.durationMs)} ms` +
            (meta.count > 1 ? ` (${meta.count}x)` : "")
        ),
      ].join("\n")
    )
  }

  if (dupes.length > 0) {
    console.info(
      [
        "[AUTH SYNC DUPLICATE]",
        "",
        ...dupes.map(([name, count]) => `${padLabel(name)} ${count} veces`),
      ].join("\n")
    )
  }
}
