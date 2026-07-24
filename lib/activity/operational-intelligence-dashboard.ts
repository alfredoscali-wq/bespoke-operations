import { ACTIVITY_ACTIONS } from "@/lib/activity/types"
import type { ActivityViewerEntry } from "@/lib/activity/activity-viewer-types"
import {
  formatActivityActionLabel,
  formatActivityAreaLabel,
} from "@/lib/activity/activity-viewer-labels"

const CONSULTATION_ATTENDED_ACTIONS = new Set<string>([
  ACTIVITY_ACTIONS.ATENCION_REGISTER_INTERACTION,
  ACTIVITY_ACTIONS.ATENCION_RESOLVE,
  ACTIVITY_ACTIONS.ATENCION_CLOSE,
])

export type OperationalDashboardKpis = {
  eventsToday: number
  eventsLastHour: number
  activeUsersToday: number
  activeAreasToday: number
  modulesActiveToday: number
  tasksCreatedToday: number
  tasksStartedToday: number
  tasksFinishedToday: number
  consultationsAttendedToday: number
}

export type OperationalTopEmployee = {
  employeeKey: string
  employeeId: string | null
  employeeName: string
  totalEvents: number
  otEvents: number
  consultationEvents: number
}

export type OperationalAreaStat = {
  areaKey: string
  areaLabel: string
  totalEvents: number
}

export type OperationalActionStat = {
  action: string
  actionLabel: string
  totalEvents: number
}

export type OperationalRecentItem = {
  id: string
  createdAt: string
  timeLabel: string
  employeeName: string
  actionLabel: string
  detail: string
}

export type OperationalIntelligenceDashboard = {
  kpis: OperationalDashboardKpis
  topEmployees: OperationalTopEmployee[]
  activityByArea: OperationalAreaStat[]
  topActions: OperationalActionStat[]
  recentFeed: OperationalRecentItem[]
  /** Events used for period rankings (loaded set). */
  periodEventCount: number
  /** Subset used for "hoy" KPIs. */
  todayEventCount: number
}

function startOfLocalDay(reference: Date): Date {
  const date = new Date(reference)
  date.setHours(0, 0, 0, 0)
  return date
}

function isOtAction(action: string): boolean {
  return action.startsWith("TASK_")
}

function isConsultationAction(action: string): boolean {
  return (
    CONSULTATION_ATTENDED_ACTIONS.has(action) || action.startsWith("ATENCION_")
  )
}

function countAction(
  entries: ActivityViewerEntry[],
  action: string
): number {
  return entries.reduce(
    (total, entry) => total + (String(entry.action) === action ? 1 : 0),
    0
  )
}

function filterToday(
  entries: ActivityViewerEntry[],
  reference: Date
): ActivityViewerEntry[] {
  const start = startOfLocalDay(reference).getTime()
  const end = reference.getTime()
  return entries.filter((entry) => {
    const ts = new Date(entry.createdAt).getTime()
    return Number.isFinite(ts) && ts >= start && ts <= end
  })
}

function filterLastHour(
  entries: ActivityViewerEntry[],
  reference: Date
): ActivityViewerEntry[] {
  const from = reference.getTime() - 60 * 60 * 1000
  return entries.filter((entry) => {
    const ts = new Date(entry.createdAt).getTime()
    return Number.isFinite(ts) && ts >= from && ts <= reference.getTime()
  })
}

function buildTopEmployees(
  entries: ActivityViewerEntry[],
  limit = 5
): OperationalTopEmployee[] {
  const byEmployee = new Map<
    string,
    {
      employeeId: string | null
      employeeName: string
      totalEvents: number
      otEvents: number
      consultationEvents: number
    }
  >()

  for (const entry of entries) {
    const employeeId = entry.employeeId
    const employeeKey = employeeId ?? `name:${entry.userName}`
    const action = String(entry.action)
    const current = byEmployee.get(employeeKey) ?? {
      employeeId,
      employeeName: entry.userName || "Sin nombre",
      totalEvents: 0,
      otEvents: 0,
      consultationEvents: 0,
    }

    current.totalEvents += 1
    if (isOtAction(action)) current.otEvents += 1
    if (CONSULTATION_ATTENDED_ACTIONS.has(action)) {
      current.consultationEvents += 1
    }
    if (entry.userName) current.employeeName = entry.userName

    byEmployee.set(employeeKey, current)
  }

  return [...byEmployee.entries()]
    .map(([employeeKey, value]) => ({ employeeKey, ...value }))
    .sort((a, b) => b.totalEvents - a.totalEvents)
    .slice(0, limit)
}

function buildActivityByArea(
  entries: ActivityViewerEntry[]
): OperationalAreaStat[] {
  const byArea = new Map<string, { areaLabel: string; totalEvents: number }>()

  for (const entry of entries) {
    const areaKey = entry.areaCode?.trim() || entry.areaLabel || "unknown"
    const areaLabel =
      entry.areaLabel && entry.areaLabel !== "—"
        ? entry.areaLabel
        : formatActivityAreaLabel(entry.areaCode)
    const current = byArea.get(areaKey) ?? {
      areaLabel: areaLabel || "Sin área",
      totalEvents: 0,
    }
    current.totalEvents += 1
    byArea.set(areaKey, current)
  }

  return [...byArea.entries()]
    .map(([areaKey, value]) => ({ areaKey, ...value }))
    .sort((a, b) => b.totalEvents - a.totalEvents)
}

function buildTopActions(
  entries: ActivityViewerEntry[],
  limit = 8
): OperationalActionStat[] {
  const byAction = new Map<string, number>()

  for (const entry of entries) {
    const action = String(entry.action)
    byAction.set(action, (byAction.get(action) ?? 0) + 1)
  }

  return [...byAction.entries()]
    .map(([action, totalEvents]) => ({
      action,
      actionLabel: formatActivityActionLabel(action),
      totalEvents,
    }))
    .sort((a, b) => b.totalEvents - a.totalEvents)
    .slice(0, limit)
}

function buildRecentFeed(
  entries: ActivityViewerEntry[],
  limit = 10
): OperationalRecentItem[] {
  return [...entries]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      timeLabel: new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(entry.createdAt)),
      employeeName: entry.userName || "Sin usuario",
      actionLabel: formatActivityActionLabel(String(entry.action)),
      detail: entry.detail?.trim() || "—",
    }))
}

/**
 * Executive dashboard aggregates from already-loaded activity events only.
 * No API / backend aggregation.
 */
export function buildOperationalIntelligenceDashboard(
  entries: ActivityViewerEntry[],
  reference = new Date()
): OperationalIntelligenceDashboard {
  const todayEntries = filterToday(entries, reference)
  const lastHourEntries = filterLastHour(entries, reference)

  const activeUserKeys = new Set(
    todayEntries.map(
      (entry) => entry.employeeId ?? `name:${entry.userName || "unknown"}`
    )
  )
  const activeAreaKeys = new Set(
    todayEntries.map(
      (entry) => entry.areaCode?.trim() || entry.areaLabel || "unknown"
    )
  )
  const activeModules = new Set(todayEntries.map((entry) => String(entry.module)))

  return {
    kpis: {
      eventsToday: todayEntries.length,
      eventsLastHour: lastHourEntries.length,
      activeUsersToday: activeUserKeys.size,
      activeAreasToday: activeAreaKeys.size,
      modulesActiveToday: activeModules.size,
      tasksCreatedToday: countAction(
        todayEntries,
        ACTIVITY_ACTIONS.TASK_CREATE
      ),
      tasksStartedToday: countAction(
        todayEntries,
        ACTIVITY_ACTIONS.TASK_START
      ),
      tasksFinishedToday: countAction(
        todayEntries,
        ACTIVITY_ACTIONS.TASK_APPROVE
      ),
      consultationsAttendedToday: todayEntries.reduce(
        (total, entry) =>
          total +
          (CONSULTATION_ATTENDED_ACTIONS.has(String(entry.action)) ? 1 : 0),
        0
      ),
    },
    topEmployees: buildTopEmployees(entries),
    activityByArea: buildActivityByArea(entries),
    topActions: buildTopActions(entries),
    recentFeed: buildRecentFeed(entries),
    periodEventCount: entries.length,
    todayEventCount: todayEntries.length,
  }
}

export function isOtRelatedAction(action: string): boolean {
  return isOtAction(action)
}

export function isConsultationRelatedAction(action: string): boolean {
  return isConsultationAction(action)
}
