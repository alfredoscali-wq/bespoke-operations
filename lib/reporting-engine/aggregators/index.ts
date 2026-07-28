import type { ReportingPeriod, ReportingRange } from "@/lib/reporting-engine/types"

function toDateOnlyIso(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) {
    return new Date(value)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return new Date(Date.UTC(year, month - 1, day))
}

function buildPeriod(
  kind: ReportingPeriod["kind"],
  range: ReportingRange,
  rollingDays?: number
): ReportingPeriod {
  return rollingDays != null ? { kind, range, rollingDays } : { kind, range }
}

/** Calendar day containing `reference` (UTC date-only for Foundation). */
export function aggregateDaily(reference: string | Date): ReportingPeriod {
  const date =
    typeof reference === "string" ? parseDateOnly(reference) : reference
  const day = toDateOnlyIso(date)
  return buildPeriod("daily", { from: day, to: day })
}

/**
 * ISO-like week: Monday–Sunday containing `reference` (UTC date-only).
 * Full locale/timezone rules land in a later sprint.
 */
export function aggregateWeekly(reference: string | Date): ReportingPeriod {
  const date =
    typeof reference === "string" ? parseDateOnly(reference) : new Date(reference)
  const day = date.getUTCDay()
  const offsetToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() + offsetToMonday)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return buildPeriod("weekly", {
    from: toDateOnlyIso(monday),
    to: toDateOnlyIso(sunday),
  })
}

/** Calendar month containing `reference` (UTC). */
export function aggregateMonthly(reference: string | Date): ReportingPeriod {
  const date =
    typeof reference === "string" ? parseDateOnly(reference) : new Date(reference)
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return buildPeriod("monthly", {
    from: toDateOnlyIso(from),
    to: toDateOnlyIso(to),
  })
}

/** Last `days` ending on `end` (inclusive). */
export function aggregateRolling(
  end: string | Date,
  days: number
): ReportingPeriod {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 1
  const endDate = typeof end === "string" ? parseDateOnly(end) : new Date(end)
  const startDate = new Date(endDate)
  startDate.setUTCDate(endDate.getUTCDate() - (safeDays - 1))
  return buildPeriod(
    "rolling",
    { from: toDateOnlyIso(startDate), to: toDateOnlyIso(endDate) },
    safeDays
  )
}

/** Explicit inclusive range. */
export function aggregateCustomRange(from: string, to: string): ReportingPeriod {
  return buildPeriod("custom-range", { from, to })
}
