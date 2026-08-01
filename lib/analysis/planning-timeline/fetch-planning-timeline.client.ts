import type { PlanningTimelineReadModel } from "@/lib/analysis/planning-timeline/types"

export type PlanningTimelineQueryResult = {
  date: string
  crewId: string
  model: PlanningTimelineReadModel
}

type PlanningTimelineFetchResult =
  | { success: true; data: PlanningTimelineQueryResult }
  | { success: false; message: string }

export async function fetchPlanningTimeline(input: {
  date: string
  crewId: string
}): Promise<PlanningTimelineFetchResult> {
  const params = new URLSearchParams({
    date: input.date,
    crewId: input.crewId,
  })
  const response = await fetch(
    `/api/activity/timeline-operativo?${params.toString()}`
  )
  const payload = (await response.json()) as {
    success?: boolean
    message?: string
    date?: string
    crewId?: string
    model?: PlanningTimelineReadModel
  }

  if (!response.ok || !payload.success || !payload.model) {
    return {
      success: false,
      message: payload.message ?? "No se pudo cargar el Timeline Operativo.",
    }
  }

  return {
    success: true,
    data: {
      date: payload.date ?? input.date,
      crewId: payload.crewId ?? input.crewId,
      model: payload.model,
    },
  }
}
