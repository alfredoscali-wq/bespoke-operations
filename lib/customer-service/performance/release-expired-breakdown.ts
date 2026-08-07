/**
 * Sprint 31.0 — release-expired-managements breakdown (dev-only).
 * No behavior changes — instrumentation only.
 */

import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"

import { isCustomerServicePerfEnabled } from "@/lib/customer-service/performance/enabled"

export type ReleaseExpiredTimers = {
  sessionUserMs: number | null
  employeeMs: number | null
  roleMs: number | null
  companyMs: number | null
  rpcMs: number | null
  parseMs: number | null
}

type ReleaseExpiredQueryMeta = {
  durationMs: number
  count: number
  cachedCount: number
}

type ReleaseExpiredSession = {
  startedAt: number
  timers: ReleaseExpiredTimers
  queries: Map<string, ReleaseExpiredQueryMeta>
  calls: Map<string, number>
}

const storage = new AsyncLocalStorage<ReleaseExpiredSession>()

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function padLabel(label: string, width = 22): string {
  return label.padEnd(width, ".")
}

function formatMs(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${Math.round(value)} ms`
}

function emptyTimers(): ReleaseExpiredTimers {
  return {
    sessionUserMs: null,
    employeeMs: null,
    roleMs: null,
    companyMs: null,
    rpcMs: null,
    parseMs: null,
  }
}

export function getReleaseExpiredStore(): ReleaseExpiredSession | null {
  if (!isCustomerServicePerfEnabled()) return null
  return storage.getStore() ?? null
}

export function isReleaseExpiredPerfActive(): boolean {
  return getReleaseExpiredStore() != null
}

export async function runWithReleaseExpiredPerf<T>(
  run: () => Promise<T>
): Promise<T> {
  if (!isCustomerServicePerfEnabled()) {
    return run()
  }

  const session: ReleaseExpiredSession = {
    startedAt: nowMs(),
    timers: emptyTimers(),
    queries: new Map(),
    calls: new Map(),
  }

  try {
    return await storage.run(session, run)
  } finally {
    finishReleaseExpiredPerf(session)
  }
}

export function recordReleaseExpiredCall(name: string): void {
  const session = getReleaseExpiredStore()
  if (!session) return
  session.calls.set(name, (session.calls.get(name) ?? 0) + 1)
}

export function recordReleaseExpiredQuery(
  name: string,
  durationMs: number,
  options?: { cached?: boolean }
): void {
  const session = getReleaseExpiredStore()
  if (!session) return
  const prior = session.queries.get(name) ?? {
    durationMs: 0,
    count: 0,
    cachedCount: 0,
  }
  session.queries.set(name, {
    durationMs: prior.durationMs + Math.max(0, durationMs),
    count: prior.count + 1,
    cachedCount: prior.cachedCount + (options?.cached ? 1 : 0),
  })
}

export function addReleaseExpiredTimer(
  key: keyof ReleaseExpiredTimers,
  durationMs: number
): void {
  const session = getReleaseExpiredStore()
  if (!session) return
  const current = session.timers[key]
  session.timers[key] =
    current == null ? Math.max(0, durationMs) : current + Math.max(0, durationMs)
}

export async function measureReleaseExpiredPhase<T>(
  key: keyof ReleaseExpiredTimers,
  run: () => Promise<T>
): Promise<T> {
  if (!getReleaseExpiredStore()) {
    return run()
  }
  const started = nowMs()
  try {
    return await run()
  } finally {
    addReleaseExpiredTimer(key, nowMs() - started)
  }
}

function finishReleaseExpiredPerf(session: ReleaseExpiredSession): void {
  if (!isCustomerServicePerfEnabled()) return

  const t = session.timers
  const totalMs = nowMs() - session.startedAt
  const queryRows = [...session.queries.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  const totalDb = queryRows.reduce((sum, [, meta]) => sum + meta.durationMs, 0)
  const dupes = [...session.calls.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => a[0].localeCompare(b[0]))

  console.info(
    [
      "[ATC RELEASE EXPIRED]",
      "",
      `${padLabel("Session User")} ${formatMs(t.sessionUserMs)}`,
      `${padLabel("Employee")} ${formatMs(t.employeeMs)}`,
      `${padLabel("Role")} ${formatMs(t.roleMs)}`,
      `${padLabel("Company")} ${formatMs(t.companyMs)}`,
      `${padLabel("RPC")} ${formatMs(t.rpcMs)}`,
      `${padLabel("Parse")} ${formatMs(t.parseMs)}`,
      "",
      `${padLabel("TOTAL")} ${formatMs(totalMs)}`,
    ].join("\n")
  )

  console.info(
    [
      "[ATC RELEASE EXPIRED QUERY]",
      "",
      ...(queryRows.length === 0
        ? ["(none)"]
        : queryRows.map(([name, meta]) => {
            const cacheSuffix =
              meta.cachedCount > 0 && meta.cachedCount === meta.count
                ? " (cache)"
                : meta.cachedCount > 0
                  ? ` (cache ${meta.cachedCount}/${meta.count})`
                  : ""
            return (
              `${padLabel(name)} ${Math.round(meta.durationMs)} ms` +
              (meta.count > 1 ? ` (${meta.count}x)` : "") +
              cacheSuffix
            )
          })),
      "",
      `${padLabel("TOTAL DB")} ${formatMs(totalDb || null)}`,
    ].join("\n")
  )

  console.info(
    dupes.length === 0
      ? ["[ATC RELEASE EXPIRED DUPLICATE]", "", "(none)"].join("\n")
      : [
          "[ATC RELEASE EXPIRED DUPLICATE]",
          "",
          ...dupes.map(
            ([name, count]) => `${padLabel(name)} ${count} veces`
          ),
        ].join("\n")
  )
}

export function resetReleaseExpiredPerfForTests(): void {
  // ALS sessions are request-scoped; nothing global to clear.
}
