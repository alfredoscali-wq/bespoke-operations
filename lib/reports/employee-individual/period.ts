import { compareDateOnly, isDateOnly } from "@/lib/dates/date-only"
import {
  extractDatePortion,
  toDateOnlyString,
} from "@/lib/reports/report-utils"

export type EmployeeReportPeriod = "hoy" | "semana" | "mes" | "personalizado"

export type EmployeeReportPeriodBounds = {
  startDate: string
  endDate: string
  label: string
}

function startOfWeekMonday(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  result.setHours(12, 0, 0, 0)
  return result
}

function endOfWeekSunday(date: Date): Date {
  const start = startOfWeekMonday(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return end
}

export function formatEmployeeReportPeriodLabel(
  period: EmployeeReportPeriod
): string {
  switch (period) {
    case "hoy":
      return "Hoy"
    case "semana":
      return "Semana"
    case "mes":
      return "Mes"
    case "personalizado":
      return "Personalizado"
  }
}

export function resolveEmployeeReportPeriodBounds(input: {
  period: EmployeeReportPeriod
  customStartDate?: string | null
  customEndDate?: string | null
  referenceDate?: Date
}): EmployeeReportPeriodBounds {
  const referenceDate = input.referenceDate ?? new Date()
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  )

  switch (input.period) {
    case "hoy":
      return {
        startDate: toDateOnlyString(today),
        endDate: toDateOnlyString(today),
        label: "Hoy",
      }
    case "semana":
      return {
        startDate: toDateOnlyString(startOfWeekMonday(today)),
        endDate: toDateOnlyString(endOfWeekSunday(today)),
        label: "Semana",
      }
    case "mes": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12, 0, 0, 0)
      return {
        startDate: toDateOnlyString(start),
        endDate: toDateOnlyString(end),
        label: "Mes",
      }
    }
    case "personalizado": {
      const start =
        input.customStartDate && isDateOnly(input.customStartDate)
          ? input.customStartDate
          : toDateOnlyString(today)
      const end =
        input.customEndDate && isDateOnly(input.customEndDate)
          ? input.customEndDate
          : start
      const ordered =
        compareDateOnly(start, end) <= 0
          ? { startDate: start, endDate: end }
          : { startDate: end, endDate: start }

      return {
        ...ordered,
        label: `${ordered.startDate} → ${ordered.endDate}`,
      }
    }
  }
}

export function isDateWithinEmployeeReportBounds(
  value: string | null | undefined,
  bounds: Pick<EmployeeReportPeriodBounds, "startDate" | "endDate">
): boolean {
  const date = extractDatePortion(value)
  if (!date) {
    return false
  }

  return (
    compareDateOnly(date, bounds.startDate) >= 0 &&
    compareDateOnly(date, bounds.endDate) <= 0
  )
}

/** Map to Equipo report period when loading Atención metrics (no custom). */
export function toEquipoReportPeriod(
  period: EmployeeReportPeriod
): "hoy" | "semana" | "mes" {
  if (period === "personalizado") {
    return "mes"
  }
  return period
}
