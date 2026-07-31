import type { ActivityTimelineEvent } from "@/lib/activity/activity-timeline-types"
import {
  resolveOperationsIntelligenceAreaId,
  type OperationsIntelligenceAreaId,
} from "@/lib/activity/operations-intelligence"
import {
  classifyWorkforceActivityStatus,
  type WorkforceActivityStatus,
} from "@/lib/activity/workforce-activity-status"
import {
  computeIndicatorSnapshot,
  indicatorCount,
  INDICATOR_IDS,
  canonicalizeActivityModule,
  WORKFORCE_BUCKET_INDICATOR_IDS,
} from "@/lib/indicators"

export type WorkforceModuleCounters = {
  customers: number
  requests: number
  workOrders: number
  attentions: number
  commercialActivities: number
  projects: number
  settings: number
}

export type WorkforceMonitorRow = {
  employeeId: string
  firstEventAt: string | null
  lastEventAt: string | null
  eventCount: number
  modules: WorkforceModuleCounters
  lastModule: string | null
  activityStatus: WorkforceActivityStatus
  /** Ops Intelligence areas touched by this employee during the day. */
  opsAreaIds: OperationsIntelligenceAreaId[]
}

const EMPTY_MODULES: WorkforceModuleCounters = {
  customers: 0,
  requests: 0,
  workOrders: 0,
  attentions: 0,
  commercialActivities: 0,
  projects: 0,
  settings: 0,
}

/**
 * Aggregate Activity Engine events into one workforce row per employeeId.
 * Module counters come from Indicator Engine (customer_service → atencion).
 * Events without employeeId are ignored.
 */
export function aggregateWorkforceMonitorRows(
  events: ActivityTimelineEvent[]
): WorkforceMonitorRow[] {
  const byEmployee = new Map<
    string,
    {
      events: ActivityTimelineEvent[]
      opsAreaIds: Set<OperationsIntelligenceAreaId>
    }
  >()

  for (const event of events) {
    const employeeId = event.employeeId?.trim()
    if (!employeeId) continue

    let bucket = byEmployee.get(employeeId)
    if (!bucket) {
      bucket = {
        events: [],
        opsAreaIds: new Set(),
      }
      byEmployee.set(employeeId, bucket)
    }

    bucket.events.push(event)
    const areaId = resolveOperationsIntelligenceAreaId(event.module)
    if (areaId) bucket.opsAreaIds.add(areaId)
  }

  const rows: WorkforceMonitorRow[] = []

  for (const [employeeId, bucket] of byEmployee) {
    const sorted = [...bucket.events].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    )
    const first = sorted[0] ?? null
    const last = sorted[sorted.length - 1] ?? null
    const snapshot = computeIndicatorSnapshot(bucket.events, {
      indicatorIds: WORKFORCE_BUCKET_INDICATOR_IDS,
    })

    rows.push({
      employeeId,
      firstEventAt: first?.createdAt ?? null,
      lastEventAt: last?.createdAt ?? null,
      eventCount: sorted.length,
      modules: {
        customers: indicatorCount(snapshot, INDICATOR_IDS.BUCKET_CUSTOMERS),
        requests: indicatorCount(snapshot, INDICATOR_IDS.BUCKET_REQUESTS),
        workOrders: indicatorCount(snapshot, INDICATOR_IDS.BUCKET_WORK_ORDERS),
        attentions: indicatorCount(snapshot, INDICATOR_IDS.BUCKET_ATTENTIONS),
        commercialActivities: indicatorCount(
          snapshot,
          INDICATOR_IDS.BUCKET_COMMERCIAL
        ),
        projects: indicatorCount(snapshot, INDICATOR_IDS.BUCKET_PROJECTS),
        settings: indicatorCount(snapshot, INDICATOR_IDS.BUCKET_SETTINGS),
      },
      lastModule: last
        ? canonicalizeActivityModule(last.module)
        : null,
      activityStatus: classifyWorkforceActivityStatus(sorted.length),
      opsAreaIds: [...bucket.opsAreaIds],
    })
  }

  return rows
}

export function emptyWorkforceMonitorRow(
  employeeId: string
): WorkforceMonitorRow {
  return {
    employeeId,
    firstEventAt: null,
    lastEventAt: null,
    eventCount: 0,
    modules: { ...EMPTY_MODULES },
    lastModule: null,
    activityStatus: classifyWorkforceActivityStatus(0),
    opsAreaIds: [],
  }
}

export function mergeWorkforceRowsWithEmployees(
  employeeIds: string[],
  activityRows: WorkforceMonitorRow[]
): WorkforceMonitorRow[] {
  const byId = new Map(activityRows.map((row) => [row.employeeId, row]))
  return employeeIds.map(
    (employeeId) => byId.get(employeeId) ?? emptyWorkforceMonitorRow(employeeId)
  )
}
