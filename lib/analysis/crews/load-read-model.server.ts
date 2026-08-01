import "server-only"

/**
 * Assembles CUADRILLAS Read Model — integrates production + timeline builders.
 * One event drain for brief. No Activity Engine in UI.
 */

import {
  toTimelineDateFromInput,
  toTimelineDateToInput,
} from "@/lib/activity/activity-timeline-groups"
import { drainAnalysisCompanyDayEvents } from "@/lib/analysis/queries/drain-company-day-events"
import { buildCrewsReadModel } from "@/lib/analysis/crews/builder"
import {
  loadCrewsScreenCrews,
  loadCrewsScreenTasks,
} from "@/lib/analysis/crews/load-sources.server"
import {
  resolveCrewsPeriodRange,
  type CrewsPeriodPreset,
} from "@/lib/analysis/crews/period"
import type { CrewsReadModel } from "@/lib/analysis/crews/types"
import { loadSituationRoomViaDualRead } from "@/lib/indicator-engine/facade/situation-room-dual-read"

export async function loadCrewsReadModel(input: {
  companyId: string
  preset: CrewsPeriodPreset
  dateFrom?: string
  dateTo?: string
}): Promise<CrewsReadModel> {
  const period = resolveCrewsPeriodRange({
    preset: input.preset,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  })

  const focusFrom = toTimelineDateFromInput(period.focusDate)
  const focusTo = toTimelineDateToInput(period.focusDate)

  if (!focusFrom || !focusTo) {
    throw new Error("Fecha inválida.")
  }

  const [events, tasks, crews] = await Promise.all([
    drainAnalysisCompanyDayEvents({
      companyId: input.companyId,
      dateFrom: focusFrom,
      dateTo: focusTo,
    }),
    loadCrewsScreenTasks({
      companyId: input.companyId,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
    }),
    loadCrewsScreenCrews({ companyId: input.companyId }),
  ])

  const { brief } = loadSituationRoomViaDualRead({
    companyId: input.companyId,
    date: period.focusDate,
    events,
  })

  return buildCrewsReadModel({
    period,
    executiveBrief: brief,
    crews,
    tasks,
  })
}
