/**
 * CUADRILLAS screen Read Model — Sprint 25.
 * Integrates CrewProductionReadModel + PlanningTimelineReadModel.
 * UI consumes only this object.
 */

import type { CrewProductionReadModel } from "@/lib/analysis/crew-production/types"
import type { PlanningTimelineReadModel } from "@/lib/analysis/planning-timeline/types"
import type { CrewsPeriodPreset } from "@/lib/analysis/crews/period"

export type CrewsQualityMetricId =
  | "cliente-ausente"
  | "material-faltante"
  | "sin-acceso"
  | "incidencias"
  | "rechazos"

export type CrewsQualityMetric = {
  id: CrewsQualityMetricId
  label: string
  count: number
  percentage: number
}

export type CrewsWorkOrderRow = {
  taskId: string
  customerName: string
  status: string
  statusLabel: string
  result: string
  durationMinutes: number
  locality: string
  serviceType: string
  zone: string
  technology: string
  customerId: string | null
  /** Inclusive calendar day (YYYY-MM-DD) — presentation grouping only. */
  dueDate: string
  scheduledTime: string | null
  /** Travel minutes from previous stop when known. */
  travelFromPreviousMinutes: number | null
  travelFromLabel: string | null
}

export type CrewsTrendBucket = {
  id: "today" | "week" | "month"
  label: string
  finishedOt: number
  assignedOt: number
  pendingOt: number
  productivity: number
  avgMinutesPerOt: number
}

export type CrewsProductivityKpis = {
  assignedOt: number
  finishedOt: number
  pendingOt: number
  cancelledOt: number
  rescheduledOt: number
  compliance: number
  avgMinutesPerOt: number
  hoursWorked: number
}

export type CrewsRankingRow = {
  crewId: string
  crewName: string
  status: string
  statusLabel: string
  memberCount: number
  assignedOt: number
  finishedOt: number
  compliance: number
  avgMinutesPerOt: number
  productivity: number
}

/**
 * GPS coverage block — reserved, not implemented.
 */
export type CrewsGpsCoveragePlaceholder = {
  reserved: true
  title: string
  message: string
}

export type CrewsDossier = {
  crewId: string
  crewName: string
  narrative: string
  productivity: CrewsProductivityKpis
  quality: CrewsQualityMetric[]
  /** Integrated Sprint 24 timeline — not a separate screen. */
  timeline: PlanningTimelineReadModel
  workOrders: CrewsWorkOrderRow[]
  trends: CrewsTrendBucket[]
  gpsCoverage: CrewsGpsCoveragePlaceholder
}

/**
 * Single screen payload for CUADRILLAS.
 */
export type CrewsReadModel = {
  period: {
    preset: CrewsPeriodPreset
    dateFrom: string
    dateTo: string
    focusDate: string
  }
  builtAt: number
  /** Preserved production RM (Sprint 21). */
  production: CrewProductionReadModel
  ranking: CrewsRankingRow[]
  dossiersByCrewId: Record<string, CrewsDossier>
}
