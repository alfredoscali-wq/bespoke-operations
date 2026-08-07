/**
 * In-memory ATC inbox load session — Sprint 27.
 * Only mutated when the profiler is enabled.
 */

import type {
  CustomerServiceInboxLoadMetrics,
  CustomerServiceLookupMetric,
  CustomerServiceSeguimientoQueryMetric,
  CustomerServiceSourceQueryMetric,
} from "@/lib/customer-service/performance/types"

export type CustomerServiceInboxSession = {
  startedAt: number
  rowsLoaded: number
  activeRows: number
  resolvedTodayRows: number
  recentResolvedRows: number
  sourceQueries: CustomerServiceSourceQueryMetric[]
  customerLookupDetails: CustomerServiceLookupMetric[]
  seguimientoQueryDetails: CustomerServiceSeguimientoQueryMetric[]
  seenCustomerFingerprints: Set<string>
  seenSeguimientoFingerprints: Set<string>
}

export function createCustomerServiceInboxSession(
  startedAt: number
): CustomerServiceInboxSession {
  return {
    startedAt,
    rowsLoaded: 0,
    activeRows: 0,
    resolvedTodayRows: 0,
    recentResolvedRows: 0,
    sourceQueries: [],
    customerLookupDetails: [],
    seguimientoQueryDetails: [],
    seenCustomerFingerprints: new Set(),
    seenSeguimientoFingerprints: new Set(),
  }
}

export function finalizeCustomerServiceInboxMetrics(
  session: CustomerServiceInboxSession,
  finishedAt: number
): CustomerServiceInboxLoadMetrics {
  const customerLookupTotalMs = session.customerLookupDetails.reduce(
    (sum, item) => sum + item.durationMs,
    0
  )
  const seguimientoTotalMs = session.seguimientoQueryDetails.reduce(
    (sum, item) => sum + item.durationMs,
    0
  )

  return {
    startedAt: session.startedAt,
    finishedAt,
    durationMs: Math.max(0, Math.round(finishedAt - session.startedAt)),
    rowsLoaded: session.rowsLoaded,
    activeRows: session.activeRows,
    resolvedTodayRows: session.resolvedTodayRows,
    recentResolvedRows: session.recentResolvedRows,
    customerLookups: session.customerLookupDetails.length,
    seguimientoLookups: session.seguimientoQueryDetails.length,
    sourceQueries: [...session.sourceQueries],
    customerLookupDetails: [...session.customerLookupDetails],
    seguimientoQueryDetails: [...session.seguimientoQueryDetails],
    customerLookupTotalMs: Math.round(customerLookupTotalMs),
    seguimientoTotalMs: Math.round(seguimientoTotalMs),
    duplicateCustomerLookups: session.customerLookupDetails.filter(
      (item) => item.duplicate
    ).length,
    duplicateSeguimientoQueries: session.seguimientoQueryDetails.filter(
      (item) => item.duplicate
    ).length,
  }
}
