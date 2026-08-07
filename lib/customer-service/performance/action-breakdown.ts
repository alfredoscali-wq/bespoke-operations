/**
 * Sprint 37.0 — ATC action endpoint breakdown (dev-only).
 * Measures start-management / touch-management / defer / resolve.
 * No behavior changes — instrumentation only.
 */

import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"

import { isCustomerServicePerfEnabled } from "@/lib/customer-service/performance/enabled"

export type AtcActionName =
  | "start-management"
  | "touch-management"
  | "defer"
  | "resolve"

export type AtcActionTimers = {
  authMs: number | null
  rpcMs: number | null
  latestEventMs: number | null
  transformMs: number | null
  revalidateMs: number | null
  responseBuildMs: number | null
}

type AtcActionQueryMeta = {
  durationMs: number
  count: number
  cachedCount: number
}

type AtcActionSession = {
  action: AtcActionName
  startedAt: number
  timers: AtcActionTimers
  queries: Map<string, AtcActionQueryMeta>
  calls: Map<string, number>
}

const storage = new AsyncLocalStorage<AtcActionSession>()

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

function emptyTimers(): AtcActionTimers {
  return {
    authMs: null,
    rpcMs: null,
    latestEventMs: null,
    transformMs: null,
    revalidateMs: null,
    responseBuildMs: null,
  }
}

export function getAtcActionStore(): AtcActionSession | null {
  if (!isCustomerServicePerfEnabled()) return null
  return storage.getStore() ?? null
}

export function isAtcActionPerfActive(): boolean {
  return getAtcActionStore() != null
}

export async function runWithAtcActionPerf<T>(
  action: AtcActionName,
  run: () => Promise<T>
): Promise<T> {
  if (!isCustomerServicePerfEnabled()) {
    return run()
  }

  const session: AtcActionSession = {
    action,
    startedAt: nowMs(),
    timers: emptyTimers(),
    queries: new Map(),
    calls: new Map(),
  }

  try {
    return await storage.run(session, run)
  } finally {
    finishAtcActionPerf(session)
  }
}

export function recordAtcActionCall(name: string): void {
  const session = getAtcActionStore()
  if (!session) return
  session.calls.set(name, (session.calls.get(name) ?? 0) + 1)
}

export function recordAtcActionQuery(
  name: string,
  durationMs: number,
  options?: { cached?: boolean }
): void {
  const session = getAtcActionStore()
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

export function addAtcActionTimer(
  key: keyof AtcActionTimers,
  durationMs: number
): void {
  const session = getAtcActionStore()
  if (!session) return
  const current = session.timers[key]
  session.timers[key] =
    current == null ? Math.max(0, durationMs) : current + Math.max(0, durationMs)
}

export async function measureAtcActionPhase<T>(
  key: keyof AtcActionTimers,
  run: () => Promise<T>
): Promise<T> {
  if (!getAtcActionStore()) {
    return run()
  }
  const started = nowMs()
  try {
    return await run()
  } finally {
    addAtcActionTimer(key, nowMs() - started)
  }
}

function finishAtcActionPerf(session: AtcActionSession): void {
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
      "[ATC ACTION]",
      `${padLabel("Action")} ${session.action}`,
      "",
      `${padLabel("Auth")} ${formatMs(t.authMs)}`,
      `${padLabel("RPC")} ${formatMs(t.rpcMs)}`,
      `${padLabel("Latest Event")} ${formatMs(t.latestEventMs)}`,
      `${padLabel("Transform")} ${formatMs(t.transformMs)}`,
      `${padLabel("Revalidate")} ${formatMs(t.revalidateMs)}`,
      `${padLabel("Response Build")} ${formatMs(t.responseBuildMs)}`,
      "",
      `${padLabel("TOTAL")} ${formatMs(totalMs)}`,
    ].join("\n")
  )

  console.info(
    [
      "[ATC ACTION QUERY]",
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
      ? ["[ATC ACTION DUPLICATE]", "", "(none)"].join("\n")
      : [
          "[ATC ACTION DUPLICATE]",
          "",
          ...dupes.map(([name, count]) => `${padLabel(name)} ${count} veces`),
        ].join("\n")
  )
}

export function resetAtcActionPerfForTests(): void {
  // ALS sessions are request-scoped; nothing global to clear.
}
