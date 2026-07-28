import "server-only"

import type { ReportingPeriod } from "@/lib/reporting-engine/types"

/**
 * Domain read surface — Foundation 1.0.
 * No mutations. No business aggregation. Queries land in Sprint 2+.
 */
export type DomainSnapshotRequest = {
  companyId: string
  period: ReportingPeriod
}

export type DomainSnapshot = {
  companyId: string
  period: ReportingPeriod
  /** Opaque placeholder until real reads are wired. */
  entities: Record<string, never>
}

export async function loadDomainSnapshot(
  request: DomainSnapshotRequest
): Promise<DomainSnapshot> {
  return {
    companyId: request.companyId,
    period: request.period,
    entities: {},
  }
}
