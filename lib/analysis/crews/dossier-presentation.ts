/**
 * Cuadrillas dossier presentation — Sprint 27.
 * Pure UI helpers over the existing Read Model. No I/O, no KPI formula changes.
 */

import {
  formatAnalysisDateRangeTriggerLabel,
  formatAnalysisDateShort,
  parseAnalysisDateOnly,
  type AnalysisDateRangePreset,
} from "@/lib/analysis/date-range"
import type {
  CrewsDossier,
  CrewsProductivityKpis,
  CrewsWorkOrderRow,
} from "@/lib/analysis/crews/types"

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const

export type CrewsPeriodMeta = {
  preset: AnalysisDateRangePreset
  dateFrom: string
  dateTo: string
  focusDate: string
}

export type CrewsDayJourneySummary = {
  assignedOt: number
  finishedOt: number
  rescheduledOt: number
  cancelledOt: number
  pendingOt: number
  compliance: number
  avgMinutesPerOt: number
  /** Whole minutes worked (finished OT durations). */
  workedMinutes: number
}

export type CrewsDayJourney = {
  date: string
  heading: string
  summary: CrewsDayJourneySummary
  workOrders: CrewsWorkOrderRow[]
}

/** Single calendar day → keep the existing continuous Timeline. */
export function isCrewsSingleDayPeriod(period: CrewsPeriodMeta): boolean {
  if (period.preset === "today" || period.preset === "yesterday") return true
  return period.dateFrom === period.dateTo
}

export function resolveCrewsDossierTitle(period: CrewsPeriodMeta): {
  title: string
  subtitle: string | null
} {
  switch (period.preset) {
    case "today":
    case "yesterday":
      return { title: "Jornada de la Cuadrilla", subtitle: null }
    case "last_7_days":
      return { title: "Semana Operativa de la Cuadrilla", subtitle: null }
    case "this_month":
    case "last_month":
      return { title: "Producción Mensual de la Cuadrilla", subtitle: null }
    case "last_30_days":
      return { title: "Producción de la Cuadrilla", subtitle: null }
    case "custom":
      return {
        title: "Producción de la Cuadrilla",
        subtitle: `${formatAnalysisDateShort(period.dateFrom)} → ${formatAnalysisDateShort(period.dateTo)}`,
      }
    default:
      return { title: "Jornada de la Cuadrilla", subtitle: null }
  }
}

export function formatCrewsPeriodLabel(period: CrewsPeriodMeta): string {
  if (period.preset === "custom") {
    return `${formatAnalysisDateShort(period.dateFrom)} → ${formatAnalysisDateShort(period.dateTo)}`
  }
  return formatAnalysisDateRangeTriggerLabel(
    {
      preset: period.preset,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
    },
    period.focusDate
  )
}

export function formatCrewsDayHeading(dateOnly: string): string {
  const date = parseAnalysisDateOnly(dateOnly)
  const weekday = WEEKDAYS[date.getDay()] ?? ""
  const day = date.getDate()
  const month = MONTHS[date.getMonth()] ?? ""
  return `${weekday} ${day} de ${month}`
}

export function formatCrewsWorkedDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 min"
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  if (hours <= 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${String(minutes).padStart(2, "0")} min`
}

export function formatCrewsHoursWorkedLabel(hours: number): string {
  if (hours <= 0) return "0 h"
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  if (minutes <= 0) return `${whole} h`
  return `${whole} h ${String(minutes).padStart(2, "0")} min`
}

const FINISHED = new Set(["finalizada", "cerrada"])
const CANCELLED = new Set(["cancelada"])
const PENDING = new Set([
  "asignada",
  "programada",
  "en-curso",
  "vencida",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
])

function isRescheduledRow(row: CrewsWorkOrderRow): boolean {
  const result = row.result.toLocaleLowerCase("es")
  return result.includes("reprogram")
}

function summarizeWorkOrders(rows: CrewsWorkOrderRow[]): CrewsDayJourneySummary {
  const finished = rows.filter((row) => FINISHED.has(row.status))
  const cancelled = rows.filter((row) => CANCELLED.has(row.status))
  const pending = rows.filter((row) => PENDING.has(row.status))
  const rescheduled = rows.filter((row) => isRescheduledRow(row))
  const assigned = finished.length + pending.length + cancelled.length
  const workedMinutes = finished.reduce(
    (sum, row) => sum + Math.max(0, row.durationMinutes),
    0
  )
  const avgMinutes =
    finished.length > 0 ? Math.round(workedMinutes / finished.length) : 0
  const compliance =
    assigned > 0 ? Math.round((finished.length / assigned) * 100) : 0

  return {
    assignedOt: assigned,
    finishedOt: finished.length,
    rescheduledOt: rescheduled.length,
    cancelledOt: cancelled.length,
    pendingOt: pending.length,
    compliance,
    avgMinutesPerOt: avgMinutes,
    workedMinutes,
  }
}

/**
 * Group period work orders into day journeys (newest first for scanning).
 */
export function buildCrewsDayJourneys(
  workOrders: CrewsWorkOrderRow[]
): CrewsDayJourney[] {
  const byDate = new Map<string, CrewsWorkOrderRow[]>()

  for (const row of workOrders) {
    const date = row.dueDate?.trim()
    if (!date) continue
    const list = byDate.get(date) ?? []
    list.push(row)
    byDate.set(date, list)
  }

  const dates = [...byDate.keys()].sort((left, right) =>
    right.localeCompare(left)
  )

  return dates.map((date) => {
    const rows = [...(byDate.get(date) ?? [])].sort((left, right) =>
      (left.scheduledTime || "").localeCompare(right.scheduledTime || "", "es")
    )
    return {
      date,
      heading: formatCrewsDayHeading(date),
      summary: summarizeWorkOrders(rows),
      workOrders: rows,
    }
  })
}

export function resolveCrewsPeriodIncidents(dossier: CrewsDossier): number {
  return (
    dossier.quality.find((metric) => metric.id === "incidencias")?.count ?? 0
  )
}

export function resolveCrewsSidePeriodSummary(
  period: CrewsPeriodMeta,
  productivity: CrewsProductivityKpis,
  incidents: number
) {
  return {
    periodLabel: formatCrewsPeriodLabel(period),
    assignedOt: productivity.assignedOt,
    compliance: productivity.compliance,
    avgMinutesPerOt: productivity.avgMinutesPerOt,
    hoursWorkedLabel: formatCrewsHoursWorkedLabel(productivity.hoursWorked),
    incidents,
  }
}
