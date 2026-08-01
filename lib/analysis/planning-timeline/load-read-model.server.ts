import "server-only"

/**
 * Assembles PlanningTimelineReadModel via Indicator Facade + lean OT/crew.
 * One event drain for the brief — no Activity Engine access from UI.
 */

import {
  toTimelineDateFromInput,
  toTimelineDateToInput,
} from "@/lib/activity/activity-timeline-groups"
import { drainAnalysisCompanyDayEvents } from "@/lib/analysis/queries/drain-company-day-events"
import { buildPlanningTimelineReadModel } from "@/lib/analysis/planning-timeline/builder"
import {
  loadPlanningTimelineCrew,
  loadPlanningTimelineTasks,
} from "@/lib/analysis/planning-timeline/load-sources.server"
import type { PlanningTimelineReadModel } from "@/lib/analysis/planning-timeline/types"
import { loadSituationRoomViaDualRead } from "@/lib/indicator-engine/facade/situation-room-dual-read"

export async function loadPlanningTimelineReadModel(input: {
  companyId: string
  date: string
  crewId: string
}): Promise<PlanningTimelineReadModel> {
  const dateFrom = toTimelineDateFromInput(input.date)
  const dateTo = toTimelineDateToInput(input.date)

  if (!dateFrom || !dateTo) {
    throw new Error("Fecha inválida.")
  }

  const crew = await loadPlanningTimelineCrew({
    companyId: input.companyId,
    crewId: input.crewId,
  })

  if (!crew) {
    throw new Error("Cuadrilla no encontrada.")
  }

  const [events, tasks] = await Promise.all([
    drainAnalysisCompanyDayEvents({
      companyId: input.companyId,
      dateFrom,
      dateTo,
    }),
    loadPlanningTimelineTasks({
      companyId: input.companyId,
      date: input.date,
      crewId: crew.id,
      crewName: crew.name,
    }),
  ])

  const { brief } = loadSituationRoomViaDualRead({
    companyId: input.companyId,
    date: input.date,
    events,
  })

  return buildPlanningTimelineReadModel({
    date: input.date,
    executiveBrief: brief,
    crew,
    tasks,
  })
}
