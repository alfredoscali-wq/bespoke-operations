import type { ActivityTimelineEvent } from "@/lib/activity/activity-timeline-types"
import {
  computeIndicatorSnapshot,
  indicatorCount,
  INDICATOR_IDS,
  canonicalizeActivityModule,
  WORKFORCE_BUCKET_INDICATOR_IDS,
  type IndicatorSnapshot,
} from "@/lib/indicators"
import type { WorkforceModuleCounters } from "@/lib/activity/workforce-monitor"

export type OperationsIntelligenceAreaId =
  | "comercial"
  | "atencion"
  | "operaciones"
  | "rrhh"
  | "administracion"
  | "configuracion"

export type OperationsIntelligenceAreaDefinition = {
  id: OperationsIntelligenceAreaId
  label: string
  /** Canonical modules (post-alias) that feed this transitional area card. */
  modules: readonly string[]
}

/**
 * Transitional operational areas for the intelligence center (module → area).
 * Sprint 4.0: do not expand this model — evolve toward company executive summary
 * driven by Indicator Engine production indicators.
 */
export const OPERATIONS_INTELLIGENCE_AREAS: readonly OperationsIntelligenceAreaDefinition[] =
  [
    {
      id: "comercial",
      label: "Comercial",
      modules: ["commercial", "requests"],
    },
    {
      id: "atencion",
      label: "Atención al Cliente",
      modules: ["atencion"],
    },
    {
      id: "operaciones",
      label: "Operaciones",
      modules: ["tasks", "planning", "projects", "crews"],
    },
    {
      id: "rrhh",
      label: "RRHH",
      modules: ["rrhh"],
    },
    {
      id: "administracion",
      label: "Administración",
      modules: ["customers"],
    },
    {
      id: "configuracion",
      label: "Configuración",
      modules: ["settings"],
    },
  ] as const

const MODULE_TO_AREA = new Map<string, OperationsIntelligenceAreaId>()
for (const area of OPERATIONS_INTELLIGENCE_AREAS) {
  for (const moduleName of area.modules) {
    MODULE_TO_AREA.set(moduleName, area.id)
  }
}

export function resolveOperationsIntelligenceAreaId(
  moduleName: string
): OperationsIntelligenceAreaId | null {
  return (
    MODULE_TO_AREA.get(canonicalizeActivityModule(moduleName)) ?? null
  )
}

export function getOperationsIntelligenceAreaLabel(
  areaId: OperationsIntelligenceAreaId
): string {
  return (
    OPERATIONS_INTELLIGENCE_AREAS.find((area) => area.id === areaId)?.label ??
    areaId
  )
}

export type OperationsIntelligenceAreaCard = {
  areaId: OperationsIntelligenceAreaId
  label: string
  activeEmployees: number
  eventCount: number
  firstEventAt: string | null
  lastEventAt: string | null
  modules: WorkforceModuleCounters
}

export type OperationsIntelligenceSummary = {
  employeesWithActivity: number
  totalEvents: number
  firstEventAt: string | null
  lastEventAt: string | null
  areasWithActivity: number
}

export type OperationsIntelligenceResult = {
  summary: OperationsIntelligenceSummary
  areas: OperationsIntelligenceAreaCard[]
}

function snapshotToModuleCounters(
  snapshot: IndicatorSnapshot
): WorkforceModuleCounters {
  return {
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
  }
}

/**
 * Aggregate day events into company summary + transitional per-area cards.
 * Module buckets come from Indicator Engine (with customer_service → atencion).
 */
export function aggregateOperationsIntelligence(
  events: ActivityTimelineEvent[]
): OperationsIntelligenceResult {
  const employees = new Set<string>()
  let firstEventAt: string | null = null
  let lastEventAt: string | null = null

  type AreaBucket = {
    events: ActivityTimelineEvent[]
    employeeIds: Set<string>
  }

  const buckets = new Map<OperationsIntelligenceAreaId, AreaBucket>()
  for (const area of OPERATIONS_INTELLIGENCE_AREAS) {
    buckets.set(area.id, {
      events: [],
      employeeIds: new Set(),
    })
  }

  for (const event of events) {
    if (event.employeeId?.trim()) {
      employees.add(event.employeeId.trim())
    }

    if (
      !firstEventAt ||
      event.createdAt.localeCompare(firstEventAt) < 0
    ) {
      firstEventAt = event.createdAt
    }
    if (!lastEventAt || event.createdAt.localeCompare(lastEventAt) > 0) {
      lastEventAt = event.createdAt
    }

    const areaId = resolveOperationsIntelligenceAreaId(event.module)
    if (!areaId) continue

    const bucket = buckets.get(areaId)
    if (!bucket) continue

    bucket.events.push(event)
    if (event.employeeId?.trim()) {
      bucket.employeeIds.add(event.employeeId.trim())
    }
  }

  const areas: OperationsIntelligenceAreaCard[] =
    OPERATIONS_INTELLIGENCE_AREAS.map((area) => {
      const bucket = buckets.get(area.id)!
      const snapshot = computeIndicatorSnapshot(bucket.events, {
        indicatorIds: [
          ...WORKFORCE_BUCKET_INDICATOR_IDS,
          INDICATOR_IDS.EVENTS_TOTAL,
          INDICATOR_IDS.FIRST_EVENT_AT,
          INDICATOR_IDS.LAST_EVENT_AT,
        ],
      })
      const first = snapshot.values[INDICATOR_IDS.FIRST_EVENT_AT]
      const last = snapshot.values[INDICATOR_IDS.LAST_EVENT_AT]
      return {
        areaId: area.id,
        label: area.label,
        activeEmployees: bucket.employeeIds.size,
        eventCount: indicatorCount(snapshot, INDICATOR_IDS.EVENTS_TOTAL),
        firstEventAt: typeof first === "string" ? first : null,
        lastEventAt: typeof last === "string" ? last : null,
        modules: snapshotToModuleCounters(snapshot),
      }
    })

  return {
    summary: {
      employeesWithActivity: employees.size,
      totalEvents: events.length,
      firstEventAt,
      lastEventAt,
      areasWithActivity: areas.filter((area) => area.eventCount > 0).length,
    },
    areas,
  }
}

export function canAccessOperationsIntelligence(
  systemRole: string | null | undefined
): boolean {
  return (
    systemRole === "administrador" ||
    systemRole === "supervisor" ||
    systemRole === "administrativo"
  )
}
