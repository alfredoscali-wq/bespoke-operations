/**
 * Crew Production Read Model — Sprint 21 / Bloque H.
 * Single jornada/period snapshot for Producción de Cuadrillas.
 */

import type { ExecutiveBrief } from "@/lib/executive/types"

export type CrewProductionKpiId =
  | "activeCrews"
  | "finishedOt"
  | "pendingOt"
  | "hoursWorked"
  | "avgProductivity"
  | "avgMinutesPerOt"

export type CrewProductionKpis = {
  activeCrews: number
  finishedOt: number
  pendingOt: number
  /** Completed estimated hours (decimal). */
  hoursWorked: number
  /** 0–100 compliance average across crews with programmed OT. */
  avgProductivity: number
  /** Average minutes per finished OT. */
  avgMinutesPerOt: number
}

export type CrewProductionStatus = "activa" | "inactiva" | "en-campo" | "sin-datos"

export type CrewProductionRankingRow = {
  crewId: string
  crewName: string
  memberCount: number
  status: CrewProductionStatus
  statusLabel: string
  finishedOt: number
  pendingOt: number
  avgMinutesPerOt: number
  productivity: number
}

export type CrewProductionIndicator = {
  id: string
  label: string
  value: number | string
  unit?: string | null
}

export type CrewProductionIntervention = {
  taskId: string
  workOrderLabel: string
  result: string
  durationMinutes: number
  customerName: string
  status: string
  statusLabel: string
}

export type CrewProductionDetail = {
  crewId: string
  crewName: string
  narrative: string
  indicators: CrewProductionIndicator[]
  journey: CrewProductionIntervention[]
}

/**
 * Complete screen payload — UI consumes only this object.
 */
export type CrewProductionReadModel = {
  date: string
  builtAt: number
  /** Company Executive Brief from Indicator Facade (no Activity Engine in UI). */
  executiveBrief: ExecutiveBrief
  kpis: CrewProductionKpis
  ranking: CrewProductionRankingRow[]
  detailsByCrewId: Record<string, CrewProductionDetail>
}

export type CrewProductionSourceCrew = {
  id: string
  name: string
  status: string
  memberCount: number
}

export type CrewProductionSourceTask = {
  id: string
  code: string
  title: string
  status: string
  dueDate: string
  estimatedDuration: string
  customerName?: string
  projectName?: string
  crewId?: string
  crew: string
  workOrderNumber?: string
  taskMetadata?: Record<string, unknown>
}
