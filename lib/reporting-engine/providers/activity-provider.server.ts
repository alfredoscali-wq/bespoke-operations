import "server-only"

import type { ReportingPeriod } from "@/lib/reporting-engine/types"

/**
 * Activity Engine read surface — Foundation 1.0.
 * Reads only. Never calls activity.record().
 */
export type ActivityFactsRequest = {
  companyId: string
  period: ReportingPeriod
}

export type ActivityFactRow = {
  id: string
  action: string
  module: string
  entityType: string
  entityId: string | null
  employeeId: string | null
  createdAt: string
}

export type ActivityFactsDataset = {
  companyId: string
  period: ReportingPeriod
  rows: ActivityFactRow[]
}

export async function loadActivityFacts(
  request: ActivityFactsRequest
): Promise<ActivityFactsDataset> {
  return {
    companyId: request.companyId,
    period: request.period,
    rows: [],
  }
}
