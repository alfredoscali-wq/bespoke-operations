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
} from "@/lib/indicators"

/**
 * Transitional module-bucket counters — still used by Ops Intelligence.
 * Not used for Workforce Monitor production column.
 */
export type WorkforceModuleCounters = {
  customers: number
  requests: number
  workOrders: number
  attentions: number
  commercialActivities: number
  projects: number
  settings: number
}

/**
 * Business production counters — same Indicator Engine ids as Actividad de la Jornada.
 * `attentionsPending` is presentation math: max(0, created − resolved).
 */
export type WorkforceProductionCounters = {
  attentionsCreated: number
  attentionsResolved: number
  attentionsPending: number
  attentionsTransferred: number
  attentionsWorkordersGenerated: number
  workordersCreated: number
  workordersStarted: number
  workordersFinished: number
  customersCreated: number
  commercialCompleted: number
  retentions: number
  requestsCreated: number
}

export type WorkforceMonitorRow = {
  employeeId: string
  firstEventAt: string | null
  lastEventAt: string | null
  eventCount: number
  production: WorkforceProductionCounters
  lastModule: string | null
  activityStatus: WorkforceActivityStatus
  /** Ops Intelligence areas touched by this employee during the day. */
  opsAreaIds: OperationsIntelligenceAreaId[]
}

/** Same business indicators Jornada uses for production / resumen. */
export const WORKFORCE_PRODUCTION_INDICATOR_IDS = [
  INDICATOR_IDS.ATTENTIONS_CREATED,
  INDICATOR_IDS.ATTENTIONS_RESOLVED,
  INDICATOR_IDS.ATTENTIONS_TRANSFERRED,
  INDICATOR_IDS.ATTENTIONS_WORKORDERS_GENERATED,
  INDICATOR_IDS.RETENTIONS,
  INDICATOR_IDS.WORKORDERS_CREATED,
  INDICATOR_IDS.WORKORDERS_STARTED,
  INDICATOR_IDS.WORKORDERS_FINISHED,
  INDICATOR_IDS.CUSTOMERS_CREATED,
  INDICATOR_IDS.COMMERCIAL_COMPLETED,
  INDICATOR_IDS.REQUESTS_CREATED,
] as const

const EMPTY_PRODUCTION: WorkforceProductionCounters = {
  attentionsCreated: 0,
  attentionsResolved: 0,
  attentionsPending: 0,
  attentionsTransferred: 0,
  attentionsWorkordersGenerated: 0,
  workordersCreated: 0,
  workordersStarted: 0,
  workordersFinished: 0,
  customersCreated: 0,
  commercialCompleted: 0,
  retentions: 0,
  requestsCreated: 0,
}

function productionFromSnapshot(
  events: readonly ActivityTimelineEvent[]
): WorkforceProductionCounters {
  const snapshot = computeIndicatorSnapshot(events, {
    indicatorIds: WORKFORCE_PRODUCTION_INDICATOR_IDS,
  })
  const attentionsCreated = indicatorCount(
    snapshot,
    INDICATOR_IDS.ATTENTIONS_CREATED
  )
  const attentionsResolved = indicatorCount(
    snapshot,
    INDICATOR_IDS.ATTENTIONS_RESOLVED
  )

  return {
    attentionsCreated,
    attentionsResolved,
    attentionsPending: Math.max(0, attentionsCreated - attentionsResolved),
    attentionsTransferred: indicatorCount(
      snapshot,
      INDICATOR_IDS.ATTENTIONS_TRANSFERRED
    ),
    attentionsWorkordersGenerated: indicatorCount(
      snapshot,
      INDICATOR_IDS.ATTENTIONS_WORKORDERS_GENERATED
    ),
    workordersCreated: indicatorCount(
      snapshot,
      INDICATOR_IDS.WORKORDERS_CREATED
    ),
    workordersStarted: indicatorCount(
      snapshot,
      INDICATOR_IDS.WORKORDERS_STARTED
    ),
    workordersFinished: indicatorCount(
      snapshot,
      INDICATOR_IDS.WORKORDERS_FINISHED
    ),
    customersCreated: indicatorCount(
      snapshot,
      INDICATOR_IDS.CUSTOMERS_CREATED
    ),
    commercialCompleted: indicatorCount(
      snapshot,
      INDICATOR_IDS.COMMERCIAL_COMPLETED
    ),
    retentions: indicatorCount(snapshot, INDICATOR_IDS.RETENTIONS),
    requestsCreated: indicatorCount(snapshot, INDICATOR_IDS.REQUESTS_CREATED),
  }
}

/**
 * Aggregate Activity Engine events into one workforce row per employeeId.
 * Production counters use business indicators (same as Actividad de la Jornada).
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

    rows.push({
      employeeId,
      firstEventAt: first?.createdAt ?? null,
      lastEventAt: last?.createdAt ?? null,
      eventCount: sorted.length,
      production: productionFromSnapshot(sorted),
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
    production: { ...EMPTY_PRODUCTION },
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
