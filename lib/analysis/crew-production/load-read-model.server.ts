import "server-only"

/**
 * Assembles Crew Production Read Model via Indicator Facade + lean OT/crew sources.
 * One event drain for the brief — no Activity Engine access from UI.
 */

import {
  toTimelineDateFromInput,
  toTimelineDateToInput,
} from "@/lib/activity/activity-timeline-groups"
import { drainAnalysisCompanyDayEvents } from "@/lib/analysis/queries/drain-company-day-events"
import { buildCrewProductionReadModel } from "@/lib/analysis/crew-production/builder"
import {
  loadCrewProductionCrews,
  loadCrewProductionTasks,
} from "@/lib/analysis/crew-production/load-sources.server"
import type { CrewProductionReadModel } from "@/lib/analysis/crew-production/types"
import { loadSituationRoomViaDualRead } from "@/lib/indicator-engine/facade/situation-room-dual-read"

export async function loadCrewProductionReadModel(input: {
  companyId: string
  date: string
}): Promise<CrewProductionReadModel> {
  const dateFrom = toTimelineDateFromInput(input.date)
  const dateTo = toTimelineDateToInput(input.date)

  if (!dateFrom || !dateTo) {
    throw new Error("Fecha inválida.")
  }

  const [events, tasks, crews] = await Promise.all([
    drainAnalysisCompanyDayEvents({
      companyId: input.companyId,
      dateFrom,
      dateTo,
    }),
    loadCrewProductionTasks({
      companyId: input.companyId,
      date: input.date,
    }),
    loadCrewProductionCrews({ companyId: input.companyId }),
  ])

  // Indicator Facade / Dual Read — official Executive Brief for the day.
  const { brief } = loadSituationRoomViaDualRead({
    companyId: input.companyId,
    date: input.date,
    events,
  })

  return buildCrewProductionReadModel({
    date: input.date,
    executiveBrief: brief,
    crews,
    tasks,
  })
}
