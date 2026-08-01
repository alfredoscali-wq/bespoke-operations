/**
 * Resolve Análisis period presets to inclusive local date ranges.
 */

import type {
  AnalysisDateRangePreset,
  AnalysisDateRangeValue,
} from "@/lib/analysis/date-range/types"

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function toAnalysisDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseAnalysisDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function orderRange(from: string, to: string): { dateFrom: string; dateTo: string } {
  if (from <= to) return { dateFrom: from, dateTo: to }
  return { dateFrom: to, dateTo: from }
}

export function resolveAnalysisDateRange(input: {
  preset: AnalysisDateRangePreset
  dateFrom?: string | null
  dateTo?: string | null
  referenceDate?: Date | string
}): AnalysisDateRangeValue {
  const reference =
    typeof input.referenceDate === "string" && input.referenceDate.trim()
      ? parseAnalysisDateOnly(input.referenceDate.trim())
      : input.referenceDate instanceof Date
        ? startOfLocalDay(input.referenceDate)
        : startOfLocalDay(new Date())

  const today = startOfLocalDay(reference)

  switch (input.preset) {
    case "today": {
      const value = toAnalysisDateOnly(today)
      return { preset: "today", dateFrom: value, dateTo: value }
    }
    case "yesterday": {
      const value = toAnalysisDateOnly(addDays(today, -1))
      return { preset: "yesterday", dateFrom: value, dateTo: value }
    }
    case "last_7_days": {
      // Inclusive: today and the 6 previous days = 7 days.
      return {
        preset: "last_7_days",
        dateFrom: toAnalysisDateOnly(addDays(today, -6)),
        dateTo: toAnalysisDateOnly(today),
      }
    }
    case "last_30_days": {
      return {
        preset: "last_30_days",
        dateFrom: toAnalysisDateOnly(addDays(today, -29)),
        dateTo: toAnalysisDateOnly(today),
      }
    }
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1, 12)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12)
      return {
        preset: "this_month",
        dateFrom: toAnalysisDateOnly(start),
        dateTo: toAnalysisDateOnly(end),
      }
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12)
      const end = new Date(today.getFullYear(), today.getMonth(), 0, 12)
      return {
        preset: "last_month",
        dateFrom: toAnalysisDateOnly(start),
        dateTo: toAnalysisDateOnly(end),
      }
    }
    case "custom": {
      const from = input.dateFrom?.trim()
      const to = input.dateTo?.trim()
      if (!from || !to) {
        throw new Error(
          "El período personalizado requiere fecha Desde y Hasta."
        )
      }
      const ordered = orderRange(from, to)
      return {
        preset: "custom",
        dateFrom: ordered.dateFrom,
        dateTo: ordered.dateTo,
      }
    }
    default: {
      const value = toAnalysisDateOnly(today)
      return { preset: "today", dateFrom: value, dateTo: value }
    }
  }
}

export function createDefaultAnalysisDateRange(
  referenceDate?: Date | string
): AnalysisDateRangeValue {
  return resolveAnalysisDateRange({ preset: "today", referenceDate })
}

/** Focus / single-day snapshots use the inclusive end of the range. */
export function analysisDateRangeFocusDate(
  value: AnalysisDateRangeValue
): string {
  return value.dateTo
}
