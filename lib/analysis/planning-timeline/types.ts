/**
 * PlanningTimelineReadModel — Sprint 24 / Bloque J.
 * Operational story of one crew day. No Activity Engine. No technical logs.
 */

import type { ExecutiveBrief } from "@/lib/executive/types"

export type PlanningTimelineWorkOrderOutcome =
  | "finished"
  | "rescheduled"
  | "cancelled"
  | "pending"
  | "incident"

export type PlanningTimelineDayStartCard = {
  kind: "day-start"
  id: string
  sortKey: string
  timeLabel: string
  crewName: string
  memberNames: string[]
  vehicleLabel: string | null
}

export type PlanningTimelineTravelCard = {
  kind: "travel"
  id: string
  sortKey: string
  fromLabel: string
  toLabel: string
  minutes: number
}

export type PlanningTimelineWorkOrderCard = {
  kind: "work-order"
  id: string
  sortKey: string
  timeLabel: string
  customerName: string
  workType: string
  result: string
  outcome: PlanningTimelineWorkOrderOutcome
  durationMinutes: number
  taskId: string
  customerId: string | null
}

export type PlanningTimelineIncidentCard = {
  kind: "incident"
  id: string
  sortKey: string
  timeLabel: string
  title: string
  detail: string | null
  taskId: string | null
}

export type PlanningTimelineDayEndCard = {
  kind: "day-end"
  id: string
  sortKey: string
  summary: string
}

export type PlanningTimelineCard =
  | PlanningTimelineDayStartCard
  | PlanningTimelineTravelCard
  | PlanningTimelineWorkOrderCard
  | PlanningTimelineIncidentCard
  | PlanningTimelineDayEndCard

export type PlanningTimelineSummary = {
  finishedOt: number
  pendingOt: number
  avgMinutesPerOt: number
  productivity: number
  distanceKm: number | null
  travelMinutes: number
  hoursWorked: number
}

/**
 * Complete screen payload — UI consumes only this object.
 */
export type PlanningTimelineReadModel = {
  date: string
  builtAt: number
  crewId: string
  crewName: string
  /** Executive Brief from Indicator Facade (company day; no Activity Engine in UI). */
  executiveBrief: ExecutiveBrief
  summary: PlanningTimelineSummary
  cards: PlanningTimelineCard[]
}

export type PlanningTimelineSourceMember = {
  name: string
  role: string
  active: boolean
}

export type PlanningTimelineSourceCrew = {
  id: string
  name: string
  status: string
  habitualStartTime: string | null
  operationalBaseName: string | null
  vehicleLabel: string | null
  members: PlanningTimelineSourceMember[]
}

export type PlanningTimelineSourceTask = {
  id: string
  title: string
  status: string
  dueDate: string
  estimatedDuration: string
  scheduledTime: string | null
  customerName: string | null
  customerId: string | null
  serviceType: string | null
  serviceAddress: string | null
  locality: string | null
  crewId: string | null
  crew: string
  dispatchOrder: number | null
  executionOrder: number | null
  incidentReason: string | null
  incidentObservation: string | null
  taskMetadata: Record<string, unknown>
}
