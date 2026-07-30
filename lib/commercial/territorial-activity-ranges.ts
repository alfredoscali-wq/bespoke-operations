const TIMEZONE = "America/Argentina/Buenos_Aires"

export const COMMERCIAL_TERRITORIAL_ACTIVITY_RANGES = ["today"] as const

export type CommercialTerritorialActivityRange =
  (typeof COMMERCIAL_TERRITORIAL_ACTIVITY_RANGES)[number]

export const COMMERCIAL_TERRITORIAL_ACTIVITY_RANGE_LABELS: Record<
  CommercialTerritorialActivityRange,
  string
> = {
  today: "Hoy",
}

export function isCommercialTerritorialActivityRange(
  value: string | null | undefined
): value is CommercialTerritorialActivityRange {
  return (
    typeof value === "string" &&
    (COMMERCIAL_TERRITORIAL_ACTIVITY_RANGES as readonly string[]).includes(value)
  )
}

/** Calendar day key (YYYY-MM-DD) in Argentina, regardless of client timezone. */
export function commercialTerritorialActivityDayKey(
  value: string | Date
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

/** Half-open window [fromIso, toIso) covering the current Argentina day. */
export function resolveCommercialTerritorialActivityTodayWindow(
  reference = new Date()
): { fromIso: string; toIso: string } {
  const dayKey = commercialTerritorialActivityDayKey(reference)
  const from = new Date(`${dayKey}T00:00:00-03:00`)
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000)
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}

export function buildCommercialTerritorialActivitiesHref(
  range?: CommercialTerritorialActivityRange
): string {
  const base = "/gestion-comercial/actividad-comercial"
  return range ? `${base}?range=${range}` : base
}
