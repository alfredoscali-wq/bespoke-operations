/**
 * Sprint 29.0 — middleware / proxy.ts request breakdown (dev-only).
 * Edge-safe: all state is local to the request handler.
 */

import {
  formatMs,
  isAuthPerfEnabled,
  nowMs,
  padLabel,
} from "@/lib/auth/performance/enabled"

export type ProxyBreakdownTimers = {
  createClientMs: number | null
  getUserMs: number | null
  getSessionMs: number | null
  loadMetadataMs: number | null
  loadEmployeeMs: number | null
  loadPermissionsMs: number | null
  jwtValidationMs: number | null
  redirectLogicMs: number | null
}

export type ProxyQueryMetric = {
  name: string
  durationMs: number
  count: number
}

export type ProxyDuplicateMetric = {
  name: string
  count: number
}

export type ProxyPerfSession = {
  method: string
  pathname: string
  startedAt: number
  timers: ProxyBreakdownTimers
  queries: Map<string, { durationMs: number; count: number }>
  calls: Map<string, number>
}

function emptyTimers(): ProxyBreakdownTimers {
  return {
    createClientMs: null,
    getUserMs: null,
    getSessionMs: null,
    loadMetadataMs: null,
    loadEmployeeMs: null,
    loadPermissionsMs: null,
    jwtValidationMs: null,
    redirectLogicMs: null,
  }
}

export function beginProxyPerfSession(
  method: string,
  pathname: string
): ProxyPerfSession | null {
  if (!isAuthPerfEnabled()) return null
  return {
    method,
    pathname,
    startedAt: nowMs(),
    timers: emptyTimers(),
    queries: new Map(),
    calls: new Map(),
  }
}

export function recordProxyCall(
  session: ProxyPerfSession | null,
  name: string
): void {
  if (!session) return
  session.calls.set(name, (session.calls.get(name) ?? 0) + 1)
}

export function recordProxyQuery(
  session: ProxyPerfSession | null,
  name: string,
  durationMs: number
): void {
  if (!session) return
  const prior = session.queries.get(name) ?? { durationMs: 0, count: 0 }
  session.queries.set(name, {
    durationMs: prior.durationMs + Math.max(0, durationMs),
    count: prior.count + 1,
  })
}

export function setProxyTimer(
  session: ProxyPerfSession | null,
  key: keyof ProxyBreakdownTimers,
  durationMs: number
): void {
  if (!session) return
  const current = session.timers[key]
  session.timers[key] =
    current == null ? Math.max(0, durationMs) : current + Math.max(0, durationMs)
}

export function measureProxySync<T>(
  session: ProxyPerfSession | null,
  key: keyof ProxyBreakdownTimers,
  run: () => T
): T {
  if (!session) return run()
  const started = nowMs()
  try {
    return run()
  } finally {
    setProxyTimer(session, key, nowMs() - started)
  }
}

export async function measureProxyAsync<T>(
  session: ProxyPerfSession | null,
  key: keyof ProxyBreakdownTimers,
  run: () => Promise<T>
): Promise<T> {
  if (!session) return run()
  const started = nowMs()
  try {
    return await run()
  } finally {
    setProxyTimer(session, key, nowMs() - started)
  }
}

function logProxyBreakdown(
  session: ProxyPerfSession,
  totalMs: number
): void {
  const t = session.timers
  console.info(
    [
      "[PROXY BREAKDOWN]",
      "",
      `Request............... ${session.method} ${session.pathname}`,
      "",
      `${padLabel("Create Client")} ${formatMs(t.createClientMs)}`,
      `${padLabel("Get User")} ${formatMs(t.getUserMs)}`,
      `${padLabel("Get Session")} ${formatMs(t.getSessionMs)}`,
      `${padLabel("Load Metadata")} ${formatMs(t.loadMetadataMs)}`,
      `${padLabel("Load Employee")} ${formatMs(t.loadEmployeeMs)}`,
      `${padLabel("Load Permissions")} ${formatMs(t.loadPermissionsMs)}`,
      `${padLabel("JWT Validation")} ${formatMs(t.jwtValidationMs)}`,
      `${padLabel("Redirect Logic")} ${formatMs(t.redirectLogicMs)}`,
      "",
      `${padLabel("TOTAL")} ${formatMs(totalMs)}`,
    ].join("\n")
  )
}

function logProxyQueries(session: ProxyPerfSession): void {
  const rows = [...session.queries.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  const totalDb = rows
    .filter(([name]) => !name.startsWith("auth."))
    .reduce((sum, [, meta]) => sum + meta.durationMs, 0)
  const totalAuth = rows
    .filter(([name]) => name.startsWith("auth."))
    .reduce((sum, [, meta]) => sum + meta.durationMs, 0)

  const lines =
    rows.length === 0
      ? ["(none)"]
      : rows.map(
          ([name, meta]) =>
            `${padLabel(name)} ${Math.round(meta.durationMs)} ms` +
            (meta.count > 1 ? ` (${meta.count}x)` : "")
        )

  console.info(
    [
      "[PROXY QUERY]",
      "",
      ...lines,
      "",
      `${padLabel("TOTAL AUTH API")} ${formatMs(totalAuth || null)}`,
      `${padLabel("TOTAL DB")} ${formatMs(totalDb || null)}`,
    ].join("\n")
  )
}

function logProxyDuplicates(session: ProxyPerfSession): void {
  const dupes = [...session.calls.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => a[0].localeCompare(b[0]))

  if (dupes.length === 0) {
    console.info(
      ["[PROXY DUPLICATE]", "", "(none — no repeated calls in this proxy pass)"].join(
        "\n"
      )
    )
    return
  }

  console.info(
    [
      "[PROXY DUPLICATE]",
      "",
      ...dupes.map(
        ([name, count]) => `${padLabel(name)} ${count} veces`
      ),
    ].join("\n")
  )
}

export function finishProxyPerfSession(session: ProxyPerfSession | null): void {
  if (!session || !isAuthPerfEnabled()) return
  const totalMs = nowMs() - session.startedAt
  logProxyBreakdown(session, totalMs)
  logProxyQueries(session)
  logProxyDuplicates(session)
}
