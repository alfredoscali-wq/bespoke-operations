import { ACTIVITY_ACTIONS } from "@/lib/activity/types"
import type { ActivityViewerEntry } from "@/lib/activity/activity-viewer-types"
import {
  formatActivityActionLabel,
  formatActivityDisplayTimestamp,
  formatActivityModuleLabel,
} from "@/lib/activity/activity-viewer-labels"

export const ACTIVITY_QUICK_RANGES = {
  TODAY: "today",
  YESTERDAY: "yesterday",
  THIS_WEEK: "this_week",
  THIS_MONTH: "this_month",
} as const

export type ActivityQuickRange =
  (typeof ACTIVITY_QUICK_RANGES)[keyof typeof ACTIVITY_QUICK_RANGES]

export const ACTIVITY_QUICK_RANGE_OPTIONS: Array<{
  value: ActivityQuickRange
  label: string
}> = [
  { value: ACTIVITY_QUICK_RANGES.TODAY, label: "Hoy" },
  { value: ACTIVITY_QUICK_RANGES.YESTERDAY, label: "Ayer" },
  { value: ACTIVITY_QUICK_RANGES.THIS_WEEK, label: "Esta semana" },
  { value: ACTIVITY_QUICK_RANGES.THIS_MONTH, label: "Este mes" },
]

function startOfLocalDay(reference: Date): Date {
  const date = new Date(reference)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfLocalDay(reference: Date): Date {
  const date = new Date(reference)
  date.setHours(23, 59, 59, 999)
  return date
}

/** Monday-based week start (local timezone). */
function startOfLocalWeek(reference: Date): Date {
  const date = startOfLocalDay(reference)
  const day = date.getDay()
  const mondayOffset = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - mondayOffset)
  return date
}

function startOfLocalMonth(reference: Date): Date {
  const date = startOfLocalDay(reference)
  date.setDate(1)
  return date
}

export function resolveActivityQuickRange(
  preset: ActivityQuickRange,
  reference = new Date()
): { from: string; to: string } {
  if (preset === ACTIVITY_QUICK_RANGES.TODAY) {
    return {
      from: startOfLocalDay(reference).toISOString(),
      to: endOfLocalDay(reference).toISOString(),
    }
  }

  if (preset === ACTIVITY_QUICK_RANGES.YESTERDAY) {
    const yesterday = new Date(reference)
    yesterday.setDate(yesterday.getDate() - 1)
    return {
      from: startOfLocalDay(yesterday).toISOString(),
      to: endOfLocalDay(yesterday).toISOString(),
    }
  }

  if (preset === ACTIVITY_QUICK_RANGES.THIS_WEEK) {
    return {
      from: startOfLocalWeek(reference).toISOString(),
      to: endOfLocalDay(reference).toISOString(),
    }
  }

  return {
    from: startOfLocalMonth(reference).toISOString(),
    to: endOfLocalDay(reference).toISOString(),
  }
}

/** Match preset when from/to align within 1s (ISO round-trip tolerance). */
export function matchActivityQuickRange(
  from: string | undefined,
  to: string | undefined,
  reference = new Date()
): ActivityQuickRange | null {
  if (!from || !to) return null

  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime()
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null

  for (const option of ACTIVITY_QUICK_RANGE_OPTIONS) {
    const range = resolveActivityQuickRange(option.value, reference)
    if (
      Math.abs(new Date(range.from).getTime() - fromMs) < 1000 &&
      Math.abs(new Date(range.to).getTime() - toMs) < 1000
    ) {
      return option.value
    }
  }

  return null
}

export type EmployeeActivitySummary = {
  eventsRegistered: number
  tasksCreated: number
  tasksScheduled: number
  tasksStarted: number
  tasksFinished: number
  consultationsAttended: number
  lastActivityAt: string | null
}

const CONSULTATION_ATTENDED_ACTIONS = new Set<string>([
  ACTIVITY_ACTIONS.ATENCION_REGISTER_INTERACTION,
  ACTIVITY_ACTIONS.ATENCION_RESOLVE,
  ACTIVITY_ACTIONS.ATENCION_CLOSE,
])

function countByAction(
  entries: ActivityViewerEntry[],
  action: string
): number {
  return entries.reduce(
    (total, entry) => total + (String(entry.action) === action ? 1 : 0),
    0
  )
}

/** Metrics from already-loaded events (no server aggregation). */
export function buildEmployeeActivitySummary(
  entries: ActivityViewerEntry[]
): EmployeeActivitySummary {
  let lastActivityAt: string | null = null

  for (const entry of entries) {
    if (
      !lastActivityAt ||
      new Date(entry.createdAt).getTime() > new Date(lastActivityAt).getTime()
    ) {
      lastActivityAt = entry.createdAt
    }
  }

  return {
    eventsRegistered: entries.length,
    tasksCreated: countByAction(entries, ACTIVITY_ACTIONS.TASK_CREATE),
    tasksScheduled: countByAction(entries, ACTIVITY_ACTIONS.TASK_SCHEDULE),
    tasksStarted: countByAction(entries, ACTIVITY_ACTIONS.TASK_START),
    tasksFinished: countByAction(entries, ACTIVITY_ACTIONS.TASK_APPROVE),
    consultationsAttended: entries.reduce(
      (total, entry) =>
        total +
        (CONSULTATION_ATTENDED_ACTIONS.has(String(entry.action)) ? 1 : 0),
      0
    ),
    lastActivityAt,
  }
}

export type EmployeeActivityDayGroup = {
  dayKey: string
  label: string
  entries: ActivityViewerEntry[]
}

function toLocalDayKey(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number)
  if (!year || !month || !day) return dayKey

  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

/** Days newest-first; within each day, chronological ascending. */
export function groupEmployeeActivityByDay(
  entries: ActivityViewerEntry[]
): EmployeeActivityDayGroup[] {
  const byDay = new Map<string, ActivityViewerEntry[]>()

  for (const entry of entries) {
    const dayKey = toLocalDayKey(entry.createdAt)
    const bucket = byDay.get(dayKey)
    if (bucket) {
      bucket.push(entry)
    } else {
      byDay.set(dayKey, [entry])
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dayKey, dayEntries]) => ({
      dayKey,
      label: formatDayLabel(dayKey),
      entries: [...dayEntries].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()
      ),
    }))
}

export function formatEmployeeActivityLastSeen(
  iso: string | null | undefined
): string {
  if (!iso) return "Sin actividad"
  return formatActivityDisplayTimestamp(iso)
}

export function describeEmployeeTimelineEntry(entry: ActivityViewerEntry): {
  title: string
  subtitle: string
  timeLabel: string
} {
  return {
    title: formatActivityActionLabel(String(entry.action)),
    subtitle: [
      formatActivityModuleLabel(String(entry.module)),
      entry.detail?.trim() || null,
    ]
      .filter(Boolean)
      .join(" · "),
    timeLabel: new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(entry.createdAt)),
  }
}
