/**
 * ATC performance metric contracts — Sprint 27.
 */

export type CustomerServiceSourceQueryMetric = {
  sourceName: string
  durationMs: number
  rowCount: number
}

export type CustomerServiceLookupMetric = {
  durationMs: number
  customerIdCount: number
  /** Sorted id fingerprint for duplicate detection. */
  fingerprint: string
  duplicate: boolean
}

export type CustomerServiceSeguimientoQueryMetric = {
  label: string
  durationMs: number
  rowCount: number
  /** Sorted atencion-id fingerprint when applicable. */
  fingerprint: string
  duplicate: boolean
}

export type CustomerServiceInboxLoadMetrics = {
  startedAt: number
  finishedAt: number
  durationMs: number
  rowsLoaded: number
  activeRows: number
  resolvedTodayRows: number
  recentResolvedRows: number
  customerLookups: number
  seguimientoLookups: number
  sourceQueries: CustomerServiceSourceQueryMetric[]
  customerLookupDetails: CustomerServiceLookupMetric[]
  seguimientoQueryDetails: CustomerServiceSeguimientoQueryMetric[]
  customerLookupTotalMs: number
  seguimientoTotalMs: number
  duplicateCustomerLookups: number
  duplicateSeguimientoQueries: number
}
