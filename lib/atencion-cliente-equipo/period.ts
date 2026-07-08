import {
  endOfWeekSunday,
  startOfWeekMonday,
  toDateKey,
} from "@/lib/customer-seguimientos/agenda"

export type EquipoReportPeriod = "hoy" | "semana" | "mes"

export type EquipoReportPeriodBounds = {
  start: string
  end: string
  startDateKey: string
  endDateKey: string
}

export function resolveEquipoReportPeriodBounds(
  period: EquipoReportPeriod,
  referenceDate = new Date()
): EquipoReportPeriodBounds {
  switch (period) {
    case "hoy": {
      const start = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        referenceDate.getDate(),
        0,
        0,
        0,
        0
      )
      const end = new Date(start)
      end.setDate(end.getDate() + 1)

      return {
        start: start.toISOString(),
        end: end.toISOString(),
        startDateKey: toDateKey(start),
        endDateKey: toDateKey(start),
      }
    }
    case "semana": {
      const weekStart = startOfWeekMonday(referenceDate)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = endOfWeekSunday(referenceDate)
      const end = new Date(weekEnd)
      end.setDate(end.getDate() + 1)
      end.setHours(0, 0, 0, 0)

      return {
        start: weekStart.toISOString(),
        end: end.toISOString(),
        startDateKey: toDateKey(weekStart),
        endDateKey: toDateKey(weekEnd),
      }
    }
    case "mes": {
      const start = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        1,
        0,
        0,
        0,
        0
      )
      const end = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth() + 1,
        1,
        0,
        0,
        0,
        0
      )
      const monthEnd = new Date(end)
      monthEnd.setDate(monthEnd.getDate() - 1)

      return {
        start: start.toISOString(),
        end: end.toISOString(),
        startDateKey: toDateKey(start),
        endDateKey: toDateKey(monthEnd),
      }
    }
  }
}

export function formatEquipoReportPeriodLabel(period: EquipoReportPeriod): string {
  switch (period) {
    case "hoy":
      return "Hoy"
    case "semana":
      return "Semana"
    case "mes":
      return "Mes"
  }
}
