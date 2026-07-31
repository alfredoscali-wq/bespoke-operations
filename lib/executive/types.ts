import type { IndicatorSnapshot } from "@/lib/indicators"

export type ExecutiveBriefScopeKind =
  | "company"
  | "employee"
  | "crew"
  | "project"
  | "customer"

export type ExecutiveBriefScope = {
  kind: ExecutiveBriefScopeKind
  id?: string
  label?: string
}

export type ExecutiveMetric = {
  id: string
  label: string
  value: number
}

export type ExecutiveProductionBlock = {
  id: string
  title: string
  metrics: ExecutiveMetric[]
}

export type ExecutiveOperationalAlert = {
  id: string
  label: string
  value: number
}

export type ExecutiveRelevantActivityItem = {
  id: string
  createdAt: string
  action: string
  title: string
  description: string | null
  entityType: string
  entityId: string | null
}

/**
 * Reusable Executive Daily Brief structure.
 * Used by Sala de Situación and entity Producción views.
 * No PDF / email / automation in this sprint.
 */
export type ExecutiveBrief = {
  scope: ExecutiveBriefScope
  date: string
  /** One-minute narrative for supervisors. */
  narrative: string
  generalState: ExecutiveMetric[]
  production: ExecutiveProductionBlock[]
  operationalAlerts: ExecutiveOperationalAlert[]
  relevantActivity: ExecutiveRelevantActivityItem[]
  /** Full indicator snapshot for Detalle (audit of numbers). */
  snapshot: IndicatorSnapshot
  firstEventAt: string | null
  lastEventAt: string | null
  activeTimeMs: number
}
