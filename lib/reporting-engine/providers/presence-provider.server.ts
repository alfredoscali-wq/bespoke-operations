import "server-only"

import type { ReportingPeriod } from "@/lib/reporting-engine/types"

/**
 * Presence Engine read surface — Foundation 1.0.
 * Reads only. Never writes presence events.
 * Effective-time metrics should prefer ENTER/EXIT over HEARTBEAT.
 */
export type PresenceEventsRequest = {
  companyId: string
  period: ReportingPeriod
}

export type PresenceEventRow = {
  id: string
  taskId: string
  employeeId: string
  eventType: string
  createdAt: string
}

export type PresenceEventsDataset = {
  companyId: string
  period: ReportingPeriod
  rows: PresenceEventRow[]
}

export async function loadPresenceEvents(
  request: PresenceEventsRequest
): Promise<PresenceEventsDataset> {
  return {
    companyId: request.companyId,
    period: request.period,
    rows: [],
  }
}
