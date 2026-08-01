/**
 * Planning Read Model — Sprint 19 / Bloque F.
 * Single jornada snapshot for Planning UI consumption.
 */

import type { CrewPlanningSummary } from "@/lib/engines/planning/contracts/CrewPlanningSummary"
import type { CrewPlanningButtonVisibility } from "@/lib/planificacion/planning-crew-state"
import type { PlanningDayOperationalConfig } from "@/lib/planificacion/planning-day-config"
import type { PlanningCrewSummary } from "@/lib/planificacion/planning-utils"
import type { Crew, CrewAvailability } from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"
import type { IncidentSummary } from "@/lib/types/task-incidents"
import type { Task } from "@/lib/types/tasks"

export type PlanningDispatchMode = "editing" | "confirmed"

/** Project/obra refs derived from OT (no separate projects fetch). */
export type PlanningObraRead = {
  id: string
  code: string
  name: string
}

/** Ordered agenda/journey OT ids for the selected crew (or all when unfiltered). */
export type PlanningAgendaRead = {
  crewId: string | null
  orderedTaskIds: string[]
}

export type PlanningReadMetrics = {
  overdueCount: number
  isConfirmedMode: boolean
  dispatchMode: PlanningDispatchMode
  crewSummaries: PlanningCrewSummary[]
  crewPlanningSummary: CrewPlanningSummary | null
  crewPlanningButtonsById: Record<string, CrewPlanningButtonVisibility>
}

export type PlanningReadTasks = {
  /** Work-order tasks in the current operational/overdue filter. */
  filtered: Task[]
  /** Filtered tasks sorted by dispatch route. */
  sorted: Task[]
  /** Crew-scoped list for map/list/journey. */
  list: Task[]
  /** Programmed tasks for the planning date (order scope). */
  planningOrderScope: Task[]
  /** Pending-closure tasks for the planning date. */
  pendingClosure: Task[]
}

export type PlanningReadDayConfig = {
  crew: Crew
  config: PlanningDayOperationalConfig
} | null

export type PlanningReadIncidents = {
  active: IncidentSummary[]
  activeCount: number
}

/**
 * Complete Planning jornada read snapshot.
 * UI must consume this object for reads — not raw entity providers.
 */
export type PlanningReadModel = {
  builtAt: number
  date: string
  crewFilterId: string | null
  overdueFilterActive: boolean
  crews: Crew[]
  employees: Employee[]
  availability: CrewAvailability[]
  obras: PlanningObraRead[]
  tasks: PlanningReadTasks
  agenda: PlanningAgendaRead
  metrics: PlanningReadMetrics
  incidents: PlanningReadIncidents
  dayConfig: PlanningReadDayConfig
  crewIdsInOrder: string[]
  crewNamesById: Record<string, string>
  activeCrewFilterName: string | null
}

export type PlanningReadBuilderInput = {
  date: string
  crewFilterId: string | null
  overdueFilterActive: boolean
  dayConfigRevision: number
  tasks: Task[]
  crews: Crew[]
  employees: Employee[]
  activeIncidents: IncidentSummary[]
  activeIncidentsCount: number
}
