import type { ActivityTimelineEvent } from "@/lib/activity/activity-timeline-types"

export type DayGestionStatusTone = "done" | "pending" | "new" | "cancelled"

export type DayGestionLink = {
  kind: "customer" | "attention" | "workorder" | "employee" | "project" | "request"
  href: string
  label: string
}

export type DayGestionField = {
  label: string
  value: string
}

/**
 * One business “gestión” rebuilt from one or more Activity Engine events.
 * Presentation-only — never persisted.
 */
export type DayGestion = {
  id: string
  domain: "attention" | "generic"
  startedAt: string
  endedAt: string
  title: string
  statusLabel: string
  statusTone: DayGestionStatusTone
  fields: DayGestionField[]
  links: DayGestionLink[]
  /** Raw events for “Ver detalle técnico”. */
  events: ActivityTimelineEvent[]
  customerId: string | null
  attentionId: string | null
  workOrderId: string | null
}

export type DayGestionNameMaps = {
  customers: ReadonlyMap<string, string>
  employees: ReadonlyMap<string, string>
}
