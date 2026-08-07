/**
 * Customer Service Profiler — Sprint 27 / ATC Performance 1.0.
 * Development-only instrumentation. Never changes business behavior.
 */

import { isCustomerServicePerfEnabled } from "@/lib/customer-service/performance/enabled"
import {
  createCustomerServiceInboxSession,
  finalizeCustomerServiceInboxMetrics,
  type CustomerServiceInboxSession,
} from "@/lib/customer-service/performance/session"
import type {
  CustomerServiceInboxLoadMetrics,
  CustomerServiceLookupMetric,
  CustomerServiceSeguimientoQueryMetric,
  CustomerServiceSourceQueryMetric,
} from "@/lib/customer-service/performance/types"

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

/** Active inbox profile (provider-scoped). Concurrent query stages append here. */
let activeInboxSession: CustomerServiceInboxSession | null = null

/** Last completed metrics — useful for tests / manual inspection. */
let lastInboxMetrics: CustomerServiceInboxLoadMetrics | null = null

/** Global seguimiento query stats across ATC (detect duplicates beyond one load). */
const globalSeguimientoFingerprints = new Map<string, number>()
const globalCustomerFingerprints = new Map<string, number>()

export function getLastCustomerServiceInboxMetrics(): CustomerServiceInboxLoadMetrics | null {
  return lastInboxMetrics
}

export function resetCustomerServicePerfForTests(): void {
  activeInboxSession = null
  lastInboxMetrics = null
  globalSeguimientoFingerprints.clear()
  globalCustomerFingerprints.clear()
}

export function beginCustomerServiceInboxProfile(): CustomerServiceInboxSession | null {
  if (!isCustomerServicePerfEnabled()) return null
  const session = createCustomerServiceInboxSession(nowMs())
  activeInboxSession = session
  return session
}

export function getActiveCustomerServiceInboxSession(): CustomerServiceInboxSession | null {
  if (!isCustomerServicePerfEnabled()) return null
  return activeInboxSession
}

function fingerprintIds(ids: string[]): string {
  return [...ids].sort().join(",")
}

export function recordCustomerServiceSourceQuery(
  metric: CustomerServiceSourceQueryMetric,
  session: CustomerServiceInboxSession | null = activeInboxSession
): void {
  if (!isCustomerServicePerfEnabled() || !session) return

  session.sourceQueries.push({
    sourceName: metric.sourceName,
    durationMs: Math.round(metric.durationMs),
    rowCount: metric.rowCount,
  })

  if (metric.sourceName === "activeResult") {
    session.activeRows += metric.rowCount
  } else if (metric.sourceName === "resolvedTodayResult") {
    session.resolvedTodayRows += metric.rowCount
  } else if (metric.sourceName === "recentResolvedResult") {
    session.recentResolvedRows += metric.rowCount
  }
}

export function recordCustomerServiceRowsLoaded(
  rowsLoaded: number,
  session: CustomerServiceInboxSession | null = activeInboxSession
): void {
  if (!isCustomerServicePerfEnabled() || !session) return
  session.rowsLoaded += rowsLoaded
}

export function recordCustomerServiceCustomerLookup(input: {
  customerIds: string[]
  durationMs: number
  session?: CustomerServiceInboxSession | null
}): CustomerServiceLookupMetric | null {
  if (!isCustomerServicePerfEnabled()) return null

  const session = input.session === undefined ? activeInboxSession : input.session
  const fingerprint = fingerprintIds(input.customerIds)
  const priorGlobal = globalCustomerFingerprints.get(fingerprint) ?? 0
  globalCustomerFingerprints.set(fingerprint, priorGlobal + 1)

  const duplicateInSession = session
    ? session.seenCustomerFingerprints.has(fingerprint)
    : priorGlobal > 0
  if (session) {
    session.seenCustomerFingerprints.add(fingerprint)
  }

  const metric: CustomerServiceLookupMetric = {
    durationMs: Math.round(input.durationMs),
    customerIdCount: input.customerIds.length,
    fingerprint,
    duplicate: duplicateInSession || priorGlobal > 0,
  }

  if (session) {
    session.customerLookupDetails.push(metric)
  }

  return metric
}

export function recordCustomerServiceSeguimientoQuery(input: {
  label: string
  atencionIds?: string[]
  durationMs: number
  rowCount: number
  session?: CustomerServiceInboxSession | null
}): CustomerServiceSeguimientoQueryMetric | null {
  if (!isCustomerServicePerfEnabled()) return null

  const session = input.session === undefined ? activeInboxSession : input.session
  const fingerprint = `${input.label}::${fingerprintIds(input.atencionIds ?? [])}`
  const priorGlobal = globalSeguimientoFingerprints.get(fingerprint) ?? 0
  globalSeguimientoFingerprints.set(fingerprint, priorGlobal + 1)

  const duplicateInSession = session
    ? session.seenSeguimientoFingerprints.has(fingerprint)
    : priorGlobal > 0
  if (session) {
    session.seenSeguimientoFingerprints.add(fingerprint)
  }

  const metric: CustomerServiceSeguimientoQueryMetric = {
    label: input.label,
    durationMs: Math.round(input.durationMs),
    rowCount: input.rowCount,
    fingerprint,
    duplicate: duplicateInSession || priorGlobal > 0,
  }

  if (session) {
    session.seguimientoQueryDetails.push(metric)
  } else if (metric.duplicate) {
    console.info(
      `[ATC Performance] Duplicate seguimiento query detected: ${input.label} (${metric.rowCount} rows, ${metric.durationMs} ms)`
    )
  }

  return metric
}

/**
 * Time a shared-inbox source query. Always runs `run`; metrics only when enabled.
 */
export async function measureCustomerServiceSourceQuery<T>(
  sourceName: string,
  run: () => PromiseLike<T>,
  rowCountOf: (result: T) => number,
  session: CustomerServiceInboxSession | null = activeInboxSession
): Promise<T> {
  if (!isCustomerServicePerfEnabled() || !session) {
    return run()
  }

  const started = nowMs()
  const result = await run()
  recordCustomerServiceSourceQuery(
    {
      sourceName,
      durationMs: nowMs() - started,
      rowCount: rowCountOf(result),
    },
    session
  )
  return result
}

/**
 * Time a customer_seguimientos query. Always runs `run`; metrics only in development.
 */
export async function withCustomerServiceSeguimientoTiming<T>(
  label: string,
  run: () => PromiseLike<T>,
  rowCountOf: (result: T) => number,
  atencionIds?: string[]
): Promise<T> {
  if (!isCustomerServicePerfEnabled()) {
    return run()
  }

  const started = nowMs()
  const result = await run()
  recordCustomerServiceSeguimientoQuery({
    label,
    atencionIds,
    durationMs: nowMs() - started,
    rowCount: rowCountOf(result),
  })
  return result
}

export function finishCustomerServiceInboxProfile(
  session: CustomerServiceInboxSession | null
): CustomerServiceInboxLoadMetrics | null {
  if (!isCustomerServicePerfEnabled() || !session) return null

  const metrics = finalizeCustomerServiceInboxMetrics(session, nowMs())
  lastInboxMetrics = metrics

  if (activeInboxSession === session) {
    activeInboxSession = null
  }

  logCustomerServiceNetworkSummary(metrics)
  return metrics
}

export function logCustomerServiceNetworkSummary(
  metrics: CustomerServiceInboxLoadMetrics
): void {
  if (!isCustomerServicePerfEnabled()) return

  const sourceLines = metrics.sourceQueries
    .map(
      (query) =>
        `  ${query.sourceName}: ${query.durationMs} ms · ${query.rowCount} rows`
    )
    .join("\n")

  const seguimientoAvg =
    metrics.seguimientoLookups > 0
      ? Math.round(metrics.seguimientoTotalMs / metrics.seguimientoLookups)
      : 0

  console.info(
    [
      "[ATC Performance]",
      `Inbox Load: ${metrics.durationMs} ms`,
      `Active Rows: ${metrics.activeRows}`,
      `Resolved Today: ${metrics.resolvedTodayRows}`,
      `Recent Resolved: ${metrics.recentResolvedRows}`,
      `Rows Loaded: ${metrics.rowsLoaded}`,
      `Customer Lookup: ${metrics.customerLookupTotalMs} ms (${metrics.customerLookups} calls${
        metrics.duplicateCustomerLookups
          ? `, ${metrics.duplicateCustomerLookups} duplicate`
          : ""
      })`,
      `Seguimientos: ${metrics.seguimientoTotalMs} ms (${metrics.seguimientoLookups} calls, avg ${seguimientoAvg} ms${
        metrics.duplicateSeguimientoQueries
          ? `, ${metrics.duplicateSeguimientoQueries} duplicate`
          : ""
      })`,
      `Total Duration: ${metrics.durationMs} ms`,
      sourceLines ? `Source queries:\n${sourceLines}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  )
}
