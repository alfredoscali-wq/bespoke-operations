import type { CommercialActivityTypeCode } from "@/lib/commercial/activity-catalogs"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"

export const COMMERCIAL_TIMELINE_PAGE_SIZE = 20

export type CommercialTimelineFilter =
  | "all"
  | "llamada"
  | "whatsapp"
  | "email"
  | "visita"
  | "nota"
  | "tarea"
  | "sistema"
  | "cambio_estado"

export const COMMERCIAL_TIMELINE_FILTERS: ReadonlyArray<{
  id: CommercialTimelineFilter
  label: string
}> = [
  { id: "all", label: "Todos" },
  { id: "llamada", label: "Llamadas" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Emails" },
  { id: "visita", label: "Visitas" },
  { id: "nota", label: "Notas" },
  { id: "tarea", label: "Tareas" },
  { id: "sistema", label: "Sistema" },
  { id: "cambio_estado", label: "Cambio Estado" },
]

export type CommercialActivityStats = {
  total: number
  pending: number
  completed: number
}

export type CommercialTimelineDateGroup = {
  key: string
  label: string
  activities: CommercialActivityListItem[]
}

const WEEKDAY_LABELS = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIÉRCOLES",
  "JUEVES",
  "VIERNES",
  "SÁBADO",
] as const

const MONTH_LABELS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
] as const

export const COMMERCIAL_ACTIVITY_TYPE_TONE: Record<
  CommercialActivityTypeCode,
  { icon: string; badge: string }
> = {
  sistema: {
    icon: "bg-muted text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
  cambio_estado: {
    icon: "bg-blue-50 text-blue-600",
    badge: "bg-blue-50 text-blue-700",
  },
  derivacion: {
    icon: "bg-indigo-50 text-indigo-600",
    badge: "bg-indigo-50 text-indigo-700",
  },
  llamada: {
    icon: "bg-emerald-50 text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
  },
  whatsapp: {
    icon: "bg-emerald-100 text-emerald-800",
    badge: "bg-emerald-100 text-emerald-800",
  },
  email: {
    icon: "bg-sky-50 text-sky-600",
    badge: "bg-sky-50 text-sky-700",
  },
  visita: {
    icon: "bg-orange-50 text-orange-600",
    badge: "bg-orange-50 text-orange-700",
  },
  reunion: {
    icon: "bg-violet-50 text-violet-600",
    badge: "bg-violet-50 text-violet-700",
  },
  nota: {
    icon: "bg-muted text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
  tarea: {
    icon: "bg-destructive/10 text-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
  seguimiento: {
    icon: "bg-blue-100 text-blue-800",
    badge: "bg-blue-100 text-blue-800",
  },
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatCommercialTimelineGroupLabel(
  iso: string,
  now = new Date()
): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "SIN FECHA"

  const day = startOfLocalDay(date)
  const today = startOfLocalDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (day.getTime() === today.getTime()) return "HOY"
  if (day.getTime() === yesterday.getTime()) return "AYER"

  const weekday = WEEKDAY_LABELS[day.getDay()]
  const dayNumber = day.getDate()
  const month = MONTH_LABELS[day.getMonth()]
  return `${weekday} ${dayNumber} ${month}`
}

export function formatCommercialTimelineTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function groupCommercialActivitiesByDate(
  activities: CommercialActivityListItem[],
  now = new Date()
): CommercialTimelineDateGroup[] {
  const groups = new Map<string, CommercialTimelineDateGroup>()

  for (const activity of activities) {
    const date = new Date(activity.createdAt)
    const key = Number.isNaN(date.getTime())
      ? "invalid"
      : toDateKey(startOfLocalDay(date))
    const existing = groups.get(key)
    if (existing) {
      existing.activities.push(activity)
      continue
    }
    groups.set(key, {
      key,
      label: formatCommercialTimelineGroupLabel(activity.createdAt, now),
      activities: [activity],
    })
  }

  return Array.from(groups.values())
}

export function filterCommercialActivities(
  activities: CommercialActivityListItem[],
  filter: CommercialTimelineFilter
): CommercialActivityListItem[] {
  if (filter === "all") return activities
  return activities.filter((entry) => entry.activityTypeCode === filter)
}

export function computeCommercialActivityStats(
  activities: CommercialActivityListItem[]
): CommercialActivityStats {
  let pending = 0
  let completed = 0
  for (const activity of activities) {
    if (activity.status === "pending") pending += 1
    else if (activity.status === "completed") completed += 1
  }
  return {
    total: activities.length,
    pending,
    completed,
  }
}
