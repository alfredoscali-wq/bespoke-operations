import { formatDateOnly } from "@/lib/dates/date-only"
import type { ReportPeriodRange } from "@/lib/reports/report-utils"
import { toDateOnlyString } from "@/lib/reports/report-utils"

/**
 * Semana informada al ejecutar el cron los lunes:
 * lunes a domingo de la semana calendario anterior.
 */
export function resolveInformedWeekRange(
  referenceDate = new Date()
): ReportPeriodRange {
  const ref = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  )

  const day = ref.getDay()
  const daysBackToLastSunday = day === 0 ? 0 : day
  const lastSunday = new Date(ref)
  lastSunday.setDate(ref.getDate() - daysBackToLastSunday)

  const lastMonday = new Date(lastSunday)
  lastMonday.setDate(lastSunday.getDate() - 6)

  return {
    startDate: toDateOnlyString(lastMonday),
    endDate: toDateOnlyString(lastSunday),
  }
}

export function formatInformedWeekLabel(range: ReportPeriodRange): string {
  if (!range.startDate || !range.endDate) {
    return "—"
  }

  return `${formatDateOnly(range.startDate)} — ${formatDateOnly(range.endDate)}`
}

export function resolveIsoWeekNumber(range: ReportPeriodRange): number {
  const anchor = new Date(`${range.endDate}T12:00:00`)
  const target = new Date(anchor.valueOf())
  const dayNr = (target.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }

  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604_800_000)
}
