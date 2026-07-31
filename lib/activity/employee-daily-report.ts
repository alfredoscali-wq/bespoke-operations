import type { ActivityTimelineEvent } from "@/lib/activity/activity-timeline-types"
import {
  computeIndicatorSnapshot,
  indicatorCount,
  INDICATOR_IDS,
  EMPLOYEE_DAILY_INDICATOR_IDS,
} from "@/lib/indicators"

export type EmployeeDailyOperationalCounters = {
  customersCreated: number
  customersUpdated: number
  requestsCreated: number
  requestsResolved: number
  workOrdersCreated: number
  workOrdersAssigned: number
  workOrdersStarted: number
  workOrdersFinished: number
  attentionsCreated: number
  attentionsResolved: number
  commercialActivities: number
  projectsUpdated: number
  settingsUpdated: number
}

export const EMPLOYEE_DAILY_COUNTER_LABELS: Record<
  keyof EmployeeDailyOperationalCounters,
  string
> = {
  customersCreated: "Clientes creados",
  customersUpdated: "Clientes modificados",
  requestsCreated: "Solicitudes creadas",
  requestsResolved: "Solicitudes resueltas",
  workOrdersCreated: "OT creadas",
  workOrdersAssigned: "OT asignadas",
  workOrdersStarted: "OT iniciadas",
  workOrdersFinished: "OT finalizadas",
  attentionsCreated: "Atenciones creadas",
  attentionsResolved: "Atenciones resueltas",
  commercialActivities: "Actividades comerciales",
  projectsUpdated: "Obras modificadas",
  settingsUpdated: "Configuraciones modificadas",
}

const EMPTY_COUNTERS: EmployeeDailyOperationalCounters = {
  customersCreated: 0,
  customersUpdated: 0,
  requestsCreated: 0,
  requestsResolved: 0,
  workOrdersCreated: 0,
  workOrdersAssigned: 0,
  workOrdersStarted: 0,
  workOrdersFinished: 0,
  attentionsCreated: 0,
  attentionsResolved: 0,
  commercialActivities: 0,
  projectsUpdated: 0,
  settingsUpdated: 0,
}

/**
 * Derive operational counters from Indicator Engine (not raw screen rules).
 * Includes legacy Customer Service actions (CASE_CREATED / CASE_CLOSED).
 */
export function computeEmployeeDailyOperationalCounters(
  events: ActivityTimelineEvent[]
): EmployeeDailyOperationalCounters {
  const snapshot = computeIndicatorSnapshot(events, {
    indicatorIds: EMPLOYEE_DAILY_INDICATOR_IDS,
  })

  return {
    customersCreated: indicatorCount(
      snapshot,
      INDICATOR_IDS.CUSTOMERS_CREATED
    ),
    customersUpdated: indicatorCount(
      snapshot,
      INDICATOR_IDS.CUSTOMERS_UPDATED
    ),
    requestsCreated: indicatorCount(snapshot, INDICATOR_IDS.REQUESTS_CREATED),
    requestsResolved: indicatorCount(
      snapshot,
      INDICATOR_IDS.REQUESTS_RESOLVED
    ),
    workOrdersCreated: indicatorCount(
      snapshot,
      INDICATOR_IDS.WORKORDERS_CREATED
    ),
    workOrdersAssigned: indicatorCount(
      snapshot,
      INDICATOR_IDS.WORKORDERS_ASSIGNED
    ),
    workOrdersStarted: indicatorCount(
      snapshot,
      INDICATOR_IDS.WORKORDERS_STARTED
    ),
    workOrdersFinished: indicatorCount(
      snapshot,
      INDICATOR_IDS.WORKORDERS_FINISHED
    ),
    attentionsCreated: indicatorCount(
      snapshot,
      INDICATOR_IDS.ATTENTIONS_CREATED
    ),
    attentionsResolved: indicatorCount(
      snapshot,
      INDICATOR_IDS.ATTENTIONS_RESOLVED
    ),
    commercialActivities: indicatorCount(
      snapshot,
      INDICATOR_IDS.COMMERCIAL_ACTIVITIES
    ),
    projectsUpdated: indicatorCount(snapshot, INDICATOR_IDS.PROJECTS_UPDATED),
    settingsUpdated: indicatorCount(snapshot, INDICATOR_IDS.SETTINGS_UPDATED),
  }
}

export function countDistinctModules(
  events: ActivityTimelineEvent[]
): number {
  const snapshot = computeIndicatorSnapshot(events, {
    indicatorIds: [INDICATOR_IDS.DISTINCT_MODULES],
  })
  return indicatorCount(snapshot, INDICATOR_IDS.DISTINCT_MODULES)
}

export function formatActivityInterEventGap(
  fromIso: string,
  toIso: string
): string | null {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return null
  }

  const totalSeconds = Math.floor((to - from) / 1000)
  if (totalSeconds < 60) {
    return totalSeconds === 1 ? "1 segundo" : `${totalSeconds} segundos`
  }

  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) {
    return totalMinutes === 1 ? "1 minuto" : `${totalMinutes} minutos`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const hoursLabel = hours === 1 ? "1 hora" : `${hours} horas`
  if (minutes === 0) return hoursLabel
  const minutesLabel = minutes === 1 ? "1 minuto" : `${minutes} minutos`
  return `${hoursLabel} ${minutesLabel}`
}

export function todayDateInputValue(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function emptyEmployeeDailyOperationalCounters(): EmployeeDailyOperationalCounters {
  return { ...EMPTY_COUNTERS }
}
