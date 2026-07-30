import {
  COMMERCIAL_STATUS_CODES,
  type CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"

export const COMMERCIAL_OPPORTUNITY_LIST_VIEWS = [
  "active",
  "derivations",
  "followups",
  "activity_today",
  "nueva",
  "won",
  "lost",
  "won_month",
  "lost_month",
  "inactive_7d",
] as const

export type CommercialOpportunityListView =
  (typeof COMMERCIAL_OPPORTUNITY_LIST_VIEWS)[number]

export const COMMERCIAL_OPEN_STATUSES: readonly CommercialStatusCode[] = [
  "nueva",
  "contactada",
  "calificada",
  "propuesta_enviada",
  "negociacion",
] as const

export const COMMERCIAL_OPPORTUNITY_LIST_VIEW_LABELS: Record<
  CommercialOpportunityListView,
  string
> = {
  active: "Clientes activos",
  derivations: "Derivaciones nuevas",
  followups: "Seguimientos pendientes",
  activity_today: "Actividad realizada hoy",
  nueva: "Nuevas",
  won: "Ganadas",
  lost: "Perdidas",
  won_month: "Ganadas este mes",
  lost_month: "Perdidas este mes",
  inactive_7d: "Sin actividad +7 días",
}

export function isCommercialOpportunityListView(
  value: string | null | undefined
): value is CommercialOpportunityListView {
  return (
    typeof value === "string" &&
    (COMMERCIAL_OPPORTUNITY_LIST_VIEWS as readonly string[]).includes(value)
  )
}

export function buildCommercialOpportunitiesHref(
  view: CommercialOpportunityListView
): string {
  return `/gestion-comercial/oportunidades?view=${view}`
}

const TIMEZONE = "America/Argentina/Buenos_Aires"

function formatInTimeZone(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    ...options,
  }).format(date)
}

/** Month start (Argentina) as ISO — mirrors home KPI window. */
export function resolveCommercialMonthStartIso(reference = new Date()): string {
  const todayKey = formatInTimeZone(reference, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const monthKey = todayKey.slice(0, 7)
  return new Date(`${monthKey}-01T00:00:00-03:00`).toISOString()
}

export function filterOpportunitiesByListView(
  opportunities: CommercialOpportunityListItem[],
  view: CommercialOpportunityListView | null,
  options?: {
    inactiveOpportunityIds?: ReadonlySet<string>
    followupOpportunityIds?: ReadonlySet<string>
    activityTodayOpportunityIds?: ReadonlySet<string>
  }
): CommercialOpportunityListItem[] {
  if (!view) return opportunities

  const monthStartIso = resolveCommercialMonthStartIso()

  switch (view) {
    case "active":
      return opportunities.filter((entry) =>
        COMMERCIAL_OPEN_STATUSES.includes(entry.status)
      )
    case "derivations":
      return opportunities.filter(
        (entry) =>
          entry.source === "atencion_cliente" && !entry.sellerOpenedAt
      )
    case "followups":
      return opportunities.filter((entry) =>
        options?.followupOpportunityIds?.has(entry.id)
      )
    case "activity_today":
      return opportunities.filter((entry) =>
        options?.activityTodayOpportunityIds?.has(entry.id)
      )
    case "nueva":
      return opportunities.filter((entry) => entry.status === "nueva")
    case "won":
      return opportunities.filter((entry) => entry.status === "ganada")
    case "lost":
      return opportunities.filter((entry) => entry.status === "perdida")
    case "won_month":
      return opportunities.filter(
        (entry) =>
          entry.status === "ganada" && entry.updatedAt >= monthStartIso
      )
    case "lost_month":
      return opportunities.filter(
        (entry) =>
          entry.status === "perdida" && entry.updatedAt >= monthStartIso
      )
    case "inactive_7d": {
      const ids = options?.inactiveOpportunityIds
      if (!ids) return []
      return opportunities.filter(
        (entry) =>
          COMMERCIAL_OPEN_STATUSES.includes(entry.status) && ids.has(entry.id)
      )
    }
    default: {
      const _exhaustive: never = view
      return _exhaustive
    }
  }
}

export function isKnownCommercialStatus(
  value: string
): value is CommercialStatusCode {
  return (COMMERCIAL_STATUS_CODES as readonly string[]).includes(value)
}
