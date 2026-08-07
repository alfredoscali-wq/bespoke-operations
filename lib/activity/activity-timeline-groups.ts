import type {
  ActivityTimelineEvent,
  ActivityTimelineGroupId,
} from "@/lib/activity/activity-timeline-types"

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Monday-based start of the local calendar week. */
function startOfLocalWeek(date: Date): Date {
  const day = startOfLocalDay(date)
  const weekday = day.getDay()
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1
  day.setDate(day.getDate() - daysFromMonday)
  return day
}

export function resolveActivityTimelineGroupId(
  createdAt: string,
  now: Date = new Date()
): ActivityTimelineGroupId {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return "older"

  const today = startOfLocalDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekStart = startOfLocalWeek(now)

  if (created >= today) return "today"
  if (created >= yesterday) return "yesterday"
  if (created >= weekStart) return "this_week"
  return "older"
}

export type ActivityTimelineGroupedSection = {
  id: ActivityTimelineGroupId
  items: ActivityTimelineEvent[]
}

const GROUP_ORDER: ActivityTimelineGroupId[] = [
  "today",
  "yesterday",
  "this_week",
  "older",
]

export function groupActivityTimelineEvents(
  items: ActivityTimelineEvent[],
  now: Date = new Date()
): ActivityTimelineGroupedSection[] {
  const buckets: Record<ActivityTimelineGroupId, ActivityTimelineEvent[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    older: [],
  }

  for (const item of items) {
    buckets[resolveActivityTimelineGroupId(item.createdAt, now)].push(item)
  }

  return GROUP_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
    id,
    items: buckets[id],
  }))
}

export function formatActivityTimelineTime(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return createdAt

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
}

export function formatActivityTimelineDate(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ""

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

const DAY_ACTIVITY_MONTH_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const

function formatActivityTimelineClockHm(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function formatActivityTimelineDayMonthYear(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0")
  const month = DAY_ACTIVITY_MONTH_SHORT[date.getMonth()] ?? ""
  return `${day} ${month} ${date.getFullYear()}`
}

/**
 * Actividad de la Jornada — visible date + time for multi-day periods.
 * Examples: "Hoy · 12:53" | "Ayer · 14:22" | "07 Ago 2026 · 12:53"
 */
export function formatDayActivityTimelineStamp(
  createdAt: string,
  now: Date = new Date()
): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return createdAt

  const time = formatActivityTimelineClockHm(date)
  const group = resolveActivityTimelineGroupId(createdAt, now)

  if (group === "today") return `Hoy · ${time}`
  if (group === "yesterday") return `Ayer · ${time}`
  return `${formatActivityTimelineDayMonthYear(date)} · ${time}`
}

export function toTimelineDateFromInput(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

export function toTimelineDateToInput(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T23:59:59.999`)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

export function timelineIsoToDateInput(value: string | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
