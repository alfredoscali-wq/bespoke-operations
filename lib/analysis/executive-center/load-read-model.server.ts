import "server-only"

/**
 * Loads Centro Ejecutivo via Indicator Facade only (one event drain).
 */

import {
  toTimelineDateFromInput,
  toTimelineDateToInput,
} from "@/lib/activity/activity-timeline-groups"
import { drainAnalysisCompanyDayEvents } from "@/lib/analysis/queries/drain-company-day-events"
import { buildExecutiveCenterReadModel } from "@/lib/analysis/executive-center/builder"
import type { ExecutiveCenterReadModel } from "@/lib/analysis/executive-center/types"
import { loadSituationRoomViaDualRead } from "@/lib/indicator-engine/facade/situation-room-dual-read"

export async function loadExecutiveCenterReadModel(input: {
  companyId: string
  date: string
}): Promise<ExecutiveCenterReadModel> {
  const dateFrom = toTimelineDateFromInput(input.date)
  const dateTo = toTimelineDateToInput(input.date)

  if (!dateFrom || !dateTo) {
    throw new Error("Fecha inválida.")
  }

  const events = await drainAnalysisCompanyDayEvents({
    companyId: input.companyId,
    dateFrom,
    dateTo,
  })

  const { brief } = loadSituationRoomViaDualRead({
    companyId: input.companyId,
    date: input.date,
    events,
  })

  return buildExecutiveCenterReadModel({
    date: input.date,
    brief,
  })
}
