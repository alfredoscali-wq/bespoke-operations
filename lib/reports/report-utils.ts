import { isDateOnly } from "@/lib/dates/date-only"
import type { ReportFilters, ReportPeriod } from "@/lib/reports/report-filters"

export type ReportPeriodRange = {
  startDate: string
  endDate: string
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function toDateOnlyString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function extractDatePortion(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null
  }

  const trimmed = value.trim()
  if (isDateOnly(trimmed)) {
    return trimmed
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return toDateOnlyString(parsed)
}

function startOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  result.setHours(12, 0, 0, 0)
  return result
}

function endOfWeek(date: Date): Date {
  const result = startOfWeek(date)
  result.setDate(result.getDate() + 6)
  return result
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0)
}

export function resolveReportPeriodRange(
  filters: Pick<ReportFilters, "period" | "startDate" | "endDate">,
  referenceDate = new Date()
): ReportPeriodRange {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  )

  switch (filters.period) {
    case "today":
      return {
        startDate: toDateOnlyString(today),
        endDate: toDateOnlyString(today),
      }
    case "week":
      return {
        startDate: toDateOnlyString(startOfWeek(today)),
        endDate: toDateOnlyString(endOfWeek(today)),
      }
    case "month":
      return {
        startDate: toDateOnlyString(startOfMonth(today)),
        endDate: toDateOnlyString(endOfMonth(today)),
      }
    case "last30": {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      return {
        startDate: toDateOnlyString(start),
        endDate: toDateOnlyString(today),
      }
    }
    case "custom":
      return {
        startDate: filters.startDate?.trim() ?? "",
        endDate: filters.endDate?.trim() ?? "",
      }
    default:
      return {
        startDate: toDateOnlyString(startOfMonth(today)),
        endDate: toDateOnlyString(endOfMonth(today)),
      }
  }
}

export function formatReportPeriodLabel(period: ReportPeriod): string {
  switch (period) {
    case "today":
      return "Hoy"
    case "week":
      return "Esta semana"
    case "month":
      return "Este mes"
    case "last30":
      return "Últimos 30 días"
    case "custom":
      return "Personalizado"
  }
}

export function calculateComplianceRate(
  completed: number,
  programmed: number
): number {
  if (programmed <= 0) {
    return 0
  }

  return Math.round((completed / programmed) * 100)
}

export function formatComplianceValue(compliance: number): string {
  return `${compliance}%`
}
